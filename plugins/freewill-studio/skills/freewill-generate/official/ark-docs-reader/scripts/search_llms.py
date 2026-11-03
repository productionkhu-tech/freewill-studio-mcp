#!/usr/bin/env python3
"""检索 Ark llms.txt 索引，按需抓取文档正文并落盘，输出轻量清单。"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tempfile
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit


INDEX_URLS = {
    "ve": "https://ark.volcengine.com/llms.txt",
    "bp": "https://ai.byteplus.com/ark/llms.txt",
}
ENTRY_RE = re.compile(r"^- \[([^]]+)\]\((https?://[^)]+)\)(?::\s*(.*))?$")
TOKEN_RE = re.compile(r"[a-z0-9_.-]+|[\u4e00-\u9fff]+", re.IGNORECASE)
FENCE_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
HEADING_RE = re.compile(r"^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$")
ANCHOR_ONLY_RE = re.compile(
    r"^\s*<span\s+id\s*=\s*[\"'][^\"']*[\"']\s*>\s*</span>\s*$",
    re.IGNORECASE,
)
USER_AGENT = "ark-docs-reader/0.1.6"
SUMMARY_LIMIT = 120
DEFAULT_MAX_CHARS = 4000
OUT_DIR_NAME = "ark-docs-reader"


@dataclass(frozen=True)
class Hit:
    title: str
    url: str
    summary: str
    section: str
    score: int


@dataclass(frozen=True)
class Heading:
    level: int
    title: str
    line: int


def validate_http_url(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"需要绝对 HTTP(S) URL，实际为 {url!r}")
    return url


def fetch_text(
    url: str,
    *,
    max_chars: int | None = None,
    timeout: float = 30,
) -> tuple[str, bool]:
    request = urllib.request.Request(
        validate_http_url(url),
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/markdown, text/plain;q=0.9, text/html;q=0.5, */*;q=0.1",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read().decode("utf-8", errors="replace")
    if max_chars is not None and len(data) > max_chars:
        return data[:max_chars], True
    return data, False


def query_terms(query: str) -> list[str]:
    terms: list[str] = []
    for token in TOKEN_RE.findall(query.lower()):
        if token not in terms:
            terms.append(token)
        if re.fullmatch(r"[\u4e00-\u9fff]+", token) and len(token) > 2:
            for index in range(len(token) - 1):
                pair = token[index : index + 2]
                if pair not in terms:
                    terms.append(pair)
    return terms


def score_entry(title: str, summary: str, section: str, url: str, terms: list[str]) -> int:
    title_lower = title.lower()
    summary_lower = summary.lower()
    section_lower = section.lower()
    url_lower = url.lower()
    score = 0
    for term in terms:
        if term in title_lower:
            score += 12
        if term in summary_lower:
            score += 4
        if term in section_lower:
            score += 2
        if term in url_lower:
            score += 1
    return score


def search_index(index_text: str, query: str, limit: int) -> list[Hit]:
    terms = query_terms(query)
    if not terms:
        return []

    section = ""
    hits: list[Hit] = []
    for raw_line in index_text.splitlines():
        line = raw_line.strip()
        if line.startswith("## "):
            section = line[3:].strip()
            continue
        match = ENTRY_RE.match(line)
        if not match:
            continue
        title, url, summary = match.groups()
        summary = summary or ""
        score = score_entry(title, summary, section, url, terms)
        if score:
            hits.append(Hit(title, url, summary, section, score))

    hits.sort(key=lambda hit: (-hit.score, hit.title, hit.url))
    return hits[:limit]


def _fence_marker(line: str) -> tuple[str, int] | None:
    match = FENCE_RE.match(line)
    if not match:
        return None
    marker = match.group(1)
    return marker[0], len(marker)


def parse_headings(lines: list[str]) -> list[Heading]:
    headings: list[Heading] = []
    in_fence = False
    fence_char = ""
    fence_len = 0

    for line_number, line in enumerate(lines, 1):
        marker = _fence_marker(line)
        if in_fence:
            if marker and marker[0] == fence_char and marker[1] >= fence_len:
                in_fence = False
                fence_char = ""
                fence_len = 0
            continue
        if marker:
            in_fence = True
            fence_char, fence_len = marker
            continue
        if ANCHOR_ONLY_RE.match(line):
            continue
        match = HEADING_RE.match(line)
        if not match:
            continue
        title = re.sub(r"[ \t]+#+[ \t]*$", "", match.group(2)).strip()
        if title:
            headings.append(Heading(len(match.group(1)), title, line_number))
    return headings


def limit_summary(summary: str, full_summary: bool) -> str:
    if full_summary:
        return summary
    return summary[:SUMMARY_LIMIT]


def slug_for_url(url: str, used: set[str]) -> str:
    name = unquote(Path(urlsplit(url).path).name) or "document"
    if name.endswith(".md"):
        name = name[:-3]
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-._") or "document"
    candidate = f"{base}.md"
    suffix = 2
    while candidate in used:
        candidate = f"{base}-{suffix}.md"
        suffix += 1
    used.add(candidate)
    return candidate


def section_blocks(
    lines: list[str],
    headings: list[Heading],
    title: str,
) -> list[tuple[Heading, str]]:
    query = title.strip().lower()
    matches = [heading for heading in headings if heading.title.strip().lower() == query]
    if not matches:
        matches = [heading for heading in headings if query in heading.title.lower()]

    blocks: list[tuple[Heading, str]] = []
    for heading in matches:
        end = len(lines)
        for candidate in headings:
            if candidate.line > heading.line and candidate.level <= heading.level:
                end = candidate.line - 1
                break
        blocks.append((heading, "\n".join(lines[heading.line - 1 : end])))
    return blocks


def grep_blocks(lines: list[str], pattern: str, context: int) -> list[str]:
    try:
        regex = re.compile(pattern)
    except re.error as error:
        raise ValueError(f"无效的正则表达式：{error}") from error

    ranges: list[tuple[int, int]] = []
    for index, line in enumerate(lines):
        if regex.search(line):
            ranges.append((max(0, index - context), min(len(lines) - 1, index + context)))
    if not ranges:
        return []

    ranges.sort()
    merged = [ranges[0]]
    for start, end in ranges[1:]:
        previous_start, previous_end = merged[-1]
        if start <= previous_end + 1:
            merged[-1] = (previous_start, max(previous_end, end))
        else:
            merged.append((start, end))

    blocks: list[str] = []
    for block_index, (start, end) in enumerate(merged):
        if block_index:
            blocks.append("--")
        for index in range(start, end + 1):
            blocks.append(f"{index + 1}:{lines[index]}")
    return blocks


def print_selected(
    texts: list[str],
    paths: list[str],
    headings_list: list[list[Heading]],
    section: str,
    grep: str,
    context: int,
) -> None:
    if section:
        blocks: list[tuple[str, str]] = []
        for text, path, headings in zip(texts, paths, headings_list):
            for _heading, body in section_blocks(text.splitlines(), headings, section):
                blocks.append((path, body))
        if blocks:
            if len(blocks) > 1:
                print(
                    f"[ark-docs-reader] --section 命中 {len(blocks)} 处：{section}",
                    file=sys.stderr,
                )
            multiple_paths = len({path for path, _body in blocks}) > 1
            for index, (path, body) in enumerate(blocks):
                if multiple_paths:
                    print(f"# {path}")
                if index and not multiple_paths:
                    print("---")
                print(body)
        else:
            print(f"[ark-docs-reader] --section 未命中：{section}", file=sys.stderr)

    if grep:
        try:
            rendered = [
                (path, grep_blocks(text.splitlines(), grep, context))
                for text, path in zip(texts, paths)
            ]
        except ValueError as error:
            print(f"[ark-docs-reader] {error}", file=sys.stderr)
            return
        rendered = [(path, blocks) for path, blocks in rendered if blocks]
        if not rendered:
            print(f"[ark-docs-reader] --grep 未命中：{grep}", file=sys.stderr)
            return
        multiple_paths = len(rendered) > 1
        for path, blocks in rendered:
            if multiple_paths:
                print(f"# {path}")
            print("\n".join(blocks))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="检索 Ark llms.txt 索引，按需抓取文档并落盘，输出轻量清单。",
    )
    parser.add_argument("query", help="文档检索词。")
    parser.add_argument("--site", choices=sorted(INDEX_URLS), default="ve")
    parser.add_argument("--index-url", default="", help="覆盖 llms.txt URL。")
    parser.add_argument("--limit", type=int, default=5, help="最大检索结果数。")
    parser.add_argument("--fetch", action="store_true", help="抓取命中的文档正文。")
    parser.add_argument(
        "--fetch-count",
        type=int,
        default=1,
        help="开启 --fetch 时抓取的顶部结果数（默认 1）。",
    )
    parser.add_argument(
        "--out-dir",
        default="",
        help="正文落盘目录；未指定时使用系统临时目录下的固定子目录。",
    )
    parser.add_argument(
        "--inline",
        action="store_true",
        help="在清单中附带截断后的正文；默认不输出正文。",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=DEFAULT_MAX_CHARS,
        help=f"--inline 或 --legacy 时单篇正文最大字符数（默认 {DEFAULT_MAX_CHARS}）。",
    )
    parser.add_argument(
        "--full-summary",
        action="store_true",
        help="在 results[].summary 中输出完整摘要。",
    )
    parser.add_argument(
        "--legacy",
        action="store_true",
        help="额外输出旧版单文档 fetched 字段，兼容旧调用方。",
    )
    parser.add_argument(
        "--section",
        default="",
        help="按标题名精确或子串匹配，输出对应章节正文；需要 --fetch。",
    )
    parser.add_argument(
        "--grep",
        default="",
        help="按正则检索已落盘文档，输出“行号:内容”；需要 --fetch。",
    )
    parser.add_argument(
        "-C",
        "--context",
        type=int,
        default=0,
        help="--grep 的前后文行数（默认 0）。",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30,
        help="每个 HTTP 请求的超时秒数。",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if (
        args.limit < 1
        or args.fetch_count < 1
        or args.fetch_count > args.limit
        or args.max_chars < 1
        or args.timeout <= 0
        or args.context < 0
    ):
        print(
            "--limit、--fetch-count、--max-chars 和 --timeout 必须为正数；"
            "--fetch-count 不能超过 --limit；--context 不能为负数",
            file=sys.stderr,
        )
        return 2
    if (args.section or args.grep) and not args.fetch:
        print("--section 和 --grep 只能用于已落盘文档，请同时指定 --fetch", file=sys.stderr)
        return 2

    index_url = args.index_url or INDEX_URLS[args.site]
    try:
        index_url = validate_http_url(index_url)
        index_text, _ = fetch_text(index_url, timeout=args.timeout)
        hits = search_index(index_text, args.query, args.limit)
        output: dict[str, object] = {
            "query": args.query,
            "site": args.site if not args.index_url else "custom",
            "index_url": index_url,
            "results": [
                {
                    **asdict(hit),
                    "summary": limit_summary(hit.summary, args.full_summary),
                }
                for hit in hits
            ],
        }
        if not hits:
            output["terms"] = query_terms(args.query)

        texts: list[str] = []
        paths: list[str] = []
        headings_list: list[list[Heading]] = []
        fetched: list[dict[str, object]] = []

        if args.fetch and hits:
            out_dir = (
                Path(args.out_dir).expanduser()
                if args.out_dir
                else Path(tempfile.gettempdir()) / OUT_DIR_NAME
            )
            out_dir.mkdir(parents=True, exist_ok=True)
            used_names: set[str] = set()

            for hit in hits[: args.fetch_count]:
                text, _ = fetch_text(hit.url, timeout=args.timeout)
                encoded = text.encode("utf-8")
                path = out_dir / slug_for_url(hit.url, used_names)
                path.write_bytes(encoded)

                lines = text.splitlines()
                headings = parse_headings(lines)
                entry: dict[str, object] = {
                    "title": hit.title,
                    "url": hit.url,
                    "path": str(path),
                    "bytes": len(encoded),
                    "lines": len(lines),
                    "sha256": hashlib.sha256(encoded).hexdigest(),
                    "truncated": False,
                    "heading_count": len(headings),
                    "headings": [asdict(heading) for heading in headings],
                    "last_heading": headings[-1].title if headings else "",
                }
                if args.inline:
                    entry["content"] = text[: args.max_chars]
                    entry["truncated"] = len(text) > args.max_chars

                texts.append(text)
                paths.append(str(path))
                headings_list.append(headings)
                fetched.append(entry)

        if args.legacy:
            if fetched:
                legacy_text = texts[0]
                legacy_content = legacy_text[: args.max_chars]
                output["fetched"] = {
                    "title": fetched[0]["title"],
                    "url": fetched[0]["url"],
                    "content": legacy_content,
                    "truncated": len(legacy_text) > args.max_chars,
                }
            else:
                output["fetched"] = {}
            output["fetched_documents"] = fetched
        else:
            output["fetched"] = fetched

        print(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
        if args.section or args.grep:
            print_selected(texts, paths, headings_list, args.section, args.grep, args.context)
        return 0 if hits else 3
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        print(json.dumps({"error": str(error), "index_url": index_url}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
