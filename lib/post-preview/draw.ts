// -----------------------------------------------------------------------------
// @file: lib/post-preview/draw.ts
// @purpose: Draws a phone screen showing a post in a social feed, or a
//           full-screen story, on a canvas. One drawing serves the on-page
//           preview, the PNG download and the picture handed to Mockup
//           Studio. The screen follows the conventions feeds share (avatar,
//           name, picture, counts, actions); it carries no app's logo, name
//           or artwork.
// -----------------------------------------------------------------------------

import { coveredEdges, type Placement } from "./placements";
import { formatCount, SAMPLE_COMMENTS, type Engagement } from "./engagement";

/** A tall phone screen, three canvas pixels per point. */
export const SCREEN = { width: 1080, height: 2340 };

export type Picture = { image: CanvasImageSource; width: number; height: number };

export type PostScreen = {
  placement: Placement;
  picture: Picture | null;
  avatar: Picture | null;
  name: string;
  handle: string;
  caption: string;
  engagement: Engagement;
  showComments: boolean;
  ad: boolean;
  cta: string;
  dark: boolean;
  /** Shade the parts of a story the app's own buttons cover. Preview only. */
  showCovered: boolean;
};

type Theme = {
  bg: string;
  text: string;
  muted: string;
  line: string;
  soft: string;
  band: string;
};

const LIGHT: Theme = {
  bg: "#ffffff",
  text: "#111214",
  muted: "#6b7075",
  line: "#e4e5e7",
  soft: "#f1f2f4",
  band: "#eceef0",
};
const DARK: Theme = {
  bg: "#0e0f11",
  text: "#f2f3f5",
  muted: "#9a9ea6",
  line: "#26282d",
  soft: "#1c1e22",
  band: "#000000",
};

const FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const PAD = 48;
const W = SCREEN.width;

type Ctx = CanvasRenderingContext2D;

const font = (ctx: Ctx, size: number, weight = 400) => {
  ctx.font = `${weight} ${size}px ${FONT}`;
};

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draw a picture so it fills a box, cropped around its middle. */
function cover(ctx: Ctx, picture: Picture, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / picture.width, h / picture.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(
    picture.image,
    (picture.width - sw) / 2,
    (picture.height - sh) / 2,
    sw,
    sh,
    x,
    y,
    w,
    h,
  );
}

