#!/bin/sh
# Deploy the v2 app to Strato over SFTP.
#   tools/deploy.sh <remote-dir>      e.g. sats-trainer-new  or  sats-trainer
# Credentials: LFTP_PASSWORD env var if set, else ~/.netrc — never stored in this script.
# Uploads only the deploy set; api/config.php is included when present locally.
set -e
cd "$(dirname "$0")/.."

DEST="${1:?usage: tools/deploy.sh <remote-dir>}"
HOST=5186167.ssh.w1.strato.hosting
USER=stu698771234

# Versioned index.html: every module URL gets ?v=<commit>-<time> (see tools/build-index.mjs)
VERSION="$(git rev-parse --short HEAD 2>/dev/null || echo dev)-$(date +%s)"
INDEX_TMP="$(mktemp -t index).html"
node tools/build-index.mjs "$VERSION" "$INDEX_TMP"

CONFIG_PUT=""
[ -f api/config.php ] && CONFIG_PUT="put api/config.php -o $DEST/api/config.php"

if [ -n "$LFTP_PASSWORD" ]; then
  CONNECT="--env-password -u $USER sftp://$HOST"
else
  CONNECT="sftp://$USER@$HOST"   # password looked up in ~/.netrc
fi

lftp $CONNECT <<EOF
set sftp:auto-confirm yes
set cmd:fail-exit yes
mkdir -p -f $DEST/css $DEST/data/content $DEST/api/state
put $INDEX_TMP -o $DEST/index.html
put .htaccess -o $DEST/.htaccess
mput -O $DEST/css css/theme.css css/app.css css/paper.css
mirror -R --delete --exclude-glob .DS_Store js/core   $DEST/js/core
mirror -R --delete --exclude-glob .DS_Store js/render $DEST/js/render
mirror -R --delete --exclude-glob .DS_Store js/views  $DEST/js/views
mirror -R --delete --exclude-glob .DS_Store js/gen    $DEST/js/gen
mirror -R --delete --exclude-glob .DS_Store data/content $DEST/data/content
mput -O $DEST/api api/proxy.php api/prompts.php api/ratelimit.php api/vocab.php api/.htaccess
put api/state/.htaccess -o $DEST/api/state/.htaccess
$CONFIG_PUT
EOF
rm -f "$INDEX_TMP"
echo "Deployed to $DEST/ (v=$VERSION)"
