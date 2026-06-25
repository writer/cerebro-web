import { describe, expect, it } from "vitest";

import { navigationEntries } from "./navigation";
import { DEFAULT_PERSONA_LENS_ID, personaLenses, routeHrefsForLens, routeIsAvailable } from "./persona-lenses";

describe("persona lenses", () => {
  it("has unique IDs and labels", () => {
    const ids = personaLenses.map((lens) => lens.id);
    const labels = personaLenses.map((lens) => lens.label);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
    expect(ids).toContain(DEFAULT_PERSONA_LENS_ID);
  });

  it("points every lens route at a known navigation entry", () => {
    for (const lens of personaLenses) {
      const hrefs = routeHrefsForLens(lens);
      expect(hrefs.length, `${lens.label} should expose routes`).toBeGreaterThan(0);
      expect(new Set(hrefs).size, `${lens.label} should not duplicate routes`).toBe(hrefs.length);
      for (const href of hrefs) {
        expect(routeIsAvailable(href), `${lens.label} references ${href}`).toBe(true);
      }
    }
  });

  it("keeps core graph and GRC surfaces reachable through at least one lens", () => {
    const assignedRoutes = new Set(personaLenses.flatMap(routeHrefsForLens));
    const coreRoutes = navigationEntries
      .filter((entry) => entry.section === "Operator")
      .map((entry) => entry.href);

    for (const href of coreRoutes) {
      expect(assignedRoutes.has(href), `${href} should belong to at least one persona lens`).toBe(true);
    }
  });

  it("separates the first-read routes by persona priority", () => {
    const byID = Object.fromEntries(personaLenses.map((lens) => [lens.id, lens]));

    expect(byID.security.primaryRoutes.map((route) => route.href)).toEqual(
      expect.arrayContaining(["/risk-inbox", "/impact", "/ask"]),
    );
    expect(byID.compliance.primaryRoutes.map((route) => route.href)).toEqual(
      expect.arrayContaining(["/controls", "/frameworks", "/evidence", "/reports"]),
    );
    expect(byID.platform.primaryRoutes.map((route) => route.href)).toEqual(
      expect.arrayContaining(["/connectors", "/inventory", "/explore"]),
    );
    expect(byID.leadership.primaryRoutes.map((route) => route.href)).toEqual(
      expect.arrayContaining(["/trends", "/trends/dashboards", "/reports"]),
    );
  });
});
