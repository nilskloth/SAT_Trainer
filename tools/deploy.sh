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
put index.html -o $DEST/index.html
put .htaccess -o $DEST/.htaccess
mput -O $DEST/css css/theme.css css/app.css css/paper.css
mirror -R --delete --exclude-glob .DS_Store js/core   $DEST/js/core
mirror -R --delete --exclude-glob .DS_Store js/render $DEST/js/render
mirror -R --delete --exclude-glob .DS_Store js/views  $DEST/js/views
mirror -R --delete --exclude-glob .DS_Store js/gen    $DEST/js/gen
mirror -R --delete --exclude-glob .DS_Store data/content $DEST/data/content
mput -O $DEST/api api/proxy.php api/prompts.php api/ratelimit.php api/.htaccess
put api/state/.htaccess -o $DEST/api/state/.htaccess
$CONFIG_PUT
EOF
echo "Deployed to $DEST/"
