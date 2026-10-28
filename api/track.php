<?php
/*
 * Usage monitor endpoint — no shared key, so every device that opens
 * the site is counted without setup. POST JSON:
 *   {op:"log", records:[…]}             from the app (core/activity.js)
 *   {op:"report", password, days}       Grown-ups → Activity (upload password)
 * Guards for the open "log": same-site Origin only, small bodies, a
 * per-address hourly limit, strict record checks (activity.php) and a
 * monthly size cap. Addresses are used for the limit only, never stored
 * with the activity. Wrong report passwords count towards the same
 * lockout and alerts as the word-list uploads.
 */

declare(strict_types=1);

require __DIR__ . '/ratelimit.php';
require __DIR__ . '/activity.php';

const TRACK_MAX_BODY = 65536;
const TRACK_PER_HOUR = 300;                       // log posts per address
const TRACK_RATE_FILE = STATE_DIR . '/track-rate.json';

header('Content-Type: application/json; charset=utf-8');

function track_error(int $status, string $code, string $message): void {
  http_response_code($status);
  echo json_encode(['ok' => false, 'error' => ['code' => $code, 'message' => $message]]);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') track_error(405, 'bad_request', 'POST only');

/* Only pages from this site may post (browsers always send Origin on POST). */
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
  track_error(403, 'forbidden', 'Wrong site');
}

$body = file_get_contents('php://input', false, null, 0, TRACK_MAX_BODY + 1);
if ($body === false || strlen($body) > TRACK_MAX_BODY) track_error(413, 'bad_request', 'Request too large');
$req = json_decode($body, true);
if (!is_array($req)) track_error(400, 'bad_request', 'Invalid JSON');

/* true while this address is under the hourly limit (and counts the request). */
function track_allow(): bool {
  if (!is_dir(STATE_DIR)) @mkdir(STATE_DIR, 0755, true);
  $fh = @fopen(TRACK_RATE_FILE, 'c+');
  if ($fh === false) return true;
  try {
    flock($fh, LOCK_EX);
    $d = json_decode(stream_get_contents($fh) ?: 'null', true);
    if (!is_array($d)) $d = [];
    $hour = intdiv(time(), 3600);
    if (($d['hour'] ?? 0) !== $hour) $d = ['hour' => $hour, 'n' => []];
    $key = hash('sha256', sec_client_ip());
    $d['n'][$key] = ($d['n'][$key] ?? 0) + 1;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($d));
    return $d['n'][$key] <= TRACK_PER_HOUR;
  } finally {
    flock($fh, LOCK_UN);
    fclose($fh);
  }
}

try {
  if (($req['op'] ?? '') === 'log') {
    if (!track_allow()) track_error(429, 'rate_limited', 'Too many requests — try later');
    $data = activity_log($req);
  } elseif (($req['op'] ?? '') === 'report') {
    $configPath = __DIR__ . '/config.php';
    if (!is_file($configPath)) track_error(500, 'server', 'Not configured');
    $denied = sec_check_password($req['password'] ?? null, require $configPath);
    if ($denied !== null) track_error($denied[0], $denied[1], $denied[2]);
    $data = activity_report($req);
  } else {
    track_error(400, 'bad_request', 'Unknown operation');
  }
} catch (RuntimeException $e) {
  track_error(500, 'server', $e->getMessage());
}
echo json_encode(['ok' => true, 'data' => $data]);
