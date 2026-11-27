// -----------------------------------------------------------------------------
// @file: lib/tools/registry.ts
// @purpose: The one list of hub tools. The sidebar "Tools" section, the
//           "All tools" pages and (later) the Home tools grid and the Pro
//           check all read from here, so adding a tool is one entry.
//
//           status  live     built and linked
//                   soon     next in the build order; shown without a link
//                   planned  approved but further out; never shown
//           access  free | pro (plan or separate purchase) | tokens (per use)
// -----------------------------------------------------------------------------

export type ToolRole = "customer" | "creative";
export type ToolStatus = "live" | "soon" | "planned";
export type ToolAccess = "free" | "pro" | "tokens";
export type ToolCategory = "brand" | "create" | "requests" | "plan";

export type ToolIconKey =
  | "brandGuide"
  | "colorStudio"
  | "brandKit"
  | "playlist"
  | "gradient"
  | "typeScale"
  | "logoPack"
  | "signature"
  | "newsletter"
  | "qr"
  | "mockup"
  | "ai"
  | "copy"
  | "moodboards"
  | "resizer"
  | "postPreview"
  | "converter"
  | "sizes"
  | "templates"
  | "comments"
  | "compare"
  | "delivery"
  | "animation"
  | "brief"
  | "calculator";

export type HubTool = {
  /** Stable id; safe to store (pins, usage, entitlements). */
  id: string;
  name: string;
  /** One short line for cards. */
  description: string;
  category: ToolCategory;
  icon: ToolIconKey;
  status: ToolStatus;
  access: ToolAccess;
  /** Who the tool is for. */
  roles: ToolRole[];
  /** Where it opens: one path for everyone, or one per role. Live tools need one per role. */
  href?: string | Partial<Record<ToolRole, string>>;
  /** Roles that get this tool in the sidebar, under "All tools". Live tools only. */
  pinned?: ToolRole[];
  /** Opens inside a request, on its files, rather than as its own page. */
  inRequest?: boolean;
};

export const TOOL_CATEGORIES: { id: ToolCategory; label: string; note: string }[] = [
  { id: "brand", label: "Brand", note: "Build your brand once, use it everywhere." },
  { id: "create", label: "Create", note: "Make and prepare visuals and copy yourself." },
  { id: "requests", label: "Requests", note: "These open inside a request, on its files." },
  { id: "plan", label: "Plan and budget", note: "Decide what to ask for and what it is worth." },
];

const BOTH: ToolRole[] = ["customer", "creative"];

