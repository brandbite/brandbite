// -----------------------------------------------------------------------------
// @file: lib/tools/public-tools.ts
// @purpose: The free tools anyone can open without an account, in the three
//           groups the footer and the public /tools page show. Names, icons
//           and one-line descriptions come from the hub registry
//           (lib/tools/registry.ts), so a tool is described in one place.
// -----------------------------------------------------------------------------

import { HUB_TOOLS, type ToolIconKey } from "./registry";

export type PublicToolTone = "peach" | "sage" | "lavender";

export type PublicTool = {
  id: string;
  label: string;
  href: string;
  description: string;
  icon: ToolIconKey;
};

export type PublicToolGroup = {
  id: string;
  title: string;
  note: string;
  tone: PublicToolTone;
  tools: PublicTool[];
};

/** A registry tool under the name the public pages use for it. */
function tool(id: string, label: string): PublicTool {
  const found = HUB_TOOLS.find((item) => item.id === id);
  if (!found || typeof found.href !== "string") {
    throw new Error(`Public tool "${id}" needs a registry entry with one public path.`);
  }
  return { id, label, href: found.href, description: found.description, icon: found.icon };
}

export const PUBLIC_TOOL_GROUPS: PublicToolGroup[] = [
  {
    id: "design",
    title: "Design & brand",
    note: "Build your brand once, use it everywhere.",
    tone: "peach",
    tools: [
      tool("color-studio", "Color Studio"),
      tool("type-scale", "Type Scale"),
      tool("logo-pack", "Logo Pack"),
      tool("brand-kit", "Brand Kit"),
      // Shows Not found while the owner's "Brand playlist generator" switch is off.
      tool("brand-playlist", "Brand Playlist"),
    ],
  },
  {
    id: "images",
    title: "Images & social",
    note: "Prepare visuals for every screen and platform.",
    tone: "sage",
    tools: [
      tool("mockup-studio", "Mockup Studio"),
      tool("social-resizer", "Social Resizer"),
      tool("image-converter", "Image Converter"),
      tool("qr-code", "QR Code"),
      tool("post-preview", "Post Preview"),
      tool("size-guide", "Size Guide"),
    ],
  },
  {
    id: "writing",
    title: "Writing & planning",
    note: "Say it clearly and plan what to ask for.",
    tone: "lavender",
    tools: [
      tool("brief-generator", "Brief Generator"),
      tool("newsletter-builder", "Newsletter Builder"),
      tool("email-signature", "Email Signature"),
      tool("cost-calculator", "Cost Calculator"),
    ],
  },
];

/** Tile and glyph colors for a group: the role colours' peach, sage and lavender. */
export const PUBLIC_TOOL_TONES: Record<PublicToolTone, { tile: string; glyph: string }> = {
  peach: { tile: "bg-[#FFE9DF]", glyph: "text-[#C2410C]" },
  sage: { tile: "bg-[#E3F1E4]", glyph: "text-[#1F6B3A]" },
  lavender: { tile: "bg-[#ECE4FF]", glyph: "text-[#4C1D95]" },
};
