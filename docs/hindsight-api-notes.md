# Hindsight API integration notes

Verified against the official Hindsight API reference and Node.js SDK documentation on 2026-09-28.

- API reference: https://hindsight.vectorize.io/api-reference
- Retain guide: https://hindsight.vectorize.io/developer/api/retain
- Recall guide: https://hindsight.vectorize.io/developer/api/recall
- Node.js SDK guide: https://hindsight.vectorize.io/sdks/nodejs

## Retain

`POST {HINDSIGHT_BASE_URL}/v1/default/banks/{bank_id}/memories`

The request body used by FieldMind is:

```json
{
  "async": false,
  "items": [
    {
      "content": "...",
      "context": "field-service resolution",
      "timestamp": "2026-09-28T00:00:00.000Z",
      "document_id": "fieldmind-resolution-<incident-id>",
      "metadata": { "equipmentId": "P-204", "source": "fieldmind" },
      "tags": ["fieldmind-demo-<session-id>"]
    }
  ]
}
```

The service checks `success` and `items_count`. A failed request returns `unavailable` and is not presented as a retained memory.

## Recall

`POST {HINDSIGHT_BASE_URL}/v1/default/banks/{bank_id}/memories/recall`

The request body used by FieldMind contains:

```json
{
  "query": "...",
  "types": ["world", "experience", "observation"],
  "prefer_observations": true,
  "budget": "mid",
  "max_tokens": 2600,
  "query_timestamp": "2026-09-28T00:00:00.000Z",
  "tags": ["fieldmind-demo-<session-id>"],
  "tags_match": "all_strict"
}
```

Recall results are mapped only when a result has an Hindsight `id` and `text`. The UI shows the returned text, type, context, timestamps, document ID, tags, metadata, and a deterministic explanation of which query terms matched the returned fact. No relevance or confidence number is invented.

## Authentication

FieldMind sends `Authorization: Bearer ${HINDSIGHT_API_KEY}` from the Express server only. The browser receives only the normalized memory evidence and provider status.
