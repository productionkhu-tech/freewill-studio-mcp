// 회사 공식 문서에서 프롬프트 가이드 부분만 뽑는다 — sync(매일 바뀜 확인·구글 문서 보관)와 커넥터(바로 받아 내려주기)가 같이 쓴다.
// 순수 함수라 Node·워커 어디서나 돈다. d = sources.json 의 docs 한 줄:
//   format "byteplus-doc"  BytePlus 문서 사이트 — 화면은 스크립트로 그리지만 페이지 데이터에 마크다운 원문(MDContent)이 있다
//   sections · drop        "## 제목" 이 sections 로 시작하는 절만, 그 안의 drop 제목(### Python 등) 아래는 버린다
//   dropFences             이 언어의 코드 블록(```python 등)은 버린다 — 프롬프트 예시(```text)는 남긴다
//   imageLines "drop"      그림이 든 줄을 통째로 버린다(기본은 그림 표시만 지우고 글은 남김 — 예시 표의 프롬프트를 살리려고)
export function extractDoc(text, d) {
  let md = d.format === "byteplus-doc" ? byteplusMarkdown(text) : text.replace(/\r\n/g, "\n");
  if (d.dropFences) md = dropFences(md, d.dropFences);
  md = md
    .replace(/<header\b[\s\S]*?<\/header>/g, (blk) => { const t = blk.match(/\{"([^"]+)"\}/); return t ? `# ${t[1]}` : ""; })
    .replace(/<figure\b[\s\S]*?<\/figure>/g, "")
    .replace(/<\/?(?:figure|figcaption|columns?)\b[^>]*>/g, "");
  if (d.sections) md = extractSections(md, d.sections, d.drop, d.imageLines === "drop");
  else md = d.imageLines === "drop" ? md.split("\n").filter((l) => !l.includes("![")).join("\n") : md;
  md = md.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  return `${md.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function byteplusMarkdown(html) {
  const key = '"MDContent":';
  const at = html.indexOf(key);
  if (at < 0) throw new Error("페이지에 MDContent 가 없음 — BytePlus 문서 형식이 바뀌었는지 확인");
  const start = at + key.length;
  let end = start + 1, esc = false;
  for (; end < html.length; end++) {
    const c = html[end];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') break;
  }
  return JSON.parse(html.slice(start, end + 1))
    .replace(/<span id="[^"]*"><\/span>\n?/g, "")
    .replace(/\\([-.()[\]_*#+!>|])/g, "$1");
}

function dropFences(md, langs) {
  const re = new RegExp(`^\\s*\`\`\`(?:${langs})\\b`, "i");
  const out = [];
  let skipping = false, inFence = false;
  for (const line of md.split("\n")) {
    if (/^\s*```/.test(line)) {
      if (!inFence) { inFence = true; skipping = re.test(line); if (skipping) continue; }
      else { inFence = false; if (skipping) { skipping = false; continue; } }
    }
    if (!skipping) out.push(line);
  }
  return out.join("\n");
}

function extractSections(text, sections, drop, dropImageLines) {
  const dropRe = drop ? new RegExp(`^#{2,4} (${drop})\\s*$`, "i") : null;
  const out = [];
  let on = false, skip = false;
  for (const line of text.split("\n")) {
    const h = line.match(/^(#{1,6}) (.*)$/);
    if (h && h[1].length === 2) { on = sections.some((s) => h[2].trim().startsWith(s)); skip = false; }
    if (!on) continue;
    if (h) { skip = !!dropRe?.test(line); if (skip) continue; }
    if (skip || (dropImageLines && line.includes("!["))) continue;
    out.push(line);
  }
  return out.join("\n");
}
