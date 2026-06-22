/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FindingTable from "@/components/grc/FindingTable";
import type { GRCFinding } from "@/lib/grc";

vi.mock("@/components/ask/AskAboutLink", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

function finding(overrides: Partial<GRCFinding> & { id: string; title: string }): GRCFinding {
  return {
    severity: "HIGH",
    status: "open",
    evidence_count: 0,
    owner: "team",
    sla_status: "on_track",
    risk_score: 50,
    entity: "urn:test:entity",
    ...overrides,
  };
}

const sample: GRCFinding[] = [
  finding({ id: "f-alpha", title: "Alpha finding", risk_score: 90 }),
  finding({ id: "f-beta", title: "Beta finding", risk_score: 70 }),
  finding({ id: "f-gamma", title: "Gamma finding", risk_score: 30 }),
];

describe("FindingTable", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders one row per finding for small lists", async () => {
    await act(async () => {
      root.render(<FindingTable findings={sample} />);
    });

    const titleLinks = container.querySelectorAll('a[href^="/findings/"]');
    expect(titleLinks).toHaveLength(3);
    expect(container.textContent).toContain("Alpha finding");
    expect(container.textContent).toContain("Gamma finding");
  });

  it("renders the empty state when there are no findings", async () => {
    await act(async () => {
      root.render(<FindingTable findings={[]} empty="Nothing here." />);
    });
    expect(container.textContent).toContain("Nothing here.");
    expect(container.querySelector("table")).toBeNull();
  });

  it("toggles a single finding when selectable", async () => {
    const onToggleSelect = vi.fn();
    await act(async () => {
      root.render(
        <FindingTable
          findings={sample}
          selectable
          selectedIds={new Set<string>()}
          onToggleSelect={onToggleSelect}
        />,
      );
    });

    const rowCheckbox = container.querySelector<HTMLInputElement>(
      'input[aria-label="Select Beta finding"]',
    );
    expect(rowCheckbox).not.toBeNull();
    await act(async () => {
      rowCheckbox!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(onToggleSelect).toHaveBeenCalledWith("f-beta");
  });

  it("select-all targets every finding id", async () => {
    const onToggleSelectAll = vi.fn();
    await act(async () => {
      root.render(
        <FindingTable
          findings={sample}
          selectable
          selectedIds={new Set<string>()}
          onToggleSelectAll={onToggleSelectAll}
        />,
      );
    });

    const selectAll = container.querySelector<HTMLInputElement>(
      'input[aria-label="Select all findings"]',
    );
    expect(selectAll).not.toBeNull();
    await act(async () => {
      selectAll!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(onToggleSelectAll).toHaveBeenCalledTimes(1);
    const [ids, selected] = onToggleSelectAll.mock.calls[0];
    expect([...ids].sort()).toEqual(["f-alpha", "f-beta", "f-gamma"]);
    expect(selected).toBe(true);
  });
});
