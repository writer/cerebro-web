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
| `CEREBRO_IDENTITY_PROFILE` | Identity source profile: `auto`, `local`, `okta-proxy`, `cloudflare-access`, `auth-proxy`, `azure-client-principal`, or `oidc-bearer`. |
| `CEREBRO_IDENTITY_REQUIRED` | Set to `true` to fail closed when current-user identity is missing, conflicting, local fallback, or unverified. Defaults to required in production except the `local` profile. |
| `CEREBRO_TRUSTED_IDENTITY_HEADERS` | Optional comma-separated allowlist of upstream identity headers. Overrides profile defaults. |
| `CEREBRO_IDENTITY_ISSUER`, `CEREBRO_IDENTITY_AUDIENCE` | Expected JWT issuer and audience claim checks. |
| `CEREBRO_IDENTITY_JWKS_URL` | JWKS endpoint used to verify JWT signatures for accepted identity tokens. |
| `CEREBRO_AUTHZ_REQUIRED_GROUPS`, `CEREBRO_AUTHZ_REQUIRED_ROLES`, `CEREBRO_AUTHZ_REQUIRED_SCOPES` | Optional global entitlement requirements for protected app actions. |
| `CEREBRO_AUTHZ_READ_*`, `CEREBRO_AUTHZ_WRITE_*`, `CEREBRO_AUTHZ_AGENT_*`, `CEREBRO_AUTHZ_IDENTITY_*` | Optional per-surface entitlement requirements, using `_GROUPS`, `_ROLES`, or `_SCOPES` suffixes. |
| `OPENAI_API_KEY` | Enables the platform-wide Cerebro AI agent. Without it, Ask falls back to the existing `/grc/ask` stream. |
| `CEREBRO_AGENT_MODEL` | Optional OpenAI model override for the Cerebro AI agent. Defaults to `gpt-5.4-mini`. |
| `CEREBRO_MCP_URL` | Optional Cerebro MCP Streamable HTTP endpoint. Defaults to `/api/v1/mcp` on `CEREBRO_API_BASE`. |
| `CEREBRO_MCP_BEARER_TOKEN`, `CEREBRO_MCP_TOKEN` | Optional bearer token used specifically for Cerebro MCP. |
| `NEXT_PUBLIC_CEREBRO_WEB_VERSION`, `NEXT_PUBLIC_APP_VERSION`, `CEREBRO_WEB_VERSION`, `APP_VERSION`, `RELEASE_VERSION`, `IMAGE_TAG` | Build-time version stamp for the sidebar. Without an explicit value, local builds fall back to Git metadata and then `package.json`. |

`/api/cerebro/*` keeps a small process-local cache for high-traffic GRC reads. Responses expose `x-cerebro-cache` for the web proxy cache state and `x-cerebro-upstream-cache` when the API also reports a shared backend cache state. Manual refreshes send `Cache-Control: no-cache` through the proxy so the API can bypass both layers.

`/api/identity/health` reports the active identity profile, trusted-header contract, JWT verification posture, and whether the current request is blocked, degraded, or ready.

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
