---
schema: 1
title: "A cache miss, step by step"
subtitle: "The database remains the source of truth; the cache shortens the next read."
theme: blueprint
---
## Follow one request

```sequence
participants:
  client: {label: "Client", kind: client}
  api: {label: "API", kind: service}
  cache: {label: "Cache", kind: database}
  database: {label: "Database", kind: database}
messages:
  - {id: request, from: client, to: api, label: "1 · GET /items/42"}
  - {id: lookup, from: api, to: cache, label: "2 · GET item:42"}
  - {id: miss, from: cache, to: api, label: "3 · MISS", kind: response}
  - {id: query, from: api, to: database, label: "4 · SELECT item", note: "id = 42"}
  - {id: result, from: database, to: api, label: "5 · row", kind: response}
  - {id: fill, from: api, to: cache, label: "6 · SET item:42", note: "TTL = 60s"}
  - {id: response, from: api, to: client, label: "7 · 200 OK", kind: response}
```

The cache lookup may fail independently. Decide whether the API can still read the database and make that fallback visible in metrics.
