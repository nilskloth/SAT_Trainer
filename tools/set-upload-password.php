<?php
/*
 * Set the Word lists upload password and the alert email in api/config.php.
 * Run in your own Terminal from the repo root (the password is typed hidden
 * and only its hash is stored):
 *     php tools/set-upload-password.php
 * Then deploy (tools/deploy.sh sats-trainer) — that uploads config.php.
 */

if (PHP_SAPI !== 'cli') exit(1);
$path = __DIR__ . '/../api/config.php';
if (!is_file($path)) { fwrite(STDERR, "api/config.php not found\n"); exit(1); }

function ask(string $q, bool $hidden = false): string {
  echo $q;
  if ($hidden) system('stty -echo');
  $a = trim((string) fgets(STDIN));
  if ($hidden) { system('stty echo'); echo "\n"; }
  return $a;
}

$pw = ask('New upload password (at least 10 characters): ', true);
if (strlen($pw) < 10) { fwrite(STDERR, "Too short — nothing changed.\n"); exit(1); }
if (ask('Type it again: ', true) !== $pw) { fwrite(STDERR, "Didn't match — nothing changed.\n"); exit(1); }
$email = ask('Email for failed-attempt alerts (Enter to skip): ');
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) { fwrite(STDERR, "Not an email address — nothing changed.\n"); exit(1); }
$from = $email !== '' ? ask('Send alerts from (an address on your hosting domain, e.g. noreply@6oclock.net): ') : '';

$src = file_get_contents($path);
$set = function (string $src, string $key, string $value): string {
  $line = "  '{$key}' => " . var_export($value, true) . ',';
  $re = "/^\\s*'" . preg_quote($key, '/') . "'\\s*=>.*$/m";
  if (preg_match($re, $src)) return preg_replace($re, str_replace(['\\', '$'], ['\\\\', '\\$'], $line), $src, 1);
  $pos = strrpos($src, '];');
  return substr($src, 0, $pos) . $line . "\n" . substr($src, $pos);
};
$src = $set($src, 'upload_password_hash', password_hash($pw, PASSWORD_DEFAULT));
if ($email !== '') {
  $src = $set($src, 'alert_email', $email);
  if ($from !== '') $src = $set($src, 'alert_from', $from);
}

$check = tempnam(sys_get_temp_dir(), 'cfg');
file_put_contents($check, $src);
$parsed = include $check;
unlink($check);
if (!is_array($parsed) || !password_verify($pw, $parsed['upload_password_hash'] ?? '')) {
  fwrite(STDERR, "Something went wrong editing config.php — nothing changed.\n"); exit(1);
}
file_put_contents($path, $src);
echo "Saved. Now deploy: tools/deploy.sh sats-trainer\n";