function drawAvatar(ctx: Ctx, s: PostScreen, cx: number, cy: number, r: number, ring?: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = s.avatar ? "#ffffff" : "#d9d6cf";
  ctx.fill();
  ctx.clip();
  if (s.avatar) {
    const box = r * 2 * 0.72;
    const scale = Math.min(box / s.avatar.width, box / s.avatar.height);
    const w = s.avatar.width * scale;
    const h = s.avatar.height * scale;
    ctx.drawImage(s.avatar.image, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = "#292827";
    font(ctx, r * 0.95, 600);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((s.name.trim()[0] ?? "Y").toUpperCase(), cx, cy + 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = ring ?? "rgba(0,0,0,0.12)";
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** Text cut to a width with an ellipsis. */
function fitText(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * Break text into lines of a width. `firstIndent` leaves room on the first
 * line (for a name drawn before it). Stops at `maxLines`; `cut` says whether
 * text was left over.
 */
export function wrapLines(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
  firstIndent = 0,
): { lines: string[]; cut: boolean } {
  const lines: string[] = [];
  const paragraphs = text.replace(/\r/g, "").split("\n");
  for (let p = 0; p < paragraphs.length; p++) {
    const words = paragraphs[p].split(/\s+/).filter(Boolean);
    let line = "";
    for (let i = 0; i < words.length; i++) {
      const room = maxWidth - (lines.length === 0 ? firstIndent : 0);
      let word = words[i];
      // A word longer than a whole line is broken.
      while (!line && measure(word) > room && word.length > 1) {
        let n = word.length - 1;
        while (n > 1 && measure(word.slice(0, n)) > room) n--;
        if (lines.length === maxLines - 1)
          return { lines: [...lines, word.slice(0, n)], cut: true };
        lines.push(word.slice(0, n));
        word = word.slice(n);
      }
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= maxWidth - (lines.length === 0 ? firstIndent : 0)) {
        line = next;
        continue;
      }
      if (lines.length === maxLines - 1) return { lines: [...lines, line], cut: true };
      lines.push(line);
      line = word;
    }
    if (lines.length === maxLines - 1 && p < paragraphs.length - 1) {
      const rest = paragraphs.slice(p + 1).some((para) => para.trim());
      return { lines: [...lines, line], cut: rest };
    }
    lines.push(line);
  }
  while (lines.length > 1 && !lines[lines.length - 1]) lines.pop();
  return { lines, cut: false };
}

// ---- small line icons, drawn in a 24-unit box --------------------------------

const ICONS = {
  heart:
    "M12 20.500S4 15.600 4 9.800A4.300 4.300 0 0 1 12 7.400 4.300 4.300 0 0 1 20 9.800C20 15.600 12 20.500 12 20.500Z",
  comment: "M4.500 5h15v11h-8.500l-4.500 3.500V16h-2Z",
  share: "M3.500 11.500 20.500 4l-6.500 16.500-2.700-6.800Z",
  save: "M6.500 4h11v16.500L12 16l-5.500 4.500Z",
  repeat: "M5 10V8a2 2 0 0 1 2-2h10l-2.500-2.500M19 14v2a2 2 0 0 1-2 2H7l2.500 2.500",
  home: "M4 11 12 4l8 7v9h-5.500v-5.500h-5V20H4Z",
  search: "M10.500 17a6.500 6.500 0 1 1 0-13 6.500 6.500 0 0 1 0 13Zm5-1.500L20.500 20.500",
  plus: "M5 5h14v14H5Zm7 3.500v7M8.500 12h7",
  play: "M5 5h14v14H5Zm5 3.500 5.500 3.500L10 15.500Z",
  close: "M6 6l12 12M18 6 6 18",
};

function icon(
  ctx: Ctx,
  d: string,
  x: number,
  y: number,
  size: number,
  color: string,
  fill = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = 1.7;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const path = new Path2D(d);
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }
  ctx.strokeStyle = color;
  ctx.stroke(path);
  ctx.restore();
}

function dots(ctx: Ctx, cx: number, cy: number, color: string) {
  ctx.fillStyle = color;
  for (const dx of [-18, 0, 18]) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function statusBar(ctx: Ctx, color: string) {
  ctx.fillStyle = color;
  font(ctx, 45, 600);
  ctx.fillText("9:41", 84, 96);
  // signal
  for (let i = 0; i < 4; i++) {
    roundRect(ctx, 822 + i * 15, 90 - i * 8 - 12, 9, 12 + i * 8, 2);
    ctx.fill();
  }
  // battery
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  roundRect(ctx, 918, 60, 72, 36, 10);
  ctx.stroke();
  roundRect(ctx, 924, 66, 48, 24, 5);
  ctx.fill();
  roundRect(ctx, 994, 71, 5, 14, 2);
  ctx.fill();
}

function media(ctx: Ctx, s: PostScreen, t: Theme, y: number, height: number) {
  ctx.fillStyle = t.soft;
  ctx.fillRect(0, y, W, height);
  if (s.picture) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, height);
    ctx.clip();
    cover(ctx, s.picture, 0, y, W, height);
    ctx.restore();
  } else {
    ctx.fillStyle = t.muted;
    font(ctx, 42);
    ctx.textAlign = "center";
    ctx.fillText("Your visual", W / 2, y + height / 2 + 14);
    ctx.textAlign = "left";
  }
}

function ctaStrip(ctx: Ctx, s: PostScreen, t: Theme, y: number): number {
  const h = 132;
  ctx.fillStyle = t.soft;
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = t.text;
  font(ctx, 42, 600);
  ctx.fillText(s.cta, PAD, y + 80);
  ctx.strokeStyle = t.text;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(W - PAD - 18, y + 48);
  ctx.lineTo(W - PAD, y + 66);
  ctx.lineTo(W - PAD - 18, y + 84);
  ctx.stroke();
  return y + h;
}

/** Name in bold, then text, wrapped; returns the y under the last line. */
function boldThenText(
  ctx: Ctx,
  t: Theme,
  bold: string,
  text: string,
  y: number,
  maxLines: number,
  size = 42,
): number {
  const lineHeight = Math.round(size * 1.38);
  font(ctx, size, 600);
  const boldWidth = bold ? ctx.measureText(`${bold} `).width : 0;
  font(ctx, size);
  const { lines, cut } = wrapLines(
    (v) => ctx.measureText(v).width,
    text,
    W - PAD * 2,
    maxLines,
    boldWidth,
  );
  lines.forEach((line, i) => {
    const baseline = y + lineHeight * i + size;
    let x = PAD;
    if (i === 0 && bold) {
      font(ctx, size, 600);
      ctx.fillStyle = t.text;
      ctx.fillText(bold, x, baseline);
      x += boldWidth;
      font(ctx, size);
    }
    ctx.fillStyle = t.text;
    const last = i === lines.length - 1 && cut;
    const room = W - PAD - x - (last ? ctx.measureText("… more").width : 0);
    const shown = last ? fitText(ctx, line, room).replace(/…$/, "") : line;
    ctx.fillText(shown, x, baseline);
    if (last) {
      ctx.fillStyle = t.muted;
      ctx.fillText("… more", x + ctx.measureText(shown).width, baseline);
    }
  });
  return y + lineHeight * Math.max(lines.length, 1) + 6;
}

function mediaHeight(placement: Placement): number {
  return Math.round((W * placement.height) / placement.width);
}

/** Picture-first post: header, picture, actions, likes, caption. */
function photoPost(ctx: Ctx, s: PostScreen, t: Theme, top: number): number {
  let y = top;
  drawAvatar(ctx, s, PAD + 48, y + 84, 48);
  ctx.fillStyle = t.text;
  font(ctx, 42, 600);
  ctx.fillText(fitText(ctx, s.handle, 700), 168, s.ad ? y + 74 : y + 98);
  if (s.ad) {
    ctx.fillStyle = t.muted;
    font(ctx, 36);
    ctx.fillText("Sponsored", 168, y + 120);
  }
  dots(ctx, W - PAD - 24, y + 84, t.text);
  y += 168;

  const h = mediaHeight(s.placement);
  media(ctx, s, t, y, h);
  y += h;
  if (s.ad) y = ctaStrip(ctx, s, t, y);

  icon(ctx, ICONS.heart, PAD - 6, y + 36, 78, t.text);
  icon(ctx, ICONS.comment, PAD + 108, y + 36, 78, t.text);
  icon(ctx, ICONS.share, PAD + 222, y + 36, 78, t.text);
  icon(ctx, ICONS.save, W - PAD - 72, y + 36, 78, t.text);
  y += 150;

  ctx.fillStyle = t.text;
  font(ctx, 42, 600);
  ctx.fillText(`${formatCount(s.engagement.likes)} likes`, PAD, y + 36);
  y += 60;

  if (s.caption.trim()) y = boldThenText(ctx, t, s.handle, s.caption, y, 2);

  if (s.engagement.comments > 0) {
    ctx.fillStyle = t.muted;
    font(ctx, 40);
    ctx.fillText(`View all ${formatCount(s.engagement.comments)} comments`, PAD, y + 46);
    y += 66;
    if (s.showComments) {
      for (const comment of SAMPLE_COMMENTS.slice(0, 2)) {
        y = boldThenText(ctx, t, comment.handle, comment.text, y, 1, 40);
      }
    }
  }
  ctx.fillStyle = t.muted;
  font(ctx, 33);
  ctx.fillText("2 hours ago", PAD, y + 40);
  return y + 72;
}

/** Text-first post: header, caption, picture, counts, labelled actions. */
function textPost(ctx: Ctx, s: PostScreen, t: Theme, top: number): number {
  let y = top;
  drawAvatar(ctx, s, PAD + 60, y + 96, 60);
  ctx.fillStyle = t.text;
  font(ctx, 45, 600);
  ctx.fillText(fitText(ctx, s.name, 660), 192, y + 84);
  ctx.fillStyle = t.muted;
  font(ctx, 36);
  ctx.fillText(fitText(ctx, s.ad ? "Sponsored" : `@${s.handle} · 2h`, 660), 192, y + 132);
  dots(ctx, W - PAD - 24, y + 90, t.muted);
  y += 186;

  if (s.caption.trim()) y = boldThenText(ctx, t, "", s.caption, y, 3) + 18;

  const h = mediaHeight(s.placement);
  media(ctx, s, t, y, h);
  y += h;
  if (s.ad) y = ctaStrip(ctx, s, t, y);

  // counts
  ctx.fillStyle = "#e0245e";
  ctx.beginPath();
  ctx.arc(PAD + 24, y + 60, 24, 0, Math.PI * 2);
  ctx.fill();
  icon(ctx, ICONS.heart, PAD + 9, y + 45, 30, "#ffffff", true);
  ctx.fillStyle = t.muted;
  font(ctx, 38);
  ctx.fillText(formatCount(s.engagement.likes), PAD + 62, y + 74);
  const right = [
    s.engagement.comments ? `${formatCount(s.engagement.comments)} comments` : "",
    s.engagement.shares ? `${formatCount(s.engagement.shares)} shares` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  ctx.textAlign = "right";
  ctx.fillText(right, W - PAD, y + 74);
  ctx.textAlign = "left";
  y += 114;
  ctx.fillStyle = t.line;
  ctx.fillRect(PAD, y, W - PAD * 2, 3);

  const actions: [string, string][] = [
    [ICONS.heart, "Like"],
    [ICONS.comment, "Comment"],
    [ICONS.repeat, "Repost"],
    [ICONS.share, "Send"],
  ];
  font(ctx, 38, 600);
  actions.forEach(([d, label], i) => {
    const slot = (W - PAD * 2) / actions.length;
    const width = 54 + 14 + ctx.measureText(label).width;
    const x = PAD + slot * i + (slot - width) / 2;
    icon(ctx, d, x, y + 39, 54, t.muted);
    ctx.fillStyle = t.muted;
    ctx.fillText(label, x + 68, y + 80);
  });
  y += 132;

  if (s.showComments && s.engagement.comments > 0) {
    const comment = SAMPLE_COMMENTS[0];
    ctx.fillStyle = "#cfd3d8";
    ctx.beginPath();
    ctx.arc(PAD + 42, y + 60, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.soft;
    roundRect(ctx, PAD + 108, y + 6, W - PAD * 2 - 108, 138, 30);
    ctx.fill();
    ctx.fillStyle = t.text;
    font(ctx, 38, 600);
    ctx.fillText(comment.name, PAD + 138, y + 60);
    font(ctx, 38);
    ctx.fillText(comment.text, PAD + 138, y + 114);
    y += 168;
  }
  return y;
}

/** A grey stand-in for the next post in the feed. */
function nextPost(ctx: Ctx, t: Theme, y: number) {
  ctx.fillStyle = t.soft;
  ctx.beginPath();
  ctx.arc(PAD + 48, y + 84, 48, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, 168, y + 54, 300, 26, 13);
  ctx.fill();
  roundRect(ctx, 168, y + 98, 180, 22, 11);
  ctx.fill();
  ctx.fillRect(0, y + 168, W, SCREEN.height);
}

function tabBar(ctx: Ctx, s: PostScreen, t: Theme) {
  const h = 228;
  const y = SCREEN.height - h;
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = t.line;
  ctx.fillRect(0, y, W, 3);
  const slot = W / 5;
  [ICONS.home, ICONS.search, ICONS.plus, ICONS.play].forEach((d, i) => {
    icon(ctx, d, slot * i + slot / 2 - 36, y + 39, 72, t.text, i === 0);
  });
  drawAvatar(ctx, s, slot * 4 + slot / 2, y + 75, 36);
  ctx.fillStyle = t.text;
  roundRect(ctx, W / 2 - 201, SCREEN.height - 42, 402, 15, 8);
  ctx.fill();
}

function feedScreen(ctx: Ctx, s: PostScreen, t: Theme) {
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, SCREEN.height);
  statusBar(ctx, t.text);
  ctx.fillStyle = t.text;
  font(ctx, 60, 700);
  ctx.fillText("Home", PAD, 222);
  icon(ctx, ICONS.heart, W - PAD - 192, 168, 72, t.text);
  icon(ctx, ICONS.share, W - PAD - 72, 168, 72, t.text);
  ctx.fillStyle = t.line;
  ctx.fillRect(0, 270, W, 3);

  const bottom =
    s.placement.style === "text" ? textPost(ctx, s, t, 291) : photoPost(ctx, s, t, 279);
  ctx.fillStyle = t.band;
  ctx.fillRect(0, bottom, W, 24);
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, bottom + 24, W, SCREEN.height);
  nextPost(ctx, t, bottom + 36);
  tabBar(ctx, s, t);
}

function storyScreen(ctx: Ctx, s: PostScreen) {
  const top = 132;
  const h = Math.min(mediaHeight(s.placement), SCREEN.height - top - 270);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, SCREEN.height);
  statusBar(ctx, "#ffffff");

  ctx.save();
  roundRect(ctx, 0, top, W, h, 36);
  ctx.clip();
  media(ctx, s, DARK, top, h);

  const covered = coveredEdges(s.placement);
  if (s.showCovered && covered) {
    const ct = (covered.top / 100) * h;
    const cb = (covered.bottom / 100) * h;
    const cl = (covered.left / 100) * W;
    const cr = (covered.right / 100) * W;
    ctx.fillStyle = "rgba(254, 80, 0, 0.35)";
    ctx.fillRect(0, top, W, ct);
    ctx.fillRect(0, top + h - cb, W, cb);
    ctx.fillRect(0, top + ct, cl, h - ct - cb);
    ctx.fillRect(W - cr, top + ct, cr, h - ct - cb);
  }

  // A soft shade so the white labels stay readable on a light picture.
  const shade = ctx.createLinearGradient(0, top, 0, top + 300);
  shade.addColorStop(0, "rgba(0,0,0,0.35)");
  shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, top, W, 300);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  roundRect(ctx, 24, top + 24, W - 48, 6, 3);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 24, top + 24, (W - 48) * 0.4, 6, 3);
  ctx.fill();

  drawAvatar(ctx, s, 36 + 48, top + 114, 48, "rgba(255,255,255,0.6)");
  ctx.fillStyle = "#ffffff";
  font(ctx, 40, 600);
  const handle = fitText(ctx, s.handle, 560);
  ctx.fillText(handle, 156, s.ad ? top + 104 : top + 128);
  if (s.ad) {
    font(ctx, 34);
    ctx.fillText("Sponsored", 156, top + 148);
  } else {
    const x = 156 + ctx.measureText(handle).width + 24;
    font(ctx, 38);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText("2h", x, top + 128);
  }
  dots(ctx, W - 186, top + 114, "#ffffff");
  ctx.save();
  ctx.lineWidth = 1;
  icon(ctx, ICONS.close, W - 114, top + 81, 66, "#ffffff");
  ctx.restore();

  if (s.ad) {
    font(ctx, 42, 600);
    const width = ctx.measureText(s.cta).width + 120;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, (W - width) / 2, top + h - 168, width, 108, 54);
    ctx.fill();
    ctx.fillStyle = "#111214";
    ctx.textAlign = "center";
    ctx.fillText(s.cta, W / 2, top + h - 100);
    ctx.textAlign = "left";
  }

  const y = top + h + 36;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 3;
  roundRect(ctx, 36, y, W - 36 - 276, 126, 63);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  font(ctx, 42);
  ctx.fillText("Send message", 84, y + 78);
  icon(ctx, ICONS.heart, W - 240, y + 24, 78, "#ffffff");
  icon(ctx, ICONS.share, W - 120, y + 24, 78, "#ffffff");
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, W / 2 - 201, SCREEN.height - 42, 402, 15, 8);
  ctx.fill();
}

/** Draw the whole phone screen. Sets the canvas to SCREEN's size. */
export function drawPostScreen(canvas: HTMLCanvasElement, s: PostScreen): void {
  canvas.width = SCREEN.width;
  canvas.height = SCREEN.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingQuality = "high";
  ctx.textBaseline = "alphabetic";
  if (s.placement.kind === "story") storyScreen(ctx, s);
  else feedScreen(ctx, s, s.dark ? DARK : LIGHT);
}
