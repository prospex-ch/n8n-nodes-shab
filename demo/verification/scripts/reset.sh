#!/bin/zsh
# Puts the n8n instance back to a pre-demo state: logged-in owner exists,
# the community package is NOT installed, and no workflows are saved.
set -u
BASE=http://localhost:5678
JAR=$(mktemp)
curl -s -c "$JAR" -X POST "$BASE/rest/login" -H 'Content-Type: application/json' \
  -d '{"emailOrLdapLoginId":"semion.sidorenko@letemps.ch","password":"DemoPassw0rd!"}' >/dev/null
if [ "${NDEMO_KEEP_PACKAGE:-0}" != "1" ]; then
  curl -s -b "$JAR" -X DELETE "$BASE/rest/community-packages?name=n8n-nodes-shab" >/dev/null 2>&1
fi

ids() {
  curl -s -b "$JAR" "$BASE/rest/$1" \
    | python3 -c 'import json,sys; print("\n".join(w["id"] for w in json.load(sys.stdin)["data"]))'
}

# A workflow has to be archived before it can be deleted, and archived ones
# still show in the overview under the archive filter, so both steps run.
for id in $(ids "workflows?includeFolders=false"); do
  curl -s -b "$JAR" -X POST "$BASE/rest/workflows/$id/archive" >/dev/null
  curl -s -b "$JAR" -X DELETE "$BASE/rest/workflows/$id" >/dev/null
done
rm -f "$JAR"
