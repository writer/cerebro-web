import { describe, expect, it } from "vitest";

import {
  AGENT_PLATFORM_CONTRACT_VERSION,
  AGENT_PLATFORM_DOMAINS,
  AGENT_PLATFORM_INVARIANTS,
  agentPlatformDomainById,
} from "./agent-platform-contract";

describe("agent platform contract", () => {
  it("keeps a stable public-safe contract version", () => {
    expect(AGENT_PLATFORM_CONTRACT_VERSION).toBe("2026-06-16.cerebro-agent-platform");
  });

  it("covers the Cerebro agent platform domains", () => {
    expect(AGENT_PLATFORM_DOMAINS.map((domain) => domain.id)).toEqual([
      "runtime",
      "evals",
      "capabilities",
      "execution",
      "streaming-replay",
      "connectors",
      "knowledge",
    ]);

    for (const domain of AGENT_PLATFORM_DOMAINS) {
      expect(domain.name).toBeTruthy();
      expect(domain.principle).toBeTruthy();
      expect(domain.consoleSurface).toBeTruthy();
      expect(domain.diagnostics.length).toBeGreaterThan(0);
    }
  });

  it("keeps invariants unique and attached to known domains", () => {
    const ids = new Set<string>();

    for (const invariant of AGENT_PLATFORM_INVARIANTS) {
      expect(ids.has(invariant.id)).toBe(false);
      ids.add(invariant.id);
      expect(agentPlatformDomainById(invariant.domainId)).toBeTruthy();
      expect(invariant.statement).toBeTruthy();
    }
  });
});
