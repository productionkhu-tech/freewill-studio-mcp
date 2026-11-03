---
name: ark-docs-reader
description: Use when the user asks about Volcengine Ark, BytePlus ModelArk, or ByteCloud Ark products, APIs, SDKs, models, error codes, examples, or usage and needs to find, verify, or cite the latest official documentation; also use to read official documentation URLs provided by the user, compare multiple documents, or add official evidence to code and troubleshooting conclusions. Choose documentation MCP, llms.txt, Markdown mirrors, or HTML bodies based on the target site's available capabilities, and keep verifiable sources.
---

# Search Ark official documentation

Treat this Skill as a task router and evidence workflow for public documentation, not as the Ark API, account control plane, or network capability itself. Read official content first, then answer from evidence; do not merely restate search summaries or model memory.

## Core workflow

1. Determine the target site from the product name, the user's language, and URLs. If site differences would change the answer and you cannot decide, ask first; otherwise state which site you are using.
2. Classify the task and use [Task routing](#task-routing) to load the minimum necessary material. Do not load the whole site for a single question.
3. Use [Source routing](#source-routing) to search and read content. Structured entry points only locate pages; the body, API spec, or official examples are the evidence. If the target site has no discovery entry point, do not substitute results from another site.
4. Use [Evidence checks](#evidence-check) to verify relevance, site, freshness, and conflicts. If evidence is insufficient, change keywords or read more documents.
5. Answer first, then list the sources actually read. Explicitly mark facts you cannot confirm as "not found in official documentation" or "requires an account-state query".

<a id="task-routing"></a>
## Task routing

| Task | Reading scope | Additional requirement |
| --- | --- | --- |
| Look up a single fact or procedure | Read the 1-2 most relevant documents | Locate the section that directly supports the conclusion; do not expand to unrelated pages |
| Look up API fields, error codes, or code patterns | Read the topic or API document first, then the API spec or official examples as needed | Do not fill in fields, enums, defaults, or request structures from memory; examples do not replace the field contract |
| Compare capabilities, migrate, or troubleshoot | Read 2-3 documents that cover each conclusion | Record evidence item by item; do not silently merge conflicting documents |
| Known official documentation URL | Read the page's Markdown mirror directly; fall back to the HTML body | No need to search `llms.txt` first; if the URL has an anchor, insert `.md` before the anchor |
| Build a knowledge base or offline retrieval | Use section full text or `llms-full.txt` when the site provides them | If the site has no bulk entry point, state the limitation; do not crawl the whole site's HTML and present it as an official corpus |

<a id="source-routing"></a>
## Source routing

When the target is Volcengine Ark or BytePlus ModelArk and you need to discover unknown pages, follow this priority:

1. **Documentation MCP**: only for Volcengine Ark, and only when the current session has documentation search and body-reading tools.
2. **`llms.txt`**: use when MCP is unavailable, or the target is BytePlus ModelArk, to discover Markdown documents through the target site's index.
3. **Markdown mirror**: when the page URL is known, read `<DOC_URL>.md`.
4. **HTML page**: when the preceding methods are unavailable, read the original page and keep only the article title, body, and tables or code blocks relevant to the question.

Target site entry points:

| Target site | Documentation index | Constraints |
| --- | --- | --- |
| Volcengine Ark | `https://ark.volcengine.com/llms.txt` | Prefer the documentation MCP when available; keep every conclusion within the Volcengine Ark site |
| BytePlus ModelArk | `https://ai.byteplus.com/ark/llms.txt` | Use the English site index and content; do not substitute Volcengine Ark content for ModelArk facts |
| ByteCloud Ark (Chinese) | None | Currently no documentation MCP or `llms.txt`; when the URL is known use `https://ark.bytedance.net/docs/<slug>.md`, then fall back to HTML |
| ByteCloud Ark (English) | None | Currently no documentation MCP or `llms.txt`; when the URL is known try `https://ark.byteintl.net/docs/<slug>.md`, then fall back to HTML |

### Large documents

1. When a page exceeds about 15 KB or 300 lines, do not read the whole page with a web-fetch tool; save it to disk and read it in segments with `offset/limit` or `--section`.
2. After each fetch, check whether `last_heading` is the document's final section. If the body appears to end but `last_heading` does not match the expected final section, continue reading.
3. Read at most 1-3 documents per answer. For each document, inspect `headings` first and read only the 1-2 matching sections; never inject `llms-full.txt` or an entire long document into context.

### Use the documentation MCP

When the target is Volcengine Ark and the current tools include `ark_search_docs`, `ark_fetch_doc`, or namespaced variants:

1. Search with 2-5 core keywords; if the first results are irrelevant, retry with synonyms, API names, or error codes.
2. Choose 1-3 results based on title, summary, and URL, and read each body.
3. If the body returns `has_more=true`, keep fetching with `chunk_start` and `chunk_count` until the needed sections are covered.
4. If API fields are still incomplete, call `ark_get_spec` when available; if code evidence is insufficient, call `ark_search_examples` when available.

Do not treat search summaries as final evidence.

### Use `llms.txt`

Use `llms.txt` only when the target is Volcengine Ark or BytePlus ModelArk. After fetching the target site's index, choose matching pages by title, summary, section, and URL, and read the Markdown URLs given by the index. When Python and public network access are available, use the deterministic script shipped with the Skill:

```bash
python3 <skill-dir>/scripts/search_llms.py "<query>" --site bp \
  --fetch --fetch-count 3 --out-dir /tmp/ark-docs
```

Use `--site ve` for Volcengine Ark and `--site bp` for BytePlus ModelArk. The script prints only the manifest JSON to stdout and writes document bodies to `--out-dir`; inspect `headings` and `last_heading` first, then read targeted content with `--section "<heading>"` or `--grep "<regex>" -C 2`. Use `--inline` only when the body must be embedded in the manifest, and `--legacy` only to keep old callers working. When `--out-dir` is omitted, bodies are written to a fixed subdirectory under the system temporary directory. Pass `--index-url <LLMS_TXT_URL>` only when the user explicitly provides another official `llms.txt`; do not guess index addresses for ByteCloud sites.

The script searches the index, fetches bodies, and performs targeted reads; the agent must still judge whether the content supports the conclusion.

### When the documentation MCP is not connected

When the target is Volcengine Ark and MCP is unavailable, continue using `llms.txt` to finish the answer; do not stop the task. At the end of the answer, add at most one optional setup hint:

```bash
# Claude Code
claude mcp add --transport http ark-docs-mcp https://mcp.ark-doc-resources.cn/mcp/

# Codex
codex mcp add ark-docs-mcp --url https://mcp.ark-doc-resources.cn/mcp/
```

Show only the command that matches the current client; if you cannot identify it, present both options. These commands modify local configuration, so run them only after explicit user approval. BytePlus ModelArk and ByteCloud sites do not use this MCP.

### Read ByteCloud documentation

ByteCloud sites currently provide no documentation MCP, `llms.txt`, or `llms-full.txt`:

1. When the user provides a page URL, read its Markdown mirror first; if unavailable, read the HTML body.
2. When the user provides only a slug, use the target site's `/docs/<slug>.md` and `/docs/<slug>`.
3. When the user provides neither, locate the page through the current site navigation or ask for the page URL; do not query Volcengine Ark or BytePlus and present the result as ByteCloud fact.
4. When a full-site corpus or an offline knowledge base is needed, state clearly that the site has no bulk documentation entry point; do not recursively crawl the site.

<a id="evidence-check"></a>
## Evidence checks

- **Site**: URLs must belong to the target official site; do not mix facts from another site into the same conclusion. Gather evidence separately for Volcengine Ark, BytePlus ModelArk, and ByteCloud sites.
- **Content**: Exclude empty text, login pages, 404s, navigation-only pages, and content that contains only search summaries.
- **Relevance**: The title or body must directly address the question; a coincidental keyword match does not support the conclusion.
- **Contract strength**: Use the current API spec or API reference as the primary source for API fields; use the relevant topic document as the primary source for product behavior and limits; official examples only prove the usage shown in the example.
- **Freshness**: Volatile facts such as model status, pricing, quotas, rate limits, and version support must come from currently accessible official content. When update times are available, prefer newer and more specific sources.
- **Conflicts**: When sources conflict, list the conflict points and each URL; choose one only when you can determine applicability from site, version, publication date, or contract level.
- **Account boundary**: Account resources, Endpoint status, discounts, bills, usage, permissions, and real invocation results are not public documentation facts. Hand them to the appropriate control-plane tool or explain that an account-state query is required.

## Output requirements

- Answer directly at the beginning; then give necessary steps, limitations, or uncertainties.
- In "Sources", list the titles and URLs of documents actually read, keeping at most the sources needed to support the conclusion; do not list search results you did not read.
- Distinguish documentation facts from recommendations. Label inferences as "recommendation" or "inference" and state the basis.
- When the user asks for code, use only fields and invocation patterns confirmed in the body, API spec, or official examples.
- If repeated searches find nothing, list the target site, keywords tried, and entry points used; do not fill the answer with similar but unrelated documents.
