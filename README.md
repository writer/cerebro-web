# Cerebro Web

Cerebro Web is a read-only Next.js console for a Cerebro API. It provides UI surfaces for sources, runtimes, findings, reports, workflow metadata, graph projections, and Ask/LLM-backed graph queries.

## Status

Maintained by WRITER on a best-effort basis. There are no support SLAs.

## Cross-Repo Contract

Cerebro Web mirrors the app-vs-deploy split used by Cerebro runtime:

- `writer/cerebro-web` is authoritative for the read-only console app, shared UI behavior, generic source-readiness views, API proxy semantics, OpenAPI rendering, tests, and the source-linked web image.
- The private web overlay is for Writer-only app data such as private producer registries, private labels, and private source/runtime mappings that would be unsafe or irrelevant in public.
- The internal Cerebro deployment repository owns real deployment manifests, stack configuration, hostnames, identity wiring, source runtime schedules, secret references, image promotion, rollout, rollback, and operational verification.

The handoff from this repo is the published web image plus documented environment/API contracts. Real deploy manifests do not belong in either web app repository; public examples must remain placeholder-only. The in-app contract lives at `/developer/repository-split` and the typed source of truth is `src/lib/repository-split.ts`.

## Requirements

- Node.js 22+
- npm
- A running Cerebro API, defaulting to `http://localhost:8080`

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CEREBRO_API_BASE` | Browser-visible API base URL. Defaults to `http://localhost:8080`. |
| `CEREBRO_API_BASE` | Server-side proxy API base URL override. |
| `CEREBRO_API_KEY`, `CEREBRO_API_TOKEN`, `CEREBRO_X_API_KEY`, `CEREBRO_API_KEYS` | Server-side API key configuration. |
| `CEREBRO_BEARER_TOKEN` | Server-side bearer token configuration. |
| `CEREBRO_FORWARD_AUTH_HEADERS` | Set to `true` to forward request auth headers instead of server-side credentials. |
| `CEREBRO_PROXY_TIMEOUT_MS` | Proxy timeout for long-running requests. |
| `CEREBRO_PROXY_CACHE_TTL_MS` | Proxy cache TTL; set to `0` to disable local proxy caching. |
| `CEREBRO_PROXY_CACHE_STALE_MS` | Proxy stale-if-error window after the local proxy cache TTL expires. |
| `OPENAI_API_KEY` | Enables the platform-wide Cerebro AI agent. Without it, Ask falls back to the existing `/grc/ask` stream. |
| `CEREBRO_AGENT_MODEL` | Optional OpenAI model override for the Cerebro AI agent. Defaults to `gpt-5.4-mini`. |
| `CEREBRO_MCP_URL` | Optional Cerebro MCP Streamable HTTP endpoint. Defaults to `/api/v1/mcp` on `CEREBRO_API_BASE`. |
| `CEREBRO_MCP_BEARER_TOKEN`, `CEREBRO_MCP_TOKEN` | Optional bearer token used specifically for Cerebro MCP. |

`/api/cerebro/*` keeps a small process-local cache for high-traffic GRC reads. Responses expose `x-cerebro-cache` for the web proxy cache state and `x-cerebro-upstream-cache` when the API also reports a shared backend cache state. Manual refreshes send `Cache-Control: no-cache` through the proxy so the API can bypass both layers.

## Observability

Server-side API proxy and agent routes emit structured JSON span/event lines to stderr with `service=cerebro-web`. The proxy generates or continues W3C `traceparent`, forwards it to Cerebro API and MCP calls, and returns `x-cerebro-web-trace-id` on responses. The Ask agent `done.trace_id` is the same web trace id.

Telemetry is intentionally bounded. It records route family, method, status, cache state, retry attempts, upstream host, and error kind/fingerprint. It does not log request bodies, authorization headers, API keys, cookies, full URLs, or query strings.

Focused checks:

```bash
npm run test -- src/lib/observability.test.ts src/lib/cerebro-proxy.test.ts
```

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

To point the app at a local Cerebro runtime:

```bash
npm run dev:local:cerebro
```

## Validation

```bash
npm test
npm run lint
npm run build
npm run oss:audit
npm run audit:high
```

Optional local end-to-end validation:

```bash
npm run e2e:grc:local
```

Optional Ask evaluation checks:

```bash
npm run eval:ask:local
npm run eval:ask:adversarial
```

## Security

Do not open public issues for vulnerabilities. Report suspected security issues privately to security@writer.com.

## License

Licensed under the MIT License. See `LICENSE`.
