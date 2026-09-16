#!/usr/bin/env bash
# Fetch a Jira ticket as Markdown, for the pr-review skill's Spec axis.
#
#   jira-ticket.sh <ISSUE-KEY>        e.g. jira-ticket.sh FGP-1392
#
# Reads credentials from the environment (JIRA_BASE_URL, JIRA_EMAIL,
# JIRA_API_TOKEN) if set — useful in CI — otherwise from
# ${XDG_CONFIG_HOME:-~/.config}/pr-review/jira.env written by setup-jira.sh.
# Requires: curl, jq.
set -euo pipefail

key="${1:-}"
if [ -z "$key" ]; then
  echo "usage: jira-ticket.sh <ISSUE-KEY>" >&2
  exit 2
fi

CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/pr-review/jira.env"
if [ -z "${JIRA_BASE_URL:-}" ] || [ -z "${JIRA_EMAIL:-}" ] || [ -z "${JIRA_API_TOKEN:-}" ]; then
  if [ -f "$CONFIG_FILE" ]; then
    # shellcheck disable=SC1090
    . "$CONFIG_FILE"
  fi
fi
if [ -z "${JIRA_BASE_URL:-}" ] || [ -z "${JIRA_EMAIL:-}" ] || [ -z "${JIRA_API_TOKEN:-}" ]; then
  echo "No Jira credentials. Run pr-review/scripts/setup-jira.sh first." >&2
  exit 1
fi
command -v curl >/dev/null 2>&1 || { echo "curl is required." >&2; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "jq is required." >&2; exit 1; }

body="$(mktemp)"
trap 'rm -f "$body"' EXIT
code="$(curl -s -o "$body" -w '%{http_code}' \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H 'Accept: application/json' \
  "${JIRA_BASE_URL%/}/rest/api/3/issue/$key?fields=summary,description,status,issuetype,labels,priority")"

case "$code" in
  200) ;;
  401|403) echo "Not authorised for $key (HTTP $code). Re-run setup-jira.sh." >&2; exit 1;;
  404) echo "Ticket $key not found (HTTP $code)." >&2; exit 1;;
  *)   echo "Jira request for $key failed (HTTP $code)." >&2; exit 1;;
esac

# Description is Atlassian Document Format (v3, an object) or plain text (v2).
# Collect every text node in document order for a readable spec.
jq -r --arg base "${JIRA_BASE_URL%/}" --arg key "$key" '
  def adf: [.. | .text? // empty] | join(" ");
  "# " + $key + ": " + (.fields.summary // "(no summary)"),
  "",
  "- Type: " + (.fields.issuetype.name // "?"),
  "- Status: " + (.fields.status.name // "?"),
  "- Priority: " + (.fields.priority.name // "?"),
  "- Labels: " + ((.fields.labels // []) | join(", ")),
  "- Link: " + $base + "/browse/" + $key,
  "",
  "## Description",
  "",
  (if (.fields.description | type) == "string"
     then (.fields.description // "(none)")
     else ((.fields.description | adf) // "(none)")
   end)
' "$body"
