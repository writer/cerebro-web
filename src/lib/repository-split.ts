export type RepositorySplitOwner = "public_app" | "private_overlay" | "deployment";

export type RepositorySplitPrinciple = {
  id: string;
  label: string;
  detail: string;
};

export type RepositorySplitSurface = {
  id: string;
  label: string;
  owner: RepositorySplitOwner;
  purpose: string;
  publicRepo: string;
  privateRepo: string;
  deploymentRepo: string;
  guardrail: string;
  paths: string[];
};

export const repositorySplitSummary = {
  publicAppRepo: "writer/cerebro-web",
  privateOverlayRepo: "internal web overlay",
  deploymentRepo: "internal Cerebro deployment repository",
  releaseBridge: "published web image plus documented environment/API contracts",
};

export const repositorySplitOwnerLabels: Record<RepositorySplitOwner, string> = {
  public_app: "Public app",
  private_overlay: "Private overlay",
  deployment: "Deploy",
};

export const repositorySplitOwnerOrder: RepositorySplitOwner[] = [
  "public_app",
  "private_overlay",
  "deployment",
];

export const repositorySplitPrinciples: RepositorySplitPrinciple[] = [
  {
    id: "app-first",
    label: "App source is public by default",
    detail:
      "Shared console behavior, generic GRC navigation, API proxy contracts, OpenAPI-driven resource views, tests, and release-image build logic belong in the public app repo.",
  },
  {
    id: "private-overlay",
    label: "Private code is an overlay",
    detail:
      "Writer-only producer registries, private labels, private source mappings, and internal-only console copy belong in the private web overlay when they are part of the app experience.",
  },
  {
    id: "deploy-elsewhere",
    label: "Deployment stays out of the app",
    detail:
      "Cloud stacks, hostnames, auth listener wiring, secrets, source runtime schedules, image promotion, and operational verification belong in the internal deployment repo.",
  },
];

export const repositorySplitSurfaces: RepositorySplitSurface[] = [
  {
    id: "operator-shell",
    label: "Operator console shell",
    owner: "public_app",
    purpose: "Read-only navigation, page layout, UI primitives, status panels, and generic GRC workflows.",
    publicRepo: "Authoritative for shared routes, components, loading/error states, and API-backed behavior.",
    privateRepo: "May adjust private copy only when the wording depends on Writer-specific context.",
    deploymentRepo: "Consumes the built image and supplies runtime environment values.",
    guardrail: "Do not fork shared UI to encode stack-specific deployment choices.",
    paths: ["src/app/*", "src/components/*", "src/lib/grc.ts"],
  },
  {
    id: "api-contract",
    label: "Cerebro API contract and proxy",
    owner: "public_app",
    purpose: "Browser-safe API base configuration, server-side proxy behavior, OpenAPI loading, and route health.",
    publicRepo: "Owns proxy semantics, config variable names, auth-header forwarding behavior, and OpenAPI resource rendering.",
    privateRepo: "May pass private credentials through deployment-provided environment only.",
    deploymentRepo: "Owns actual credential material, hostnames, tenant routing, and protected ingress.",
    guardrail: "No committed private endpoints, tokens, tenant IDs, or auth-provider wiring in the app repo.",
    paths: ["src/app/api/*", "src/lib/cerebro-client.ts", "src/lib/openapi*.ts"],
  },
  {
    id: "source-readiness",
    label: "Connector readiness UI",
    owner: "public_app",
    purpose: "Generic connector library, credential flow, source runtime health, freshness, cursor, graph-ingest, and connector-readiness presentation.",
    publicRepo: "Owns health normalization and generic readiness language such as healthy, poor, bad, and needs refresh.",
    privateRepo: "May add Writer-specific source names, producer mappings, or private coverage notes.",
    deploymentRepo: "Owns concrete source runtime definitions, schedules, secret references, and post-deploy verification.",
    guardrail: "Runtime IDs and schedules are deployment data unless they are synthetic examples.",
    paths: ["src/app/connectors/*", "src/app/mission-control/page.tsx", "src/lib/connectors.ts", "src/lib/mission-control.ts"],
  },
  {
    id: "security-producers",
    label: "Security producer registry",
    owner: "private_overlay",
    purpose: "Private producer coverage views that join console UI to Writer-only source/runtime/tool ownership.",
    publicRepo: "Provides an empty-by-default, environment-driven schema for generic deployments.",
    privateRepo: "Owns hardcoded Writer-only producer registries, private repositories, runtime IDs, source IDs, and coverage notes.",
    deploymentRepo: "Owns whether those runtimes exist in a stack and when they sync.",
    guardrail: "Never copy private producer names, runtime IDs, or coverage notes into the public app repo.",
    paths: ["src/app/developer/security-producers/*", "src/lib/security-producers.ts"],
  },
  {
    id: "developer-evals",
    label: "Developer eval tooling",
    owner: "public_app",
    purpose: "Local-only Ask eval reports, trace links, fixture readers, and deterministic quality checks.",
    publicRepo: "Owns local eval harness behavior and sanitized fixture contracts.",
    privateRepo: "May run private goldens locally, but raw live rows and private traces stay out of commits.",
    deploymentRepo: "Does not own eval UI; it can provide deployed runtime access through approved operator workflows.",
    guardrail: "Live-derived data must be syntheticized before it becomes a public fixture.",
    paths: ["src/app/developer/evals/*", "src/components/evals/*", "scripts/eval-*.mjs"],
  },
  {
    id: "release-image",
    label: "Web image release",
    owner: "public_app",
    purpose: "Build, test, scan, sign, and publish the web console image from app source.",
    publicRepo: "Owns the Dockerfile and public release workflow that publishes a source-linked image.",
    privateRepo: "May publish a private overlay image when private app code is present.",
    deploymentRepo: "Pins, mirrors, promotes, deploys, and verifies the chosen image.",
    guardrail: "The app repo may notify deployment automation, but stack manifests and promotion policy stay in the deployment repo.",
    paths: ["Dockerfile", ".github/workflows/release.yml"],
  },
  {
    id: "deployment-manifests",
    label: "Deployment manifests and operations",
    owner: "deployment",
    purpose: "Environment-specific stack configuration, ingress, identity, source runtimes, schedules, secrets, alarms, and verification.",
    publicRepo: "May contain placeholder-only examples and documented configuration variables.",
    privateRepo: "Should not accumulate stack manifests; it owns private app overlay code, not runtime deployment.",
    deploymentRepo: "Authoritative for real manifests, promotion workflows, rollout plans, rollback, and operational checks.",
    guardrail: "Real deploy manifests do not belong in either web app repository.",
    paths: ["infra/*", "Pulumi.*.yaml", "deploy/*", "manifests/*"],
  },
];

export const deployOwnedItems = [
  "cloud account, region, and network topology",
  "ingress hostnames, DNS, listener auth, and trusted proxy settings",
  "registry mirrors, image promotion, and stack pinning",
  "secret names, secret paths, API keys, and OIDC provider wiring",
  "source runtime instances, schedules, tenant assignment, and verification jobs",
  "alarms, dashboards, rollout plans, rollback plans, and closeout/backfill operations",
];

export const publicRepoForbiddenItems = [
  "private producer repository names or runtime IDs",
  "tenant, account, hostname, secret, or environment identifiers",
  "real stack manifests, Pulumi stack config, Helm values, or Kubernetes overlays",
  "private rollout, backfill, closeout, or deployment verification details",
  "raw live graph rows, private traces, or unsyntheticized eval fixtures",
];
