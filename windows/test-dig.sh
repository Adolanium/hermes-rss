#!/usr/bin/env bash
set -u
d="$(dirname "$0")/dig"
fail=0
check() { # desc expected_rc actual_rc stdout_contains
  local desc="$1" want="$2" got="$3" out="$4"
  if [ "$want" != "$got" ]; then echo "FAIL rc: $desc want=$want got=$got"; fail=1; fi
}
out=$(bash "$d" +short +time=3 +tries=1 A example.com); rc=$?
[ "$rc" = 0 ] && grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$' <<<"$out" || { echo "FAIL A lookup: rc=$rc out=$out"; fail=1; }
out=$(bash "$d" +short +time=3 +tries=1 A localhost); rc=$?
[ "$rc" = 0 ] && grep -q '^127\.0\.0\.1$' <<<"$out" || { echo "FAIL localhost: rc=$rc out=$out"; fail=1; }
out=$(bash "$d" +short +time=2 +tries=1 A nonexistent.invalid); rc=$?
[ "$rc" = 0 ] && [ -z "$out" ] || { echo "FAIL invalid host: rc=$rc out=$out"; fail=1; }
out=$(bash "$d" +short); rc=$?
[ "$rc" = 2 ] && [ -z "$out" ] || { echo "FAIL flags-only: rc=$rc out=$out"; fail=1; }
out=$(bash "$d"); rc=$?
[ "$rc" = 2 ] || { echo "FAIL no-args: rc=$rc"; fail=1; }
out=$(bash "$d" +short +time=3 +tries=1 A 127.0.0.1); rc=$?
grep -q '^127\.0\.0\.1$' <<<"$out" || { echo "FAIL numeric host: rc=$rc out=$out"; fail=1; }
[ "$fail" = 0 ] && echo "ALL PASS" || echo "FAILURES"