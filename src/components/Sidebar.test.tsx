import { describe, expect, it } from "vitest";

import { operatorNavLinks, utilityLinks } from "@/lib/navigation";

import { hasSidebarIcon, isSidebarLinkActive } from "./Sidebar";

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

  it("has icons for visible sidebar routes", () => {
    const missingIcons = [...operatorNavLinks, ...utilityLinks]
      .filter((link) => !hasSidebarIcon(link.href))
      .map((link) => link.href);

    expect(missingIcons).toEqual([]);
  });
});
