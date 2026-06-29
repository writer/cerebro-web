# Cerebro Web Agent Instructions

## Core Commands

- Lint: `npm run lint`
- Unit tests: `npm run test`
- Production build: `npm run build`
- Local Cerebro proxy dev server: `npm run dev:local:cerebro`

## Public and Internal Repository Split

- `origin` points to the public repository, `writer/cerebro-web`. Treat all code, PR metadata, comments, commit messages, and check summaries there as public internet content.
- `internal` points to the private repository, `WriterInternal/cerebro-web`. Use it for Writer-specific product surfaces, deployment context, operational GRC/security workflows, and anything that needs private environment or rollout details.
- Do not put tenant names, internal environment names, hostnames, account IDs, graph counts, finding examples, resource labels, URNs, operational endpoints, deployment details, or closeout/backfill details in the public repo or public PR metadata.
- Public PR descriptions should stay high-level: summarize UI/code intent, tests run, and non-sensitive compatibility notes only.
- Put sensitive analysis, rollout notes, validation counts, environment-specific observations, and operational closeout plans in internal channels or private PRs.
- Before creating, editing, or merging a public PR, re-read the title, body, comments, and check summaries for concrete customer, infrastructure, security-finding, or environment data.

## Split Workflow Discipline

- Do not assume `writer/cerebro-web` and `WriterInternal/cerebro-web` have linear history. Compare both remotes and PRs explicitly before rebasing, pushing, or declaring a split current.
- When a feature is safe for public release, land it in the public repo with public-safe metadata, then mirror or reconcile the internal repo as needed.
- When a feature depends on private Writer data, internal deployment behavior, private endpoints, or sensitive operational context, keep it scoped to the internal repo.
- If the public branch was deleted after merge, do not recreate it unless there is a new public change to publish.
- Use `--force-with-lease` only after confirming the expected remote ref and that no collaborator work will be overwritten.

## Repository Conventions

- Prefer existing components, tokens, and data-fetching patterns over introducing new UI frameworks or state libraries.
- Keep changes scoped to the triggering issue or PR. Avoid drive-by redesigns or dependency changes.
- Do not expose secrets, secret names, credential material, or sensitive runtime identifiers in logs, UI copy, tests, screenshots, or PR metadata.
- After code changes, run the relevant validators, usually `npm run lint`, `npm run test`, and `npm run build`.

## API Defaults And Inventory Requests

- Do not rely on omitted backend query parameters when a page needs a narrower view than the public API default. Send the narrowing parameter explicitly.
- Inventory defaults to the Assets view in the UI. Requests for that default view must send `surface=asset`; omitted `surface` means all records on the backend.
- Keep inventory request defaults in `src/lib` helpers with unit tests before changing API filter behavior.

## Information-First UX

- Build Cerebro screens like status and evidence surfaces, not product taxonomy explainers. The first viewport should show what Cerebro knows: risks, controls, evidence, owners, affected assets, sources, reports, and recent changes.
- Do not make users choose or learn a "persona", "lens", "mode", "decision frame", or other internal product construct before they get value. These terms should not appear in end-user UI unless a user-created object explicitly uses that name.
- Prefer information architecture built around concrete counts, pass/fail status, missing evidence, stale sources, owners, due dates, affected assets, and direct drilldowns.
- Navigation labels should be stable information areas such as Home, Risks, Controls, Evidence, Inventory, Affected assets, Graph, Reports, and Sources. The page content should carry the value before navigation does.
- Ask surfaces should offer concrete information-retrieval questions, for example "Which risks have no owner?", "Which controls are failing?", "Which evidence is missing or stale?", and "What changed since last week?"
- Avoid abstract copy such as "material exposure", "executive agenda", "blast radius", "workbench", "focused entry points", and repeated Cerebro-branded explanations. Use the user's nouns and the graph facts instead.
- When changing the first screen, verify desktop and mobile screenshots for clipped text, overlap, empty-shell loading captures, console overlays, and accidental reintroduction of internal taxonomy language.

## Graph-Scale UI Design

- Assume Cerebro pages sit on a large security and compliance graph. Findings, evidence, controls, assets, vendors, policies, sources, events, claims, runs, and graph paths can reach thousands of records; never design these surfaces as if all items fit on one screen.
- Before choosing a layout for a graph-backed page, inspect the existing API contract, fixtures, query limits, or available graph metadata to understand likely cardinality, record shape, and drilldown paths. Do not invent a small sample shape and then design around it.
- Default high-volume pages to bounded worklists: server-side filters, explicit request limits, search over loaded rows, sortable tables, result-count copy, and clear export paths. Use card grids only for small summary sets, repeated dashboards, or genuinely visual objects.
- For list pages, show the operator what is loaded versus what exists when metadata is available. Copy should say concrete states such as "Showing first N findings", "Showing N of M controls", or "Export loaded CSV"; avoid implying the page contains the full graph when it does not.
- Do not load every related collection for a page just because it is nearby in the workflow. Split register, triage, upload, export, and detail work into active sections so the first screen requests and renders the smallest useful graph slice.
- Use progressive disclosure for graph records: first show totals, health states, top blockers, owner gaps, freshness, severity, or readiness; then provide row detail, side panels, linked detail pages, packet exports, and graph-neighborhood views.
- Large graph neighborhoods should be summarized and filtered before visualization. Cap rendered nodes and edges, show hidden/filtered counts, support search and type/risk filters, and link to inventory, evidence, impact, and ask flows for the selected node.
- Filters must map to graph facts users recognize: tenant, source, runtime, framework, control, owner, severity, status, SLA, asset class, freshness, evidence type, and graph root. Prefer concrete nouns over internal pipeline terms.
- Empty, loading, partial, and permission-denied states must be useful at scale. A loading state should not render dozens of placeholder boxes; a partial state should explain the loaded scope, cap, missing source, or retry action.
- Keep public PR metadata high level when graph scale informed the design. Do not include concrete graph counts, resource labels, URNs, tenant details, source identifiers, or environment observations in public titles, bodies, comments, screenshots, or check summaries.
