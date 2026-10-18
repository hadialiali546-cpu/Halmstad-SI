#!/usr/bin/env bash
# Halmstad SI — build and deploy to Firebase from Google Cloud Shell.
# Follows the official Firebase agent skills (firebase-basics, firebase-auth-basics, firebase-firestore).
# Before running: upload the latest halmstad-si-demo.zip to Cloud Shell (⋮ → Upload).
set -euo pipefail

PROJECT_ID="si-halmstad"
APP_ID="1:206572087324:web:e51a37889ad841545317d9"
REGION="europe-north2"            # Stockholm — permanent once the database exists
ZIP="$HOME/halmstad-si-demo.zip"
APP_DIR="$HOME/halmstad-si"
FB="npx -y firebase-tools@latest"
OWNER_EMAIL="$(gcloud config get-value account 2>/dev/null | tr 'A-Z' 'a-z')"
step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$1"; }

step "1/8 Unpacking the uploaded zip"
[ -f "$ZIP" ] || { echo "✖ $ZIP not found. Upload it with ⋮ → Upload, then run again."; exit 1; }
rm -rf "$APP_DIR"; unzip -q "$ZIP" -d "$HOME"; cd "$APP_DIR"

step "2/8 Firebase CLI login and project ($PROJECT_ID)"
$FB --version
$FB login:list 2>/dev/null | grep -q "@" || $FB login --no-localhost
$FB use "$PROJECT_ID"

step "3/8 Web app config for App ID $APP_ID"
$FB apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID" > /tmp/sdkconfig.txt
node -e '
  const t = require("fs").readFileSync("/tmp/sdkconfig.txt", "utf8");
  const m = t.match(/\{[\s\S]*\}/); if (!m) { console.error("Could not read SDK config"); process.exit(1); }
  let cfg; try { cfg = JSON.parse(m[0]); } catch { cfg = Function("return (" + m[0] + ")")(); }
  require("fs").writeFileSync("src/firebase-config.json", JSON.stringify(cfg, null, 2));
  console.log("  Saved src/firebase-config.json for project", cfg.projectId);'

step "4/8 Firestore database"
gcloud services enable firestore.googleapis.com identitytoolkit.googleapis.com firebaserules.googleapis.com --project "$PROJECT_ID"
if $FB firestore:databases:get "(default)" --project "$PROJECT_ID" >/tmp/db.txt 2>&1; then
  grep -Ei "location|edition|type" /tmp/db.txt || true
else
  echo "  Creating (default) database in $REGION"
  $FB firestore:databases:create "(default)" --location="$REGION" --project "$PROJECT_ID"
fi

step "5/8 Build (Node $(node -v))"
npm install --no-audit --no-fund
npm run build

step "6/8 First SI supervisor: $OWNER_EMAIL"
TOKEN="$(gcloud auth print-access-token)"
CODE=$(curl -s -o /tmp/roles.json -w '%{http_code}' -X PATCH \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/config/roles" \
  -H "Authorization: Bearer $TOKEN" -H "X-Goog-User-Project: $PROJECT_ID" -H "Content-Type: application/json" \
  -d "{\"fields\":{\"supervisors\":{\"arrayValue\":{\"values\":[{\"stringValue\":\"$OWNER_EMAIL\"}]}}}}")
[ "$CODE" = "200" ] && echo "  OK" || warn "Could not write config/roles (HTTP $CODE): $(head -c 300 /tmp/roles.json)"

step "7/8 Validating security rules (dry run)"
$FB deploy --only firestore:rules --project "$PROJECT_ID" --dry-run

step "8/8 Deploying Email/Password auth, Firestore rules and hosting"
$FB deploy --only auth,firestore,hosting --project "$PROJECT_ID" --non-interactive \
  || { warn "Auth deploy failed — enable Email/Password once in the console, then re-run:"; \
       warn "https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"; \
       $FB deploy --only firestore,hosting --project "$PROJECT_ID" --non-interactive; }

printf '\n\033[1;32m✔ Live at: https://%s.web.app\033[0m\n' "$PROJECT_ID"
cat <<NEXT
Next:
  1. Open the link → "Create account" with $OWNER_EMAIL.
  2. Click the verification link in your email, then "I've verified — reload".
  3. You are SI Supervisor → "Load demo data".
Update later: cd $APP_DIR && npm run build && $FB deploy --only auth,firestore,hosting
NEXT
