# Knowledge Sources

Place raw domain/product/business knowledge here. These files are **source-of-truth inputs** that get compiled into `data/product_knowledge.json` for fast runtime querying.

## Suggested Subfolders
- `products/`  Product catalogs, material specs, sizing charts.
- `faq/`       Customer and internal FAQ markdown / NDJSON.
- `ops/`       Operational SOPs, packaging, fulfillment notes.
- `embeddings/` (optional) Precomputed vector representations.

## Supported File Types (initial)
| Type | Description | Parsing Behavior |
|------|-------------|------------------|
| `.md` | Markdown knowledge docs | Split into sections by `##` / `###` headings; each becomes a chunk. |
| `.txt` | Plain text | Single chunk (or split by blank lines if large). |
| `.json` | Structured objects | Each top-level object or array element becomes an entry. |
| `.csv` | Tabular product data | Rows become product entries; header row required. |
| `.ndjson` | Line-delimited JSON | Each line parsed separately. |

## Build
Run the knowledge compiler (to be added) to regenerate the unified runtime file:

```
node training/scripts/build-knowledge.js
```

This writes/updates `data/product_knowledge.json`.

## Conventions
- Provide a short heading or title for markdown sections.
- Keep product catalogs normalized: columns like `name,category,price,materials,description`.
- Avoid secrets. A safety filter will skip lines containing likely secrets (API keys, tokens).

## Roadmap
- Add embeddings generation step.
- Introduce stale detection (rebuild only when source changed).
- Vector similarity search integration.
