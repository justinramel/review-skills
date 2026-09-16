#!/usr/bin/env bash
# Interactive one-time setup for the pr-review skill's Jira integration.
# Walks you through creating an Atlassian API token and stores the credentials
# in ${XDG_CONFIG_HOME:-~/.config}/pr-review/jira.env (chmod 600, never in a repo).
#
# Re-run any time to update the values. Requires: curl, and a browser for the
# token page (falls back to printing the URL).
set -euo pipefail

TOKEN_URL="https://id.atlassian.com/manage-profile/security/api-tokens"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/pr-review"
CONFIG_FILE="$CONFIG_DIR/jira.env"

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

bold "pr-review — Jira setup"
echo "This links your reviews to Jira so the Spec axis can read the ticket a PR"
echo "implements. Credentials are stored locally at:"
dim  "  $CONFIG_FILE"
echo

# 1. Base URL ---------------------------------------------------------------
bold "1/3  Your Jira site"
echo "The base URL of your Jira, e.g. https://your-company.atlassian.net"
read -r -p "Jira base URL: " JIRA_BASE_URL
JIRA_BASE_URL="${JIRA_BASE_URL%/}"
case "$JIRA_BASE_URL" in
  https://*) ;;
  *) echo "Must start with https:// — got '$JIRA_BASE_URL'." >&2; exit 1;;
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
# Hidden entry so the token never lands in the terminal scrollback or history.
read -r -s -p "Paste API token: " JIRA_API_TOKEN
echo
[ -n "$JIRA_API_TOKEN" ] || { echo "Token cannot be blank." >&2; exit 1; }
echo

# Validate before saving ----------------------------------------------------
echo "Checking the credentials against $JIRA_BASE_URL ..."
code="$(curl -s -o /tmp/pr-review-jira-myself.$$ -w '%{http_code}' \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H 'Accept: application/json' \
  "$JIRA_BASE_URL/rest/api/3/myself" || true)"
if [ "$code" != "200" ]; then
  rm -f "/tmp/pr-review-jira-myself.$$"
  echo "Authentication failed (HTTP $code). Check the site URL, email, and token." >&2
  exit 1
fi
who="$(sed -n 's/.*"displayName":"\([^"]*\)".*/\1/p' "/tmp/pr-review-jira-myself.$$" | head -n1)"
rm -f "/tmp/pr-review-jira-myself.$$"
echo "Authenticated as ${who:-your account}."

# Save ----------------------------------------------------------------------
mkdir -p "$CONFIG_DIR"
umask 077
cat > "$CONFIG_FILE" <<EOF
# pr-review Jira credentials — created by setup-jira.sh. Do not commit.
JIRA_BASE_URL="$JIRA_BASE_URL"
JIRA_EMAIL="$JIRA_EMAIL"
JIRA_API_TOKEN="$JIRA_API_TOKEN"
EOF
chmod 600 "$CONFIG_FILE"

echo
bold "Done."
echo "Saved to $CONFIG_FILE (permissions 600)."
echo "The pr-review skill will now read Jira tickets referenced by a PR."
