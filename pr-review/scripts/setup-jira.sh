#!/usr/bin/env bash
# Interactive one-time setup for the pr-review skill's Jira integration.
# Stores credentials as inert JSON in
# ${XDG_CONFIG_HOME:-~/.config}/pr-review/jira.json with mode 0600.
#
# Re-run any time to update the values. Requires: curl, jq, and optionally a
# browser opener for the token page.
set -euo pipefail

TOKEN_URL="https://id.atlassian.com/manage-profile/security/api-tokens"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/pr-review"
CONFIG_FILE="$CONFIG_DIR/jira.json"
LEGACY_CONFIG_FILE="$CONFIG_DIR/jira.env"
# Keep credentials in this shell only; child processes receive them through
# jira_curl's stdin config.
export -n JIRA_BASE_URL JIRA_EMAIL JIRA_API_TOKEN 2>/dev/null || true
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=jira-common.sh
. "$SCRIPT_DIR/jira-common.sh"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
dim()  { printf '\033[2m%s\033[0m\n' "$1"; }

open_url() {
  local url="$1"
  if   command -v xdg-open >/dev/null 2>&1; then xdg-open "$url"  >/dev/null 2>&1 & disown || true
  elif command -v open     >/dev/null 2>&1; then open "$url"      >/dev/null 2>&1 & disown || true
  elif command -v wslview  >/dev/null 2>&1; then wslview "$url"   >/dev/null 2>&1 & disown || true
  else return 1; fi
}

command -v curl >/dev/null 2>&1 || { echo "curl is required." >&2; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "jq is required." >&2; exit 1; }

umask 077

bold "pr-review - Jira setup"
echo "This links your reviews to Jira so the Spec axis can read the ticket a PR"
echo "implements. Credentials are stored locally as inert JSON at:"
dim  "  $CONFIG_FILE"
echo

# 1. Base URL ---------------------------------------------------------------
bold "1/3  Your Jira site"
echo "The base URL of your Jira, e.g. https://your-company.atlassian.net"
read -r -p "Jira base URL: " JIRA_BASE_URL
JIRA_BASE_URL="${JIRA_BASE_URL%/}"
case "$JIRA_BASE_URL" in
  https://*) ;;
  *) echo "Must start with https://; got '$JIRA_BASE_URL'." >&2; exit 1;;
esac
echo

# 2. Email ------------------------------------------------------------------
bold "2/3  Your Atlassian account email"
read -r -p "Email: " JIRA_EMAIL
[ -n "$JIRA_EMAIL" ] || { echo "Email cannot be blank." >&2; exit 1; }
echo

# 3. API token --------------------------------------------------------------
bold "3/3  Create an API token"
echo "Opening the Atlassian API token page. Click 'Create API token', give it a"
echo "label like 'pr-review', then copy the token (you only see it once)."
if ! open_url "$TOKEN_URL"; then
  echo "Open this URL in your browser:"
  echo "  $TOKEN_URL"
fi

echo
# Hidden entry so the token never lands in terminal scrollback or shell history.
read -r -s -p "Paste API token: " JIRA_API_TOKEN
echo
[ -n "$JIRA_API_TOKEN" ] || { echo "Token cannot be blank." >&2; exit 1; }
echo

# Validate before saving ----------------------------------------------------
response_file="$(mktemp "${TMPDIR:-/tmp}/pr-review-jira-myself.XXXXXX")"
config_tmp=""
cleanup() {
  rm -f "$response_file"
  if [ -n "$config_tmp" ]; then
    rm -f "$config_tmp"
  fi
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

echo "Checking the credentials against $JIRA_BASE_URL ..."
if ! code="$(jira_curl --silent --show-error \
  --output "$response_file" \
  --write-out '%{http_code}' \
  --header 'Accept: application/json' \
  "$JIRA_BASE_URL/rest/api/3/myself")"; then
  echo "Could not connect to Jira. Check the site URL and network connection." >&2
  exit 1
fi

if [ "$code" != "200" ]; then
  echo "Authentication failed (HTTP $code). Check the site URL, email, and token." >&2
  exit 1
fi

who="$(jq -r 'if (.displayName | type) == "string" then .displayName else empty end' "$response_file")"
echo "Authenticated as ${who:-your account}."

# Save ----------------------------------------------------------------------
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
config_tmp="$(mktemp "$CONFIG_DIR/.jira.json.XXXXXX")"

if ! printf '%s\0%s\0%s\0' "$JIRA_BASE_URL" "$JIRA_EMAIL" "$JIRA_API_TOKEN" | jq -Rs '
  split("\u0000") as $values
  | {
      base_url: $values[0],
      email: $values[1],
      api_token: $values[2]
    }
' > "$config_tmp"; then
  echo "Could not serialize Jira credentials." >&2
  exit 1
fi

chmod 600 "$config_tmp"
mv -f "$config_tmp" "$CONFIG_FILE"
config_tmp=""
rm -f "$LEGACY_CONFIG_FILE"

echo
bold "Done."
echo "Saved to $CONFIG_FILE (permissions 600)."
echo "The pr-review skill will now read Jira tickets referenced by a PR."
