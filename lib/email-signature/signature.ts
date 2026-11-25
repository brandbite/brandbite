// -----------------------------------------------------------------------------
// @file: lib/email-signature/signature.ts
// @purpose: Builds an email signature as HTML that mail apps keep intact:
//           tables and inline styles only, web-safe fonts, every value
//           escaped. Six templates share the same details and differ in how
//           they arrange them. Pure.
// -----------------------------------------------------------------------------

export type SignatureTemplate = "classic" | "stacked" | "card" | "banner" | "minimal" | "compact";

export const SIGNATURE_TEMPLATES: {
  id: SignatureTemplate;
  label: string;
  note: string;
  /** Whether the template has a place for a logo. */
  logo: boolean;
}[] = [
  { id: "classic", label: "Classic", note: "Logo beside your details", logo: true },
  { id: "stacked", label: "Stacked", note: "Logo on top", logo: true },
  { id: "card", label: "Card", note: "Name on a color block", logo: true },
  { id: "banner", label: "Banner", note: "Large name, a rule under it", logo: true },
  { id: "minimal", label: "Minimal", note: "Text only", logo: false },
  { id: "compact", label: "Compact", note: "One or two lines", logo: false },
];

/** Fonts every mail app has. A brand's own web font would not arrive in the recipient's inbox. */
export const SIGNATURE_FONTS = [
  { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { id: "georgia", label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  { id: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { id: "tahoma", label: "Tahoma", stack: "Tahoma, Geneva, sans-serif" },
] as const;

export type SignatureFontId = (typeof SIGNATURE_FONTS)[number]["id"];

export type SignatureSize = "small" | "medium" | "large";

export const SIGNATURE_SIZES: { id: SignatureSize; label: string; scale: number }[] = [
  { id: "small", label: "Small", scale: 0.9 },
  { id: "medium", label: "Medium", scale: 1 },
  { id: "large", label: "Large", scale: 1.15 },
];

export const LOGO_HEIGHTS: { id: SignatureSize; label: string; pixels: number }[] = [
  { id: "small", label: "Small", pixels: 40 },
  { id: "medium", label: "Medium", pixels: 56 },
  { id: "large", label: "Large", pixels: 76 },
];

export type SignatureData = {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  /** One more line: an address, a tagline, working hours. */
  extra: string;
  linkedin: string;
  instagram: string;
  x: string;
  /** A public https address of the logo; mail apps drop pictures that are embedded in the text. */
  logoUrl: string;
  logoSize: SignatureSize;
  accent: string;
  font: SignatureFontId;
  size: SignatureSize;
  template: SignatureTemplate;
};

export const EMPTY_SIGNATURE: SignatureData = {
  name: "",
  title: "",
  company: "",
  phone: "",
  email: "",
  website: "",
  extra: "",
  linkedin: "",
  instagram: "",
  x: "",
  logoUrl: "",
  logoSize: "medium",
  accent: "#fe5000",
  font: "arial",
  size: "medium",
  template: "classic",
};

/** Stand-in details for the template thumbnails, used for any field still empty. */
export const SAMPLE_SIGNATURE: Pick<
  SignatureData,
  "name" | "title" | "company" | "phone" | "email" | "website"
> = {
  name: "Your Name",
  title: "Job title",
  company: "Company",
  phone: "+1 555 010 0100",
  email: "you@company.com",
  website: "company.com",
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A hex color as typed, or the default when it isn't one. Nothing else may reach a style. */
export function safeColor(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim().toLowerCase() : EMPTY_SIGNATURE.accent;
}

/** An http(s) address, or null. Keeps javascript: and other schemes out of links and images. */
export function safeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** "https://www.acme.com/" → "acme.com", for showing a website. */
export function displayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

/** Why a logo address won't work in a signature, or null when it will (or is empty). */
export function logoUrlProblem(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const url = safeUrl(value);
  if (!url) return "That doesn't look like a web address.";
  if (!url.startsWith("https://")) return "Use an address that starts with https://.";
  return null;
}

export function hasContent(data: SignatureData): boolean {
  return [data.name, data.title, data.company, data.phone, data.email, data.website].some((value) =>
    value.trim(),
  );
}

/** White or near-black, whichever reads better on a color. */
function textOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#292827" : "#ffffff";
}

const TEXT = "#292827";
const MUTED = "#5c5f66";
const TABLE = '<table cellpadding="0" cellspacing="0" border="0" role="presentation"';

/** The pieces every template is built from, already escaped and styled. */
function parts(data: SignatureData, options: SignatureOptions) {
  const accent = safeColor(data.accent);
  const font = (SIGNATURE_FONTS.find((f) => f.id === data.font) ?? SIGNATURE_FONTS[0]).stack;
  const scale = (SIGNATURE_SIZES.find((s) => s.id === data.size) ?? SIGNATURE_SIZES[1]).scale;
  const px = (base: number) => Math.round(base * scale);
  /** A text style: font, size and a line height that follows the size. */
  const style = (base: number, color: string, extra = "") =>
    `font-family:${font};font-size:${px(base)}px;line-height:${px(base * 1.5)}px;color:${color};${extra}`;
  const link = (href: string, label: string, color: string) =>
    `<a href="${escapeHtml(href)}" style="color:${color};text-decoration:none;">${escapeHtml(label)}</a>`;

  const name = data.name.trim();
  const role = [data.title.trim(), data.company.trim()].filter(Boolean).join(" · ");

  const contact: string[] = [];
  const phone = data.phone.trim();
  if (phone) {
    const digits = phone.replace(/[^\d+]/g, "");
    contact.push(digits ? link(`tel:${digits}`, phone, MUTED) : escapeHtml(phone));
  }
  const email = data.email.trim();
  if (email) contact.push(link(`mailto:${email}`, email, MUTED));
  const website = safeUrl(data.website);
  if (website) contact.push(link(website, displayUrl(website), accent));

  const social = (
    [
      ["LinkedIn", data.linkedin],
      ["Instagram", data.instagram],
      ["X", data.x],
    ] as const
  ).flatMap(([label, value]) => {
    const url = safeUrl(value);
    return url ? [link(url, label, accent)] : [];
  });

  const template =
    SIGNATURE_TEMPLATES.find((t) => t.id === data.template) ?? SIGNATURE_TEMPLATES[0];
  const logoUrl = template.logo && !logoUrlProblem(data.logoUrl) ? safeUrl(data.logoUrl) : null;
  const logoHeight = (LOGO_HEIGHTS.find((h) => h.id === data.logoSize) ?? LOGO_HEIGHTS[1]).pixels;
  const logo = logoUrl
    ? `<img src="${escapeHtml(options.logoSrc ? options.logoSrc(logoUrl) : logoUrl)}" alt="${escapeHtml(data.company.trim() || name || "Logo")}" height="${logoHeight}" style="display:block;height:${logoHeight}px;width:auto;border:0;">`
    : null;

  return {
    accent,
    style,
    px,
    name: escapeHtml(name),
    role: escapeHtml(role),
    extra: escapeHtml(data.extra.trim()),
    contact,
    social,
    logo,
  };
}

const row = (style: string, content: string) => `<tr><td style="${style}">${content}</td></tr>`;

/** The signature as HTML to paste into a mail app. */
export type SignatureOptions = {
  /**
   * Where the on-page preview loads the logo from, given its real address.
   * The signature that is copied or downloaded never uses this.
   */
  logoSrc?: (url: string) => string;
};

/** The address the preview loads a logo through (app/api/tools/signature-logo). */
export function previewLogoSrc(url: string): string {
  return `/api/tools/signature-logo?url=${encodeURIComponent(url)}`;
}

export function signatureHtml(data: SignatureData, options: SignatureOptions = {}): string {
  const p = parts(data, options);
  const { accent, style } = p;

  /** Name, role, contact lines, extra line and social links, one under the other. */
  const details = (nameColor = TEXT, roleColor = accent) => {
    const rows: string[] = [];
    if (p.name) rows.push(row(style(16, nameColor, "font-weight:bold;"), p.name));
    if (p.role) rows.push(row(style(13, roleColor, "padding-bottom:6px;"), p.role));
    for (const line of p.contact) rows.push(row(style(13, MUTED), line));
    if (p.extra) rows.push(row(style(13, MUTED), p.extra));
    if (p.social.length)
      rows.push(row(style(13, MUTED, "padding-top:4px;"), p.social.join(" &nbsp;·&nbsp; ")));
    return `${TABLE}>${rows.join("")}</table>`;
  };
  const inline = (items: string[]) => items.join(' <span style="color:#b4b2ae;">|</span> ');

  switch (data.template) {
    case "stacked": {
      const top = p.logo ? `<tr><td style="padding-bottom:10px;">${p.logo}</td></tr>` : "";
      return `${TABLE}>${top}<tr><td style="border-top:2px solid ${accent};padding-top:10px;">${details()}</td></tr></table>`;
    }

    case "card": {
      const on = textOn(accent);
      const block: string[] = [];
      if (p.logo) block.push(`<tr><td style="padding-bottom:8px;">${p.logo}</td></tr>`);
      if (p.name) block.push(row(style(16, on, "font-weight:bold;"), p.name));
      if (p.role) block.push(row(style(13, on), p.role));
      const side: string[] = [];
      for (const line of p.contact) side.push(row(style(13, MUTED), line));
      if (p.extra) side.push(row(style(13, MUTED), p.extra));
      if (p.social.length)
        side.push(row(style(13, MUTED, "padding-top:4px;"), p.social.join(" &nbsp;·&nbsp; ")));
      return `${TABLE}><tr><td valign="middle" bgcolor="${accent}" style="background-color:${accent};padding:14px 16px;">${TABLE}>${block.join("")}</table></td><td valign="middle" style="padding:10px 0 10px 16px;">${TABLE}>${side.join("")}</table></td></tr></table>`;
    }

    case "banner": {
      const rows: string[] = [];
      if (p.logo) rows.push(`<tr><td style="padding-bottom:8px;">${p.logo}</td></tr>`);
      if (p.name) rows.push(row(style(22, accent, "font-weight:bold;"), p.name));
      if (p.role)
        rows.push(
          row(style(13, TEXT, `padding-bottom:8px;border-bottom:1px solid #e4e2dd;`), p.role),
        );
      const below = [...p.contact, ...(p.extra ? [p.extra] : [])];
      if (below.length) rows.push(row(style(13, MUTED, "padding-top:8px;"), inline(below)));
      if (p.social.length)
        rows.push(row(style(13, MUTED, "padding-top:4px;"), p.social.join(" &nbsp;·&nbsp; ")));
      return `${TABLE}>${rows.join("")}</table>`;
    }

    case "minimal":
      return details(TEXT, MUTED);

    case "compact": {
      const first = [
        p.name ? `<span style="font-weight:bold;color:${TEXT};">${p.name}</span>` : "",
        p.role ? `<span style="color:${accent};">${p.role}</span>` : "",
      ].filter(Boolean);
      const second = [...p.contact, ...(p.extra ? [p.extra] : []), ...p.social];
      const rows: string[] = [];
      if (first.length) rows.push(row(style(14, TEXT), first.join(" &nbsp;·&nbsp; ")));
      if (second.length) rows.push(row(style(13, MUTED), inline(second)));
      return `${TABLE}>${rows.join("")}</table>`;
    }

    case "classic":
    default: {
      const bar = `border-left:3px solid ${accent};padding-left:14px;`;
      if (!p.logo) return `${TABLE}><tr><td style="${bar}">${details()}</td></tr></table>`;
      return `${TABLE}><tr><td valign="middle" style="padding-right:14px;">${p.logo}</td><td valign="middle" style="${bar}">${details()}</td></tr></table>`;
    }
  }
}

/** The same signature as plain text, for mail apps that send without formatting. */
export function signatureText(data: SignatureData): string {
  const website = safeUrl(data.website);
  const social = (
    [
      ["LinkedIn", data.linkedin],
      ["Instagram", data.instagram],
      ["X", data.x],
    ] as const
  ).flatMap(([label, value]) => {
    const url = safeUrl(value);
    return url ? [`${label}: ${url}`] : [];
  });
  return [
    data.name.trim(),
    [data.title.trim(), data.company.trim()].filter(Boolean).join(" · "),
    data.phone.trim(),
    data.email.trim(),
    website ? displayUrl(website) : "",
    data.extra.trim(),
    ...social,
  ]
    .filter(Boolean)
    .join("\n");
}

/** `data` with sample details in every empty field, for showing a template before anything is typed. */
export function withSampleDetails(data: SignatureData): SignatureData {
  if (hasContent(data)) return data;
  return { ...data, ...SAMPLE_SIGNATURE };
}
