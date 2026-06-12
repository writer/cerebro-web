export type NavigationEntry = {
  label: string;
  href: string;
  description: string;
  section: "Operator" | "Advanced" | "Workflow";
  keywords: string[];
};

export const operatorNavLinks: NavigationEntry[] = [
  {
    label: "Home",
    href: "/",
    description: "Compliance progress, risk, evidence, and connector health.",
    section: "Operator",
    keywords: ["dashboard", "overview", "metrics", "home"],
  },
  {
    label: "Risk inbox",
    href: "/risk-inbox",
    description: "Triage findings by severity, owner, entity, SLA, and evidence.",
    section: "Operator",
    keywords: ["findings", "risk", "sla", "triage", "owner"],
  },
  {
    label: "Ask Cerebro",
    href: "/ask",
    description: "Ask the graph in natural language. Cypher is drafted, validated, run, and cited.",
    section: "Operator",
    keywords: ["ask", "graph", "cypher", "nlq", "query", "search"],
  },
  {
    label: "Controls",
    href: "/controls",
    description: "Control posture, failing objectives, and mapped findings.",
    section: "Operator",
    keywords: ["soc2", "iso", "framework", "control", "audit"],
  },
  {
    label: "Evidence",
    href: "/evidence",
    description: "Evidence register linked to findings, rules, runs, and graph roots.",
    section: "Operator",
    keywords: ["claims", "events", "proof", "audit"],
  },
  {
    label: "Inventory",
    href: "/inventory",
    description: "Browse assets, owners, scope, tests, vulnerabilities, and graph context.",
    section: "Operator",
    keywords: ["assets", "inventory", "resources", "scope", "tests", "vulnerabilities"],
  },
  {
    label: "Impact map",
    href: "/impact",
    description: "Entity impact graph and related risk blast radius.",
    section: "Operator",
    keywords: ["graph", "entity", "impact", "blast radius"],
  },
  {
    label: "Reports",
    href: "/reports",
    description: "Build audit packets with evidence, controls, and impact proof.",
    section: "Operator",
    keywords: ["audit packet", "export", "report", "evidence"],
  },
  {
    label: "Data connectors",
    href: "/connectors",
    description: "Source runtime freshness and ingestion health.",
    section: "Operator",
    keywords: ["runtimes", "sources", "connectors", "freshness"],
  },
];

export const utilityLinks: NavigationEntry[] = [
  {
    label: "Developer Tools",
    href: "/developer",
    description: "API status, OpenAPI resources, and developer utilities.",
    section: "Advanced",
    keywords: ["openapi", "status", "developer", "api"],
  },
  {
    label: "Operations",
    href: "/workflows",
    description: "Source, runtime, finding, report, and graph workflow explorers.",
    section: "Advanced",
    keywords: ["workflow", "operations", "explorer"],
  },
];

export const workflowLinks: NavigationEntry[] = [
  {
    label: "Security event timeline",
    href: "/workflows/timeline",
    description: "Replay and inspect canonical security finding events.",
    section: "Workflow",
    keywords: ["timeline", "events", "workflow", "event registry"],
  },
  {
    label: "Workflow sources",
    href: "/workflows/sources",
    description: "Explore source catalog operations.",
    section: "Workflow",
    keywords: ["sources", "catalog", "workflow"],
  },
  {
    label: "Workflow runtimes",
    href: "/workflows/runtimes",
    description: "Explore runtime configuration and sync workflows.",
    section: "Workflow",
    keywords: ["runtimes", "sync", "workflow"],
  },
  {
    label: "Workflow findings",
    href: "/workflows/findings",
    description: "Explore finding operations and evaluations.",
    section: "Workflow",
    keywords: ["findings", "evaluation", "workflow"],
  },
  {
    label: "Workflow reports",
    href: "/workflows/reports",
    description: "Explore report definition and run APIs.",
    section: "Workflow",
    keywords: ["reports", "runs", "workflow"],
  },
  {
    label: "Workflow graph",
    href: "/workflows/graph",
    description: "Explore graph neighborhood and impact APIs.",
    section: "Workflow",
    keywords: ["graph", "impact", "workflow"],
  },
];

export const navigationEntries = [
  ...operatorNavLinks,
  ...utilityLinks,
  ...workflowLinks,
];
