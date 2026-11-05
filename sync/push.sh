#!/usr/bin/env bash
# 동기화 반영분을 main 에 올린다. 사람이 플러그인을 고쳐 올린 직후면 버전 올리기 작업(bump-codex-version)이 먼저 올려
# 거절될 수 있다(11/5 두 번 실패) — 받아서 합치고 다시. 겹치는 곳은 Codex 버전 줄뿐이라 저쪽 번호를 받고 이번 반영 몫으로 하나 더 올린다.
set -u
git add -A
git commit -m "공식 스킬 동기화 $(date -u +%F)"
F=plugins/freewill-studio/.codex-plugin/plugin.json
BUMPED=$(git diff --name-only HEAD~1 HEAD -- "$F")
for try in 1 2 3; do
  git fetch -q origin main
  if ! git rebase -X ours origin/main; then
    git rebase --abort
    sleep 15
    continue
  fi
  if [ -n "$BUMPED" ]; then
    node -e '
      const fs = require("fs"), f = process.argv[1];
      const theirs = JSON.parse(require("child_process").execSync(`git show origin/main:${f}`));
      const p = theirs.version.split(".").map(Number); p[2]++;
      const j = JSON.parse(fs.readFileSync(f, "utf8")); j.version = p.join(".");
      fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");' "$F"
    git add "$F"
    git commit -q --amend --no-edit
  fi
  if git push origin HEAD:main; then exit 0; fi
  sleep 15
done
echo "main 에 못 올림 — 다음 동기화 때 다시 반영된다" >&2
exit 1
