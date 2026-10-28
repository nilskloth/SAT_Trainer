<?php
/*
 * Single proxy endpoint: POST {token, op, payload}.
 * Prompts, models, schemas and token caps are server-side
 * (prompts.php); this file authenticates, rate-limits, calls
 * the Anthropic API and returns a uniform envelope:
 *   {ok:true, data:{...}, usage:{...}}
 *   {ok:false, error:{code, message, retryAfter?}}
 */

declare(strict_types=1);

require __DIR__ . '/prompts.php';
require __DIR__ . '/ratelimit.php';
require __DIR__ . '/vocab.php';

const MAX_BODY_BYTES = 32768;
const MAX_UPLOAD_BODY_BYTES = 13 * 1024 * 1024;   // import-vocab: base64 pages
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

header('Content-Type: application/json; charset=utf-8');

function respond_error(int $status, string $code, string $message, ?int $retryAfter = null): void {
  http_response_code($status);
  $error = ['code' => $code, 'message' => $message];
  if ($retryAfter !== null) $error['retryAfter'] = $retryAfter;
  echo json_encode(['ok' => false, 'error' => $error]);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  respond_error(405, 'bad_request', 'POST only');
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
  respond_error(500, 'server', 'Proxy not configured');
}
$config = require $configPath;

$body = file_get_contents('php://input', false, null, 0, MAX_UPLOAD_BODY_BYTES + 1);
if ($body === false || strlen($body) > MAX_UPLOAD_BODY_BYTES) {
  respond_error(413, 'bad_request', 'Request too large');
}

$req = json_decode($body, true);
if (!is_array($req)) {
  respond_error(400, 'bad_request', 'Invalid JSON');
}

$token = $req['token'] ?? '';
if (!is_string($token) || $token === '' ||
    !hash_equals((string) $config['shared_token'], $token)) {
  sec_record_fail('token', $config);
  respond_error(401, 'unauthorized', 'Bad token');
}

$op = $req['op'] ?? '';
if (!in_array($op, OPS, true)) {
  respond_error(400, 'bad_request', 'Unknown operation');
}
if ($op !== 'import-vocab' && strlen($body) > MAX_BODY_BYTES) {
  respond_error(413, 'bad_request', 'Request too large');
}
$payload = is_array($req['payload'] ?? null) ? $req['payload'] : [];

if (in_array($op, PASSWORD_OPS, true)) {
  $denied = sec_check_password($payload['password'] ?? null, $config);
  if ($denied !== null) respond_error($denied[0], $denied[1], $denied[2]);
  unset($payload['password']);
}

/* Word-list ops that only touch the server's files */
if ($op !== 'import-vocab' && str_starts_with($op, 'vocab-')) {
  try {
    $data = match ($op) {
      'vocab-unlock' => ['unlocked' => true],
      'vocab-publish' => vocab_publish($payload),
      'vocab-remove' => vocab_remove($payload),
      'vocab-history' => vocab_history(),
      'vocab-restore' => vocab_restore($payload),
    };
  } catch (InvalidArgumentException $e) {
    respond_error(400, 'bad_request', $e->getMessage());
  } catch (RuntimeException $e) {
    respond_error(500, 'server', $e->getMessage());
  }
  echo json_encode(['ok' => true, 'data' => $data]);
  exit;
}

/* ping: no upstream call — connectivity + remaining quota */
if ($op === 'ping') {
  echo json_encode(['ok' => true, 'data' => [
    'remaining' => rl_remaining($config),
    'uploads' => [
      'passwordSet' => ((string) ($config['upload_password_hash'] ?? '')) !== '',
      'postMax' => (string) ini_get('post_max_size'),
      'alerts' => ((string) ($config['alert_email'] ?? '')) !== '',
    ],
  ]]);
  exit;
}

/* usage: no upstream call — remaining quota + recent token log for the parent view */
if ($op === 'usage') {
  $entries = [];
  if (is_file(LOG_FILE)) {
    $size = filesize(LOG_FILE);
    $fh = fopen(LOG_FILE, 'r');
    if ($fh !== false) {
      if ($size > 16384) fseek($fh, -16384, SEEK_END);
      $chunk = stream_get_contents($fh);
      fclose($fh);
      $lines = array_filter(explode("\n", $chunk));
      foreach (array_slice($lines, -60) as $line) {
        $row = json_decode($line, true);
        if (is_array($row)) $entries[] = $row;
      }
    }
  }
  echo json_encode(['ok' => true, 'data' => [
    'remaining' => rl_remaining($config),
    'log' => $entries,
    'security' => sec_summary(),
  ]]);
  exit;
}

$limitError = rl_check_and_record(op_cap_bucket($op), $config);
if ($limitError !== null) {
  respond_error(429, $limitError['code'], 'Daily or per-minute limit reached', $limitError['retryAfter']);
}

try {
  $request = build_request($op, $payload);
} catch (InvalidArgumentException $e) {
  respond_error(400, 'bad_request', $e->getMessage());
}

/* Refusals are retried server-side on a fallback model */
$request['fallbacks'] = 'default';

/* Upstream call — raw curl, no SDK (shared hosting) */
set_time_limit(op_timeout($op) + 20);
$ch = curl_init(ANTHROPIC_URL);
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CONNECTTIMEOUT => 10,
  CURLOPT_TIMEOUT => op_timeout($op),
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json',
    'x-api-key: ' . $config['anthropic_api_key'],
    'anthropic-version: 2023-06-01',
    'anthropic-beta: server-side-fallback-2026-07-01',
  ],
  CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE),
]);
$raw = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$curlErr = curl_error($ch);

if ($raw === false) {
  respond_error(502, 'timeout', 'Upstream request failed: ' . $curlErr);
}

$response = json_decode($raw, true);
if (!is_array($response)) {
  respond_error(502, 'upstream', 'Upstream returned invalid JSON');
}

if ($status === 429) {
  respond_error(429, 'rate_limited', 'Model provider rate limit', 60);
}
if ($status !== 200) {
  $msg = $response['error']['message'] ?? "Upstream HTTP $status";
  respond_error(502, 'upstream', $msg);
}

$stop = $response['stop_reason'] ?? '';
if ($stop === 'refusal') {
  respond_error(502, 'upstream', 'The model declined this request');
}
if ($stop === 'max_tokens') {
  respond_error(502, 'upstream', 'Response was cut short — try again');
}

$text = null;
foreach (($response['content'] ?? []) as $block) {
  if (($block['type'] ?? '') === 'text') { $text = $block['text']; break; }
}
if ($text === null) {
  respond_error(502, 'upstream', 'No text in upstream response');
}

$data = json_decode($text, true);
if (!is_array($data)) {
  respond_error(502, 'upstream', 'Model output was not valid JSON');
}

$usage = [
  'input_tokens' => (int) ($response['usage']['input_tokens'] ?? 0),
  'output_tokens' => (int) ($response['usage']['output_tokens'] ?? 0),
];
rl_log($op, $usage['input_tokens'], $usage['output_tokens']);

echo json_encode(['ok' => true, 'data' => $data, 'usage' => $usage]);
