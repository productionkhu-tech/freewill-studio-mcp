// 마크다운에서 제목이 titles 중 하나와 같은 절만 골라 문서 순서대로 잇는다. 절 = 그 제목부터 같은 단계 이상의 다음 제목 전까지.
// 커넥터(모드별 공식 가이드)와 sync(절 이름이 바뀌었는지 매일 확인)가 같이 쓴다 — Node·워커 어디서나 도는 순수 함수.
// 코드 블록(```) 안의 # 줄은 제목으로 보지 않는다. 못 찾은 제목은 missing 으로 돌려준다.
export function pickSections(md, titles) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const heads = [];
  let fence = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) fence = !fence;
    const m = !fence && line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) heads.push({ i, level: m[1].length, title: m[2].trim() });
  });
  const want = new Set(titles.map((t) => t.trim().toLowerCase()));
  const found = new Set();
  const ranges = [];
  heads.forEach((h, n) => {
    const key = h.title.toLowerCase();
    if (!want.has(key)) return;
    found.add(key);
    const next = heads.slice(n + 1).find((x) => x.level <= h.level);
    ranges.push([h.i, next ? next.i : lines.length]);
  });
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return {
    text: merged.map(([a, b]) => lines.slice(a, b).join("\n").trimEnd()).join("\n\n"),
    missing: titles.filter((t) => !found.has(t.trim().toLowerCase())),
  };
}
