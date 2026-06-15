import { describe, expect, it } from "vitest";

import { humanize } from "./grc";

describe("humanize", () => {
  it("preserves infrastructure acronyms", () => {
    expect(humanize("aws_sso")).toBe("AWS SSO");
    expect(humanize("gcp_api_url")).toBe("GCP API URL");
    expect(humanize("account_id")).toBe("Account ID");
  });
});
