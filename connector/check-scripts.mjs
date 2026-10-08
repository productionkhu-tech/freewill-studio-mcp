#!/usr/bin/env node
// 저장소의 앱 스크립트를 통신 검사에 돌린다 (Actions check-scripts.yml · 손으로: node connector/check-scripts.mjs).
// 걸리면 실패로 끝나고, 같은 검사를 하는 커넥터는 그 스크립트를 내려주지 않는다.
import fs from "node:fs";
import { checkScript } from "./script-check.mjs";

const dir = new URL("../plugins/freewill-studio/scripts/", import.meta.url);
let bad = 0;
for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".mjs")).sort()) {
  const problems = checkScript(fs.readFileSync(new URL(name, dir), "utf8"));
  if (!problems.length) {
    console.log(`통과 ${name}`);
    continue;
  }
  bad++;
  for (const p of problems) console.log(`::error file=plugins/freewill-studio/scripts/${name}::${p}`);
}
// process.exit 대신 exitCode — Windows 의 Node 25 가 exit 에서 libuv 오류로 죽는 일이 있었다.
process.exitCode = bad ? 1 : 0;
