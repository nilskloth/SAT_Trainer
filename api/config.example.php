<?php
/*
 * Copy to config.php ON THE SERVER and fill in real values.
 * config.php must never be committed to git or readable over HTTP
 * (.htaccess denies it; being pure PHP it also emits nothing if hit).
 */

return [
  // Anthropic API key (sk-ant-...)
  'anthropic_api_key' => 'REPLACE_ME',

  // Long random shared secret. The parent enters this once in the app's
  // Settings; the browser sends it with every proxy request.
  'shared_token' => 'REPLACE_ME_LONG_RANDOM',

  // Cost control: requests per day, per operation family.
  'daily_caps' => [
    'mark' => 150,
    'generate' => 8,
    'import' => 15,      // word-list uploads read by Claude
  ],

  // Grown-ups → Word lists: uploading and publishing need this password too.
  // Make the hash with:  php -r 'echo password_hash(readline("Password: "), PASSWORD_DEFAULT), "\n";'
  'upload_password_hash' => '',

  // Failed sign-ins (wrong shared key or upload password) are emailed here,
  // at most once an hour. alert_from should be an address on the hosting domain.
  'alert_email' => '',
  'alert_from' => '',

  // Global requests per minute across all operations.
  'per_minute_cap' => 20,
];
