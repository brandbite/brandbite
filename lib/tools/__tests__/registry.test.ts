import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getNavConfig } from "@/components/navigation/nav-config";
import { TOOL_ICONS } from "@/components/tools/tool-icons";
import {
  allToolsHref,
  HUB_TOOLS,
  pinnedTools,
  TOOL_CATEGORIES,
  toolGroups,
  toolHref,
  toolsForRole,
  type ToolRole,
} from "../registry";

const ROLES: ToolRole[] = ["customer", "creative"];

function pageExists(href: string): boolean {
  const dir = join(process.cwd(), "app", ...href.split("/").filter(Boolean));
  return existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "page.ts"));
}

describe("hub tool registry", () => {
  it("has unique ids, a known category and an icon for every tool", () => {
    const ids = HUB_TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = TOOL_CATEGORIES.map((category) => category.id);
    for (const tool of HUB_TOOLS) {
      expect(categories, tool.id).toContain(tool.category);
      expect(TOOL_ICONS[tool.icon], tool.id).toBeTypeOf("function");
      expect(tool.roles.length, tool.id).toBeGreaterThan(0);
    }
  });

  it("links every live tool, for each of its roles, to a page that exists", () => {
    for (const tool of HUB_TOOLS.filter((t) => t.status === "live")) {
      for (const role of tool.roles) {
        const href = toolHref(tool, role);
        expect(href, `${tool.id} for ${role}`).toBeTruthy();
        expect(pageExists(href!), `${tool.id} → ${href}`).toBe(true);
      }
    }
  });

  it("never links a tool that is not built, or to a role it is not for", () => {
    for (const tool of HUB_TOOLS) {
      for (const role of ROLES) {
        if (tool.status !== "live" || !tool.roles.includes(role)) {
          expect(toolHref(tool, role), `${tool.id} for ${role}`).toBeNull();
        }
      }
    }
  });

  it("never sends a role into another role's dashboard", () => {
    for (const role of ROLES) {
      const other = role === "customer" ? "/creative" : "/customer";
      for (const tool of toolsForRole(role)) {
        expect(toolHref(tool, role)?.startsWith(other) ?? false, tool.id).toBe(false);
      }
    }
  });

  it("hides planned tools and keeps live ones ahead of soon ones in each group", () => {
    for (const role of ROLES) {
      expect(toolsForRole(role).some((tool) => tool.status === "planned")).toBe(false);
      for (const group of toolGroups(role)) {
        const statuses = group.tools.map((tool) => tool.status);
        expect(statuses, `${role} ${group.category.id}`).toEqual(
          [...statuses].sort((a, b) => Number(a !== "live") - Number(b !== "live")),
        );
      }
    }
  });

  it("only pins live tools, and only for roles they are for", () => {
    for (const tool of HUB_TOOLS) {
      for (const role of tool.pinned ?? []) {
        expect(tool.status, tool.id).toBe("live");
        expect(tool.roles, tool.id).toContain(role);
      }
    }
  });

  it("feeds the sidebar: All tools first, then the pinned tools", () => {
    for (const role of ROLES) {
      const section = getNavConfig(role).sections.find((s) => s.label === "Tools");
      expect(section?.items.map((item) => item.href)).toEqual([
        allToolsHref(role),
        ...pinnedTools(role).map((tool) => toolHref(tool, role)),
      ]);
      expect(pageExists(allToolsHref(role))).toBe(true);
    }
  });
});
