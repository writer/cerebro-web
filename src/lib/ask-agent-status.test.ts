import { describe, expect, it } from "vitest";

import { ASK_AGENT_FALLBACK_STATUS } from "./ask-agent-status";

describe("ask agent status copy", () => {
  it("keeps fallback status user-facing and configuration-free", () => {
    const text = JSON.stringify(ASK_AGENT_FALLBACK_STATUS);

    expect(ASK_AGENT_FALLBACK_STATUS).toMatchObject({
      stage: "fallback",
      label: "Using Graph Ask",
      detail: "Graph Ask is handling this request.",
      mode: "legacy",
    });
    expect(text).not.toMatch(/env|token|credential|not configured/i);
  });
});
