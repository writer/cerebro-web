#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
patterns_file="${repo_root}/scripts/leak_patterns.txt"
user_patterns_file="${CEREBRO_WEB_LEAK_USER_PATTERNS:-$HOME/.config/cerebro-web/leak_patterns.txt}"

if [ "${CEREBRO_WEB_LEAK_CHECK_BYPASS:-}" = "1" ]; then
  echo "leak-check: BYPASS via CEREBRO_WEB_LEAK_CHECK_BYPASS=1 (mode=${1:-?})" >&2
  exit 0
fi

if [ ! -f "$patterns_file" ]; then
  echo "leak-check: patterns file missing at $patterns_file" >&2
  exit 1
fi

mode="${1:-staged}"
shift || true

allow_inline=0
case "$mode" in
  staged | commit-msg) allow_inline=1 ;;
esac

collect_patterns() {
  grep -vE '^[[:space:]]*(#|$)' "$patterns_file"
  if [ -f "$user_patterns_file" ]; then
    grep -vE '^[[:space:]]*(#|$)' "$user_patterns_file" || true
  fi
}

patterns="$(collect_patterns || true)"
if [ -z "$patterns" ]; then
  exit 0
fi

redact_matches() {
  local input="$1"
  local pattern="$2"
  if command -v perl >/dev/null 2>&1; then
    PATTERN="$pattern" perl -ne '
      BEGIN { $p = $ENV{PATTERN} }
      s/$p/"<REDACTED:len=" . length($&) . ">"/ge;
      print;
    ' <<<"$input"
  else
    printf '%s\n' "$input" | sed -E "s/$pattern/<REDACTED>/g"
  fi
}

scan_input() {
  local label="$1"
  local input="$2"
  local matched=0
  local scan_lines="$input"
  if [ "$allow_inline" = "1" ]; then
    scan_lines="$(printf '%s\n' "$input" | grep -vE 'leak-check:[[:space:]]*allow[[:space:]]+[^[:space:]]' || true)"
  fi
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    local hits
    hits="$(printf '%s\n' "$scan_lines" | grep -E -n -- "$pattern" || true)"
    if [ -n "$hits" ]; then
      matched=1
      printf '%s: pattern matched (%d hit(s))\n' "$label" "$(printf '%s\n' "$hits" | wc -l | tr -d ' ')" >&2
      redact_matches "$hits" "$pattern" | sed 's/^/  /' >&2
    fi
  done <<<"$patterns"
  [ "$matched" -eq 0 ]
}

ignored_path_re='^(node_modules/|\.next/|dist/|build/|coverage/|scripts/leak_patterns\.txt$|package-lock\.json$)'

added_diff_for_changed_files() {
  local diff_args=("$@")
  local files=()
  while IFS= read -r file; do
    files+=("$file")
  done < <(git diff --name-only --diff-filter=ACM "${diff_args[@]}" -- 2>/dev/null | grep -vE "$ignored_path_re" || true)
  if [ "${#files[@]}" -eq 0 ]; then
    return 0
  fi
  git diff --no-color "${diff_args[@]}" -- "${files[@]}" | grep '^+' | grep -v '^+++' || true
}

case "$mode" in
  staged)
    diff_content="$(added_diff_for_changed_files --cached)"
    [ -z "$diff_content" ] && exit 0
    scan_input "<staged>" "$diff_content" || {
      echo "leak-check: sensitive pattern matched in staged changes." >&2
      exit 1
    }
    ;;
  commit-msg)
    msg_file="${1:?commit-msg mode requires a path}"
    scan_input "<commit-msg>" "$(cat "$msg_file")" || {
      echo "leak-check: sensitive pattern matched in commit message." >&2
      exit 1
    }
    ;;
  range)
    range="${1:-${LEAK_CHECK_BASE_REF:-origin/main}...${LEAK_CHECK_HEAD_REF:-HEAD}}"
    commits_meta="$(git log --format='%H%nAuthor: %an <%ae>%nCommitter: %cn <%ce>%n%s%n%b%n---' "$range" 2>/dev/null || true)"
    commits_diff="$(added_diff_for_changed_files "$range")"
    combined="${commits_meta}
${commits_diff}"
    [ -z "$(printf '%s' "$combined" | tr -d '[:space:]')" ] && exit 0
    scan_input "<range:$range>" "$combined" || {
      echo "leak-check: sensitive pattern matched in range $range." >&2
      exit 1
    }
    ;;
  pushed)
    failed=0
    while read -r local_ref local_sha remote_ref remote_sha; do
      [ -z "${local_ref:-}" ] && continue
      zero="0000000000000000000000000000000000000000"
      [ "$local_sha" = "$zero" ] && continue
      if [ "$remote_sha" = "$zero" ]; then
        range="${local_sha}~1...${local_sha}"
      else
        range="${remote_sha}...${local_sha}"
      fi
      if ! "$0" range "$range"; then
        failed=1
      fi
    done
    [ "$failed" -eq 0 ]
    ;;
  pr-body)
    title="${1:-${PR_TITLE:-}}"
    body="${2:-${PR_BODY:-}}"
    scan_input "<pr-body>" "${title}
${body}" || {
      echo "leak-check: sensitive pattern matched in PR metadata." >&2
      exit 1
    }
    ;;
  *)
    echo "usage: $0 {staged|commit-msg|range|pushed|pr-body}" >&2
    exit 2
    ;;
esac
