<?php
/*
 * File-based rate limiting and usage logging (shared hosting —
 * no database). state/usage.json is mutated under flock;
 * state/log.jsonl is append-only for the parent's audit view.
 */

const STATE_DIR = __DIR__ . '/state';
const USAGE_FILE = STATE_DIR . '/usage.json';
const LOG_FILE = STATE_DIR . '/log.jsonl';

function rl_load(): array {
  $raw = @file_get_contents(USAGE_FILE);
  $data = $raw !== false ? json_decode($raw, true) : null;
  if (!is_array($data)) $data = [];
  $today = gmdate('Y-m-d');
  if (($data['date'] ?? '') !== $today) {
    $data = ['date' => $today, 'counts' => [], 'minute' => ['ts' => 0, 'count' => 0]];
  }
  return $data;
}

/*
 * Check caps and, if allowed, record the request atomically.
 * Returns null when allowed, or ['code' => ..., 'retryAfter' => seconds].
 */
function rl_check_and_record(string $bucket, array $config): ?array {
  if (!is_dir(STATE_DIR)) @mkdir(STATE_DIR, 0755, true);

  $fh = fopen(USAGE_FILE, 'c+');
  if ($fh === false) return ['code' => 'server', 'retryAfter' => 60];

  try {
    if (!flock($fh, LOCK_EX)) return ['code' => 'server', 'retryAfter' => 60];

    $raw = stream_get_contents($fh);
    $data = json_decode($raw ?: 'null', true);
    if (!is_array($data)) $data = [];
    $today = gmdate('Y-m-d');
    if (($data['date'] ?? '') !== $today) {
      $data = ['date' => $today, 'counts' => [], 'minute' => ['ts' => 0, 'count' => 0]];
    }

    $now = time();
    $minute = $data['minute'] ?? ['ts' => 0, 'count' => 0];
    if ($now - ($minute['ts'] ?? 0) >= 60) {
      $minute = ['ts' => $now, 'count' => 0];
    }
    if ($minute['count'] >= ($config['per_minute_cap'] ?? 20)) {
      return ['code' => 'rate_limited', 'retryAfter' => 60 - ($now - $minute['ts'])];
    }

    $cap = $config['daily_caps'][$bucket] ?? 50;
    $used = $data['counts'][$bucket] ?? 0;
    if ($used >= $cap) {
      $midnight = strtotime('tomorrow midnight UTC');
      return ['code' => 'rate_limited', 'retryAfter' => max(60, $midnight - $now)];
    }

    $minute['count']++;
    $data['minute'] = $minute;
    $data['counts'][$bucket] = $used + 1;

    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data));
    return null;
  } finally {
    flock($fh, LOCK_UN);
    fclose($fh);
  }
}

function rl_remaining(array $config): array {
  $data = rl_load();
  $out = [];
  foreach (($config['daily_caps'] ?? []) as $bucket => $cap) {
    $out[$bucket] = max(0, $cap - ($data['counts'][$bucket] ?? 0));
  }
  return $out;
}

function rl_log(string $op, int $inputTokens, int $outputTokens): void {
  $line = json_encode([
    'ts' => gmdate('c'),
    'op' => $op,
    'in_tokens' => $inputTokens,
    'out_tokens' => $outputTokens,
  ]) . "\n";
  @file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}