export const HUB_TOOLS: HubTool[] = [
  // ---- Brand ----------------------------------------------------------------
  {
    id: "brand-guide",
    name: "Brand guide",
    description: "Colors, logo, fonts and voice in one place",
    category: "brand",
    icon: "brandGuide",
    status: "live",
    access: "free",
    roles: ["customer"],
    href: "/customer/brand",
  },
  {
    id: "color-studio",
    name: "Color Studio",
    description: "Palettes, contrast checks, saved colors",
    category: "brand",
    icon: "colorStudio",
    status: "live",
    access: "free",
    roles: BOTH,
    href: "/colors",
    pinned: BOTH,
  },
  {
    id: "brand-kit",
    name: "Brand kit",
    description: "A starter kit of colors and fonts",
    category: "brand",
    icon: "brandKit",
    status: "live",
    access: "free",
    roles: ["customer"],
    href: "/brand-kit",
  },
  {
    id: "brand-playlist",
    name: "Brand playlist",
    description: "A playlist that sounds like your brand",
    category: "brand",
    icon: "playlist",
    status: "live",
    access: "free",
    roles: ["customer"],
    href: "/brand-playlist",
  },
  {
    id: "gradient-generator",
    name: "Gradient generator",
    description: "Gradients from your colors, as CSS or image",
    category: "brand",
    icon: "gradient",
    status: "live",
    access: "free",
    roles: BOTH,
    href: "/colors/gradient-generator",
  },
  {
    id: "qr-code",
    name: "QR code",
    description: "QR codes in your brand colors, with your logo",
    category: "brand",
    icon: "qr",
    status: "live",
    access: "free",
    roles: ["customer"],
    href: "/qr-code",
  },
  {
    id: "type-scale",
    name: "Type scale",
    description: "Heading and body sizes that fit together",
    category: "brand",
    icon: "typeScale",
    status: "live",
    access: "free",
    roles: BOTH,
    href: "/type-scale",
  },
  {
    id: "logo-pack",
    name: "Logo pack",
    description: "PNG, favicon, profile image, color, black and white",
    category: "brand",
    icon: "logoPack",
    status: "live",
    // One PNG is free; the full pack comes with a plan (lib/tools/entitlement.ts).
    access: "free",
    roles: ["customer"],
    href: "/logo-pack",
  },
  {
    id: "email-signature",
    name: "Email signature",
    description: "A signature in your brand color, with your logo",
    category: "brand",
    icon: "signature",
    status: "live",
    access: "free",
    roles: ["customer"],
    href: "/email-signature",
  },

  // ---- Create ---------------------------------------------------------------
  {
    id: "ai-tools",
    name: "AI Tools",
    description: "Generate text and images, edit photos",
    category: "create",
    icon: "ai",
    status: "live",
    access: "tokens",
    roles: ["customer"],
    href: "/customer/ai-tools",
    pinned: ["customer"],
  },
  {
    id: "moodboards",
    name: "Moodboards",
    description: "Collect references and directions",
    category: "create",
    icon: "moodboards",
    status: "live",
    access: "free",
    roles: BOTH,
    href: { customer: "/customer/moodboards", creative: "/creative/moodboards" },
  },
  {
    id: "size-guide",
    name: "Size guide",
    description: "Every social media image size",
    category: "create",
    icon: "sizes",
    status: "live",
    access: "free",
    roles: BOTH,
    href: "/sizes",
  },
  {
    id: "templates",
    name: "Templates",
    description: "Free design and marketing templates",
    category: "create",
    icon: "templates",
    status: "live",
    access: "free",
    roles: ["customer"],
    href: "/templates",
  },
  {
    id: "mockup-studio",
    name: "Mockup Studio",
    description: "Your screenshot on a 3D phone, tablet or laptop",
    category: "create",
    icon: "mockup",
    status: "live",
    // Free at 1080p; 4K without the mark comes with a plan (lib/tools/entitlement.ts).
    access: "free",
    roles: BOTH,
    href: "/mockups",
    pinned: ["customer"],
  },
  {
    id: "social-resizer",
    name: "Social resizer",
    description: "One image cropped to every platform size",
    category: "create",
    icon: "resizer",
    status: "live",
    access: "free",
    roles: BOTH,
    href: "/social-resizer",
  },
  {
    id: "image-converter",
    name: "Image converter",
    description: "Convert and compress PNG, JPG and WebP",
    category: "create",
    icon: "converter",
    status: "live",
    access: "free",
    roles: BOTH,
    href: "/image-converter",
  },
  {
    id: "brand-voice-copy",
    name: "Brand-voice copy",
    description: "Captions, slogans and ad copy in your voice",
    category: "create",
    icon: "copy",
    status: "live",
    // Included with a plan, a set number of runs a day (lib/brand-copy/copy.ts).
    access: "pro",
    roles: ["customer"],
    href: "/customer/tools/brand-voice-copy",
  },
  {
    id: "newsletter-builder",
    name: "Newsletter builder",
    description: "An email newsletter in your brand, ready to send",
    category: "create",
    icon: "newsletter",
    status: "live",
    // Free to build; writing with AI and image upload come with a plan.
    access: "free",
    roles: ["customer"],
    href: "/newsletter-builder",
  },
  {
    id: "post-preview",
    name: "Post and ad preview",
    description: "See a visual and its caption inside a feed or story",
    category: "create",
    icon: "postPreview",
    status: "live",
    access: "free",
    roles: BOTH,
    href: "/post-preview",
  },

  // ---- Requests -------------------------------------------------------------
  {
    id: "image-comments",
    name: "Comments on the image",
    description: "Pin notes right on the design",
    category: "requests",
    icon: "comments",
    status: "planned",
    access: "free",
    roles: BOTH,
    inRequest: true,
  },
  {
    id: "version-compare",
    name: "Version compare",
    description: "Two revisions side by side with a slider",
    category: "requests",
    icon: "compare",
    status: "planned",
    access: "free",
    roles: BOTH,
    inRequest: true,
  },
  {
    id: "delivery-package",
    name: "Delivery package",
    description: "Every size and format in one zip",
    category: "requests",
    icon: "delivery",
    status: "planned",
    access: "free",
    roles: ["creative"],
    inRequest: true,
  },
  {
    id: "animation-preview",
    name: "Animation preview",
    description: "Play Lottie and video files in place",
    category: "requests",
    icon: "animation",
    status: "planned",
    access: "free",
    roles: BOTH,
    inRequest: true,
  },
  {
    id: "present-with-mockup",
    name: "Present with mockup",
    description: "Show a delivery on a device",
    category: "requests",
    icon: "mockup",
    status: "live",
    access: "free",
    roles: BOTH,
    // Opens from an image in a request ("Show on a device"); the card leads to the requests.
    href: { customer: "/customer/board", creative: "/creative/board" },
    inRequest: true,
  },

  // ---- Plan and budget ------------------------------------------------------
  {
    id: "brief-generator",
    name: "Brief generator",
    description: "Turn an idea into a clear brief",
    category: "plan",
    icon: "brief",
    status: "live",
    access: "free",
    roles: ["customer"],
    href: "/brief-generator",
  },
  {
    id: "cost-calculator",
    name: "Cost calculator",
    description: "What the same work costs at an agency",
    category: "plan",
    icon: "calculator",
    status: "live",
    access: "free",
    roles: ["customer"],
    href: "/design-cost-calculator",
  },
];

/** Where the "All tools" page lives for a role. */
export function allToolsHref(role: ToolRole): string {
  return `/${role}/tools`;
}

/** The tool's link for a role, or null when it has none (not built yet, or not for that role). */
export function toolHref(tool: HubTool, role: ToolRole): string | null {
  if (tool.status !== "live" || !tool.roles.includes(role) || !tool.href) return null;
  return typeof tool.href === "string" ? tool.href : (tool.href[role] ?? null);
}

/** Tools a role can see: live and soon, never planned. */
export function toolsForRole(role: ToolRole): HubTool[] {
  return HUB_TOOLS.filter((tool) => tool.roles.includes(role) && tool.status !== "planned");
}

/** Live tools a role gets in the sidebar. */
export function pinnedTools(role: ToolRole): HubTool[] {
  return HUB_TOOLS.filter(
    (tool) => tool.status === "live" && tool.pinned?.includes(role) && toolHref(tool, role),
  );
}

/** A role's visible tools by category, in category order; empty categories are left out. */
export function toolGroups(
  role: ToolRole,
): { category: (typeof TOOL_CATEGORIES)[number]; tools: HubTool[] }[] {
  const visible = toolsForRole(role);
  return TOOL_CATEGORIES.map((category) => ({
    category,
    tools: visible
      .filter((tool) => tool.category === category.id)
      .sort((a, b) => Number(a.status !== "live") - Number(b.status !== "live")),
  })).filter((group) => group.tools.length > 0);
}
