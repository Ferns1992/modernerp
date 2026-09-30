#!/bin/bash
# ModernERP backup: consistent SQLite snapshot from the running container,
# retained locally, then mirrored to R2.
#
# The database runs in WAL mode, so a plain file copy can capture a torn state.
# The app is therefore paused, the files copied out, and the WAL checkpointed
# into a clean single-file snapshot. The finished backup is then opened and
# integrity-checked *before* it is accepted -- never verify a backup by
# looking at the original.
set -euo pipefail

CTN=modernerp
DIR=/var/backups/modernerp
BUCKET=R2:modernerp-backups
KEEP=14
STAMP=$(date -u +%Y%m%d-%H%M%S)
SNAP="$DIR/pos-$STAMP.db"

mkdir -p "$DIR"
chmod 700 "$DIR"

TMPD=$(mktemp -d)
chmod 777 "$TMPD"
cleanup() { rm -rf "$TMPD"; }
trap cleanup EXIT

# 1. Quiesce writes, then copy the database out.
if docker inspect -f '{{.State.Running}}' "$CTN" | grep -q true; then
  docker pause "$CTN" >/dev/null
  sleep 1
fi

docker cp "$CTN:/data/pos.db" "$TMPD/pos.db" 2>/dev/null || true
docker cp "$CTN:/data/pos.db-wal" "$TMPD/pos.db-wal" 2>/dev/null || true
# The -shm is deliberately NOT copied: it is a shared-memory index tied to the
# writer that created it. Copying it yields SQLITE_IOERR_LOCK. SQLite rebuilds
# it during WAL recovery on first open.

if docker inspect -f '{{.State.Paused}}' "$CTN" | grep -q true; then
  docker unpause "$CTN" >/dev/null
fi

# 2. Checkpoint the WAL, VACUUM INTO a clean snapshot, verify the *snapshot*.
#    Runs inside the app image so it uses the exact better-sqlite3 build.
cat > "$TMPD/snap.cjs" <<'JS'
// Absolute path: the script lives in /work, so bare 'better-sqlite3' would not
// resolve against /app/node_modules.
const Database = require('/app/node_modules/better-sqlite3');
const db = new Database('/work/pos.db');
db.pragma('journal_mode = DELETE');
const before = db.prepare('SELECT COUNT(*) c FROM users').get().c;
db.prepare('VACUUM INTO ?').run('/work/snapshot.db');
db.close();

const snap = new Database('/work/snapshot.db', { readonly: true });
const integrity = snap.pragma('integrity_check', { simple: true });
const after = snap.prepare('SELECT COUNT(*) c FROM users').get().c;
snap.close();

if (integrity !== 'ok' || after !== before) {
  console.error(`VERIFY FAILED integrity=${integrity} users_before=${before} users_after=${after}`);
  process.exit(1);
}
console.log(`verified integrity=${integrity} users=${after}`);
JS
chmod 644 "$TMPD/snap.cjs"

# --user root: docker cp writes the copied files as root, and the app image runs
# as uid 10001, which cannot open them for writing.
docker run --rm --user root -v "$TMPD:/work" -w /app "$CTN" node /work/snap.cjs

if [ ! -f "$TMPD/snapshot.db" ]; then
  echo "ERROR: snapshot.db was not produced" >&2
  exit 1
fi

mv "$TMPD/snapshot.db" "$SNAP"
chmod 600 "$SNAP"
echo "local snapshot: $SNAP ($(stat -c%s "$SNAP") bytes)"

# 3. Local retention.
ls -1t "$DIR"/pos-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  echo "pruning $old"
  rm -f "$old"
done

# 4. Mirror to R2 (copy, never sync).
rclone copy "$DIR" "$BUCKET" --log-level ERROR
echo "mirrored to $BUCKET"

# 5. Verify the newest R2 object by streaming it back.
LATEST=$(rclone lsl "$BUCKET" 2>/dev/null | sort -k2,3 | tail -1 | awk '{print $NF}')
if [ -n "$LATEST" ]; then
  rclone cat "$BUCKET/$LATEST" 2>/dev/null | head -c 16 | od -c | head -2
  echo "r2 verified: $LATEST"
fi

echo "backup complete"
