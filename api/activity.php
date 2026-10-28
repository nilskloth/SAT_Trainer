<?php
/*
 * Usage monitor: the app's devices send small activity records
 * (op activity-log, shared token only); the parent reads them back
 * in Grown-ups → Activity (op activity-report, upload password too).
 *
 * Records, one JSON object per line in state/activity/<YYYY-MM>.jsonl:
 *   session  {kind, id, dev, start, end, active, open, parts:{key: seconds}, tally:{area: [answered, right]}}
 *            (active = learning seconds, open = seconds on screen; see js/core/activity.js)
 *   result   {kind, id, ts, area, mode, label, earned, marks}
 * A session is sent again as it grows; the newest line per id wins.
 * Nothing typed by the child (answers, words) is ever sent.
 */

declare(strict_types=1);

const ACTIVITY_DIR = __DIR__ . '/state/activity';
const ACTIVITY_MAX_RECORDS = 200;               // per request
const ACTIVITY_MAX_FILE = 20 * 1024 * 1024;     // per month — refuses beyond this
const ACTIVITY_MAX_DAYS = 400;

function act_str($v, int $max): string {
  return is_string($v) ? mb_substr(trim($v), 0, $max) : '';
}

function act_int($v, int $min, int $max): int {
  return is_numeric($v) ? max($min, min($max, (int) $v)) : $min;
}

/* Milliseconds since the epoch, sane range only (2026 … tomorrow). */
function act_ts($v): ?int {
  if (!is_numeric($v)) return null;
  $ts = (int) $v;
  return ($ts < 1767225600000 || $ts > (time() + 86400) * 1000) ? null : $ts;
}

function act_clean($r): ?array {
  if (!is_array($r)) return null;
  $id = act_str($r['id'] ?? '', 80);
  if (!preg_match('/^[A-Za-z0-9-]{6,80}$/', $id)) return null;

  if (($r['kind'] ?? '') === 'session') {
    $start = act_ts($r['start'] ?? null);
    $end = act_ts($r['end'] ?? null);
    if ($start === null || $end === null || $end < $start) return null;
    $parts = [];
    foreach (array_slice(is_array($r['parts'] ?? null) ? $r['parts'] : [], 0, 40, true) as $k => $s) {
      $key = act_str((string) $k, 80);
      if ($key !== '') $parts[$key] = act_int($s, 0, 86400);
    }
    $tally = [];
    foreach (array_slice(is_array($r['tally'] ?? null) ? $r['tally'] : [], 0, 12, true) as $k => $t) {
      $area = act_str((string) $k, 20);
      if ($area !== '' && is_array($t)) $tally[$area] = [act_int($t[0] ?? 0, 0, 100000), act_int($t[1] ?? 0, 0, 100000)];
    }
    return ['kind' => 'session', 'id' => $id, 'dev' => act_str($r['dev'] ?? '', 40),
      'start' => $start, 'end' => $end, 'active' => act_int($r['active'] ?? 0, 0, 86400),
      'open' => act_int($r['open'] ?? 0, 0, 86400),
      'parts' => (object) $parts, 'tally' => (object) $tally];
  }

  if (($r['kind'] ?? '') === 'result') {
    $ts = act_ts($r['ts'] ?? null);
    if ($ts === null) return null;
    return ['kind' => 'result', 'id' => $id, 'ts' => $ts,
      'area' => act_str($r['area'] ?? '', 20), 'mode' => act_str($r['mode'] ?? '', 30),
      'label' => act_str($r['label'] ?? '', 80),
      'earned' => act_int($r['earned'] ?? 0, 0, 100000), 'marks' => act_int($r['marks'] ?? 0, 0, 100000)];
  }
  return null;
}

function activity_log(array $p): array {
  $records = is_array($p['records'] ?? null) ? array_slice($p['records'], 0, ACTIVITY_MAX_RECORDS) : [];
  $byMonth = [];
  foreach ($records as $r) {
    $c = act_clean($r);
    if ($c === null) continue;
    $month = gmdate('Y-m', intdiv($c['kind'] === 'session' ? $c['start'] : $c['ts'], 1000));
    $byMonth[$month][] = json_encode($c, JSON_UNESCAPED_UNICODE);
  }
  if (!is_dir(ACTIVITY_DIR) && !@mkdir(ACTIVITY_DIR, 0755, true)) throw new RuntimeException('Could not create the activity folder');
  $saved = 0;
  foreach ($byMonth as $month => $lines) {
    $file = ACTIVITY_DIR . "/$month.jsonl";
    if (is_file($file) && filesize($file) > ACTIVITY_MAX_FILE) throw new RuntimeException('Activity log is full for this month');
    if (file_put_contents($file, implode("\n", $lines) . "\n", FILE_APPEND | LOCK_EX) === false) {
      throw new RuntimeException('Could not save activity');
    }
    $saved += count($lines);
  }
  return ['saved' => $saved];
}

function activity_report(array $p): array {
  $days = act_int($p['days'] ?? 30, 1, ACTIVITY_MAX_DAYS);
  $from = (time() - $days * 86400) * 1000;
  $latest = [];
  $months = [];
  for ($t = intdiv($from, 1000) - 31 * 86400; $t <= time() + 31 * 86400; $t += 28 * 86400) {
    $months[gmdate('Y-m', $t)] = true;
  }
  foreach (array_keys($months) as $month) {
    $file = ACTIVITY_DIR . "/$month.jsonl";
    if (!is_file($file)) continue;
    $fh = fopen($file, 'r');
    if ($fh === false) continue;
    flock($fh, LOCK_SH);
    while (($line = fgets($fh)) !== false) {
      $r = json_decode($line, true);
      if (is_array($r) && isset($r['id'])) $latest[$r['id']] = $r;     // newest line wins
    }
    flock($fh, LOCK_UN);
    fclose($fh);
  }
  $sessions = [];
  $results = [];
  foreach ($latest as $r) {
    if ($r['kind'] === 'session' && $r['end'] >= $from) $sessions[] = $r;
    elseif ($r['kind'] === 'result' && $r['ts'] >= $from) $results[] = $r;
  }
  return ['days' => $days, 'now' => time() * 1000, 'sessions' => $sessions, 'results' => $results];
}
