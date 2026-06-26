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

## Information-First UX

- Build Cerebro screens like status and evidence surfaces, not product taxonomy explainers. The first viewport should show what Cerebro knows: risks, controls, evidence, owners, affected assets, sources, reports, and recent changes.
- Do not make users choose or learn a "persona", "lens", "mode", "decision frame", or other internal product construct before they get value. These terms should not appear in end-user UI unless a user-created object explicitly uses that name.
- Prefer Vanta-style information architecture: concrete counts, pass/fail status, missing evidence, stale sources, owners, due dates, affected assets, and direct drilldowns.
- Navigation labels should be stable information areas such as Home, Risks, Controls, Evidence, Inventory, Affected assets, Graph, Reports, and Sources. The page content should carry the value before navigation does.
- Ask surfaces should offer concrete information-retrieval questions, for example "Which risks have no owner?", "Which controls are failing?", "Which evidence is missing or stale?", and "What changed since last week?"
- Avoid abstract copy such as "material exposure", "executive agenda", "blast radius", "workbench", "focused entry points", and repeated Cerebro-branded explanations. Use the user's nouns and the graph facts instead.
- When changing the first screen, verify desktop and mobile screenshots for clipped text, overlap, empty-shell loading captures, console overlays, and accidental reintroduction of internal taxonomy language.
