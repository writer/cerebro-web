/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import DataTable from "./DataTable";

describe("DataTable", () => {
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

  const renderedNames = () =>
    Array.from(container.querySelectorAll("tbody tr"))
      .map((row) => row.querySelector("td")?.textContent?.trim())
      .filter(Boolean);

  it("sorts loaded rows through the TanStack row model", async () => {
    await act(async () => {
      root.render(
        <DataTable
          columns={[{ key: "name", label: "Name" }]}
          pageSize={10}
          rows={[
            { id: "beta", name: "Beta" },
            { id: "alpha", name: "Alpha" },
          ]}
        />,
      );
    });

    expect(renderedNames()).toEqual(["Beta", "Alpha"]);

    await act(async () => {
      container.querySelector<HTMLButtonElement>("thead button")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(renderedNames()).toEqual(["Alpha", "Beta"]);
  });
});
