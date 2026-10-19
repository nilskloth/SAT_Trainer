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

    $cap = rl_caps($config)[$bucket] ?? 50;
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

/* Configured caps; word-list imports default to 15 a day if not configured. */
function rl_caps(array $config): array {
  return ($config['daily_caps'] ?? []) + ['import' => 15];
}

function rl_remaining(array $config): array {
  $data = rl_load();
  $out = [];
  foreach (rl_caps($config) as $bucket => $cap) {
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

/*
 * Failed sign-ins: a wrong shared token on any request, or a wrong
 * upload password. Each one is logged in state/security.json; the
 * parent is emailed (config alert_email, at most once an hour) and
 * sees them in Grown-ups. Five wrong upload passwords within 15
 * minutes lock uploading for an hour — even the right password is
 * refused while locked, so guessing gets nowhere.
 */
const SECURITY_FILE = STATE_DIR . '/security.json';
const SEC_WINDOW = 900;
const SEC_MAX_FAILS = 5;
const SEC_LOCK = 3600;
const SEC_ALERT_EVERY = 3600;

function sec_update(callable $change) {
  if (!is_dir(STATE_DIR)) @mkdir(STATE_DIR, 0755, true);
  $fh = @fopen(SECURITY_FILE, 'c+');
  if ($fh === false) return null;
  try {
    flock($fh, LOCK_EX);
    $data = json_decode(stream_get_contents($fh) ?: 'null', true);
    if (!is_array($data)) $data = [];
    $data += ['fails' => [], 'lockUntil' => 0, 'lastAlert' => 0, 'unreported' => 0];
    $result = $change($data);
    $data['fails'] = array_slice($data['fails'], -100);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data));
    return $result;
  } finally {
    flock($fh, LOCK_UN);
    fclose($fh);
  }
}

function sec_client_ip(): string {
  return substr((string) ($_SERVER['REMOTE_ADDR'] ?? '?'), 0, 45);
}

/* Log one failure; lock uploads and email the parent when due. */
function sec_record_fail(string $kind, array $config): void {
  $now = time();
  $ip = sec_client_ip();
  $alert = sec_update(function (array &$d) use ($kind, $now, $ip) {
    $d['fails'][] = ['ts' => gmdate('c', $now), 't' => $now, 'kind' => $kind, 'ip' => $ip];
    $d['unreported']++;
    if ($kind === 'upload-password') {
      $recent = array_filter($d['fails'], fn($f) => $f['kind'] === 'upload-password' && $now - $f['t'] < SEC_WINDOW);
      if (count($recent) >= SEC_MAX_FAILS) $d['lockUntil'] = $now + SEC_LOCK;
    }
    if ($now - $d['lastAlert'] < SEC_ALERT_EVERY) return null;
    $d['lastAlert'] = $now;
    $count = $d['unreported'];
    $d['unreported'] = 0;
    return ['count' => $count, 'locked' => $d['lockUntil'] > $now];
  });
  if ($alert) sec_alert($config, $kind, $ip, $alert['count'], $alert['locked']);
}

function sec_alert(array $config, string $kind, string $ip, int $count, bool $locked): void {
  $to = (string) ($config['alert_email'] ?? '');
  if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) return;
  $from = (string) ($config['alert_from'] ?? '');
  $what = $kind === 'upload-password' ? 'a wrong upload password' : 'a wrong shared key';
  $body = "The SATs / Language Trainer server rejected {$what} from {$ip} at " . gmdate('H:i') . " UTC.\n"
    . "Failed attempts since the last alert: {$count}.\n"
    . ($locked ? "Uploading is locked for an hour.\n" : '')
    . "\nIf this wasn't you, change the upload password (upload_password_hash) and/or the shared key in api/config.php.\n"
    . "Details: Grown-ups → AI marking.\n";
  $headers = $from !== '' && filter_var($from, FILTER_VALIDATE_EMAIL) ? "From: {$from}\r\n" : '';
  @mail($to, 'Trainer: failed sign-in attempt', $body, $headers . "Content-Type: text/plain; charset=utf-8\r\n");
}

/* null when the password is right; otherwise [status, code, message]. */
function sec_check_password($password, array $config): ?array {
  $hash = (string) ($config['upload_password_hash'] ?? '');
  if ($hash === '') return [403, 'no_password', 'No upload password is set on the server yet (upload_password_hash in api/config.php)'];
  $now = time();
  $lockUntil = sec_update(fn(array &$d) => $d['lockUntil']) ?? 0;
  if ($lockUntil > $now) {
    return [429, 'locked', 'Too many wrong passwords — uploading is locked for ' . ceil(($lockUntil - $now) / 60) . ' more minutes'];
  }
  if (!is_string($password) || $password === '' || !password_verify($password, $hash)) {
    sec_record_fail('upload-password', $config);
    return [401, 'bad_password', 'Wrong upload password'];
  }
  return null;
}

/* Recent failures for the parent's view. */
function sec_summary(): array {
  $raw = @file_get_contents(SECURITY_FILE);
  $d = $raw !== false ? json_decode($raw, true) : null;
  if (!is_array($d)) return ['fails' => [], 'locked' => false];
  return [
    'fails' => array_map(fn($f) => ['ts' => $f['ts'], 'kind' => $f['kind'], 'ip' => $f['ip']],
      array_slice(array_reverse($d['fails'] ?? []), 0, 10)),
    'total' => count($d['fails'] ?? []),
    'locked' => ($d['lockUntil'] ?? 0) > time(),
  ];
}
