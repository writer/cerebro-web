const routeLabels: Record<string, string> = {
  "/": "Overview",
  "/ask": "Ask console",
  "/risk-inbox": "Risk inbox",
  "/findings": "Finding detail",
  "/impact": "Impact map",
  "/evidence": "Evidence register",
  "/controls": "Controls",
  "/connectors/builder": "Connector builder",
  "/connectors": "Connectors",
  "/developer": "Developer Tools",
  "/developer/evals": "Ask evals",
  "/developer/security-producers": "Security producers",
  "/inventory": "Inventory",
  "/reports": "Reports",
};

const matchesRoute = (pathname: string, route: string) =>
  pathname === route || (route !== "/" && pathname.startsWith(`${route}/`));

export function routeLabelForPath(pathname: string) {
  const match = Object.keys(routeLabels)
    .filter((route) => matchesRoute(pathname, route))
    .sort((left, right) => right.length - left.length)[0];
  if (match) return routeLabels[match];
  return pathname.split("/").filter(Boolean).at(-1)?.replace(/-/g, " ") ?? "Cerebro";
}
