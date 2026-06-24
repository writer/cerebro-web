import { describe, expect, it } from "vitest";

import { isSidebarLinkActive } from "./Sidebar";

const links = [
  { href: "/trends" },
  { href: "/trends/dashboards" },
  { href: "/developer" },
];

describe("isSidebarLinkActive", () => {
  it("prefers the most specific visible sidebar route", () => {
    expect(isSidebarLinkActive("/trends/dashboards", "/trends", links)).toBe(false);
    expect(isSidebarLinkActive("/trends/dashboards", "/trends/dashboards", links)).toBe(true);
  });

  it("keeps parent routes active for unmatched child paths", () => {
    expect(isSidebarLinkActive("/trends/unknown", "/trends", links)).toBe(true);
  });

  it("prefers the child route for deeper child paths", () => {
    expect(isSidebarLinkActive("/trends/dashboards/example", "/trends", links)).toBe(false);
    expect(isSidebarLinkActive("/trends/dashboards/example", "/trends/dashboards", links)).toBe(true);
  });
});
