// -----------------------------------------------------------------------------
// @file: components/newsletter/editor/inspector.tsx
// @purpose: The newsletter editor's right-hand panel. With a block picked it
//           shows that block's content and layout settings; with the header
//           or footer picked, theirs; with nothing picked, the newsletter's
//           own settings (subject, AI writing) and its style (look, colors,
//           fonts).
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import type { ToolAccess } from "@/components/tools/tool-ui";
import { TOOL_ERROR, TOOL_FOCUS } from "@/components/tools/tool-ui";
import {
  NEWSLETTER_BRIEF_MAX,
  NEWSLETTER_BRIEF_MIN,
  NEWSLETTER_KINDS,
  REWRITE_ACTIONS,
  type NewsletterKind,
  type RewriteAction,
} from "@/lib/newsletter/ai";
import { PERSONAL_FIELDS, personalToken, serviceTag } from "@/lib/newsletter/personal";
import {
  ALIGNS,
  BLOCK_SHOWS,
  blockTypeInfo,
  BUTTON_CORNER_MAX,
  BUTTON_SHAPES,
  BUTTON_SIZES,
  buttonLook,
  COLUMNS_LAYOUTS,
  DIVIDER_LINES,
  HEADING_SIZE_MAX,
  HEADING_SIZE_MIN,
  headingAutoSize,
  IMAGE_CORNER_MAX,
  HEADER_STYLES,
  lookTheme,
  NEWSLETTER_FONTS,
  NEWSLETTER_LOOKS,
  NEWSLETTER_MAX_SOCIAL,
  NEWSLETTER_SERVICES,
  setColumnsLayout,
  SOCIAL_PLATFORMS,
  SOCIAL_SIZES,
  type ButtonLook,
  type NewsletterBlock,
  type NewsletterData,
  type NewsletterService,
  type SocialPlatform,
} from "@/lib/newsletter/newsletter";

import {
  Choice,
  ColorField,
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  Fold,
  Group,
  ImageField,
  Slider,
  SMALL_BUTTON,
  TextInput,
  Toggle,
} from "./fields";

const NOTE = "text-[13px] leading-5 text-[var(--cs-muted)]";

/** Change part of a block. `key` names the field being typed into, so typing is one undo step. */
export type BlockChange = (patch: Partial<NewsletterBlock>, key?: string) => void;

export const SERVICE_NOTES: Record<NewsletterService, string> = {
  mailchimp:
    "The footer carries Mailchimp's unsubscribe tag (*|UNSUB|*); Mailchimp swaps it for each reader's link.",
  klaviyo:
    "The footer carries Klaviyo's unsubscribe tag ({% unsubscribe %}); Klaviyo swaps it for each reader's link.",
  brevo:
    "The footer carries Brevo's unsubscribe tag ({{ unsubscribe }}); Brevo swaps it for each reader's link.",
  other: "Paste your service's unsubscribe link or tag below; its help pages list it.",
};

const AI_PLACEHOLDERS: Record<NewsletterKind, string> = {
  announcement:
    "e.g. We're opening a second shop at 12 Mill Street on 4 March. Opening week: free coffee with every order.",
  digest:
    "e.g. March update: new spring menu is out, we won the local business award, the workshop on 20 March has 5 seats left.",
  offer: "e.g. 20% off all annual plans until Sunday with the code SPRING20. New customers only.",
};

export type AiState = {
  /** What is being written right now, or null. */
  busy: string | null;
  note: { kind: "ok" | "error"; text: string } | null;
  runsLeft: number | null;
};

function AiNote({ ai }: { ai: AiState }) {
  return (
    <>
      <p
        role="status"
        className={`text-[13px] leading-5 empty:hidden ${ai.note?.kind === "error" ? TOOL_ERROR : "text-[#256b3a]"}`}
      >
        {ai.note?.text ?? ""}
      </p>
      {ai.runsLeft !== null ? (
        <p className={NOTE}>
          {ai.runsLeft} {ai.runsLeft === 1 ? "run" : "runs"} left today
        </p>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// A block
// ---------------------------------------------------------------------------

/**
 * A slider for a measure that follows the email's style until it is set by
 * hand: it shows the followed value, and once moved offers the way back.
 */
function AutoSlider({
  label,
  value,
  auto,
  autoValue,
  min,
  max,
  backLabel,
  onChange,
}: {
  label: string;
  value: number;
  /** The stored value that means "not set by hand". */
  auto: number;
  /** What the measure is while it follows the email's style. */
  autoValue: number;
  min: number;
  max: number;
  backLabel: string;
  onChange: (value: number) => void;
}) {
  const set = value !== auto;
  return (
    <div>
      <Slider
        label={label}
        value={set ? value : Math.min(max, Math.max(min, autoValue))}
        min={min}
        max={max}
        step={1}
        unit="px"
        onChange={onChange}
      />
      {set ? (
        <button
          type="button"
          onClick={() => onChange(auto)}
          className="mt-1 text-[13px] leading-5 font-semibold text-[var(--cs-brand-strong)] underline underline-offset-4 hover:no-underline"
        >
          {backLabel}
        </button>
      ) : (
        <p className={NOTE}>Follows the email&apos;s style. Move it to set this one by hand.</p>
      )}
    </div>
  );
}

/** How a button looks: filled or outline, its two colors, its size and its corners. */
function ButtonLookFields({
  look,
  data,
  swatches,
  fallbackFill,
  onChange,
}: {
  look: ButtonLook;
  data: NewsletterData;
  swatches: ToolAccess["brandColors"];
  /** The color the button has while none is set: the accent, or the block's own. */
  fallbackFill: string;
  onChange: (patch: Partial<ButtonLook>, field?: string) => void;
}) {
  const shape = data.theme.buttonShape;
  return (
    <>
      <Choice
        label="Style"
        options={[
          { id: "filled", label: "Filled" },
          { id: "outline", label: "Outline" },
        ]}
        value={look.outline ? "outline" : "filled"}
        onChange={(style) => onChange({ outline: style === "outline" })}
      />
      <ColorField
        label="Button color"
        value={look.fill}
        emptyLabel="Accent color"
        fallback={fallbackFill}
        swatches={swatches}
        onChange={(fill) => onChange({ fill }, "fill")}
      />
      <ColorField
        label="Text color"
        value={look.textColor}
        emptyLabel="Automatic"
        fallback={look.outline ? look.fill || fallbackFill : "#ffffff"}
        swatches={swatches}
        onChange={(textColor) => onChange({ textColor }, "textColor")}
      />
      <Choice
        label="Size"
        options={BUTTON_SIZES}
        value={look.size}
        onChange={(size) => onChange({ size })}
      />
      <AutoSlider
        label="Rounded corners"
        value={look.corner}
        auto={-1}
        autoValue={shape === "square" ? 0 : shape === "pill" ? BUTTON_CORNER_MAX : 8}
        min={0}
        max={BUTTON_CORNER_MAX}
        backLabel="Use the email's button shape"
        onChange={(corner) => onChange({ corner }, "corner")}
      />
    </>
  );
}

/** The two colors of a ready-made block. */
function BlockColorFields({
  block,
  data,
  swatches,
  accentLabel,
  onChange,
  fieldKey,
}: {
  block: { accentColor: string; textColor: string };
  data: NewsletterData;
  swatches: ToolAccess["brandColors"];
  /** What the accent colors in this block, e.g. "Price and button". */
  accentLabel: string;
  onChange: BlockChange;
  fieldKey: (field: string) => string;
}) {
  return (
    <Group title="Colors">
      <ColorField
        label={accentLabel}
        value={block.accentColor}
        emptyLabel="Accent color"
        fallback={data.theme.accent}
        swatches={swatches}
        onChange={(accentColor) => onChange({ accentColor }, fieldKey("accentColor"))}
      />
      <ColorField
        label="Title and text"
        value={block.textColor}
        emptyLabel="Theme color"
        fallback={data.theme.text}
        swatches={swatches}
        onChange={(textColor) => onChange({ textColor }, fieldKey("textColor"))}
      />
    </Group>
  );
}

export function BlockInspector({
  block,
  data,
  access,
  ai,
  onChange,
  onRewrite,
}: {
  block: NewsletterBlock;
  data: NewsletterData;
  access: ToolAccess;
  ai: AiState;
  onChange: BlockChange;
  onRewrite: (action: RewriteAction) => void;
}) {
  const key = (field: string) => `${block.id}:${field}`;
  const canUpload = access.newsletterUpload;
  const swatches = access.brandColors;
  const hasAlign = !["divider", "spacer", "columns", "quote", "event", "story"].includes(
    block.type,
  );

  return (
    <div>
      <Group title="Content">
        {block.type === "heading" ? (
          <>
            <TextInput
              label="Heading"
              value={block.text}
              maxLength={300}
              placeholder="A short headline"
              onChange={(text) => onChange({ text }, key("text"))}
            />
            <Choice
              label="Size"
              options={[
                { id: 1, label: "Large" },
                { id: 2, label: "Medium" },
                { id: 3, label: "Small" },
              ]}
              value={block.level}
              onChange={(level) => onChange({ level })}
            />
            <AutoSlider
              label="Text size"
              value={block.fontSize}
              auto={0}
              autoValue={headingAutoSize(block.level)}
              min={HEADING_SIZE_MIN}
              max={HEADING_SIZE_MAX}
              backLabel="Use the size above"
              onChange={(fontSize) => onChange({ fontSize }, key("fontSize"))}
            />
            <ColorField
              label="Color"
              value={block.color}
              emptyLabel="Theme color"
              fallback={data.theme.text}
              swatches={swatches}
              onChange={(color) => onChange({ color }, key("color"))}
            />
          </>
        ) : null}

        {block.type === "text" ? (
          <>
            <p className={NOTE}>
              Type and format this text on the newsletter itself: pick the block and use the bar
              under it for bold, italic, underline, links and lists.
            </p>
            <Choice
              label="Size"
              options={[
                { id: "small", label: "Small" },
                { id: "medium", label: "Medium" },
                { id: "large", label: "Large" },
              ]}
              value={block.size}
              onChange={(size) => onChange({ size })}
            />
            <ColorField
              label="Color"
              value={block.color}
              emptyLabel="Theme color"
              fallback={data.theme.text}
              swatches={swatches}
              onChange={(color) => onChange({ color }, key("color"))}
            />
          </>
        ) : null}

        {(block.type === "heading" || block.type === "text") && access.newsletterAi ? (
          <div>
            <p className={FIELD_LABEL}>Rewrite with AI</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REWRITE_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={ai.busy !== null || block.text.trim().length < 3}
                  onClick={() => onRewrite(action.id)}
                  className={SMALL_BUTTON}
                >
                  {ai.busy === `${block.id}:${action.id}` ? "Writing…" : action.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <AiNote ai={ai} />
            </div>
          </div>
        ) : null}

        {block.type === "image" ? (
          <>
            <ImageField
              label="Image"
              value={block.url}
              canUpload={canUpload}
              onChange={(url) => onChange({ url }, key("url"))}
            />
            <TextInput
              label="Description"
              value={block.alt}
              placeholder="What the image shows"
              hint="Read aloud to people who can't see it, and shown when pictures are off."
              onChange={(alt) => onChange({ alt }, key("alt"))}
            />
            <TextInput
              label="Link (optional)"
              type="url"
              value={block.link}
              maxLength={500}
              placeholder="yourcompany.com/page"
              onChange={(link) => onChange({ link }, key("link"))}
            />
            <Choice
              label="Width"
              options={[
                { id: 100, label: "Full" },
                { id: 75, label: "75%" },
                { id: 50, label: "50%" },
                { id: 25, label: "25%" },
              ]}
              value={block.width}
              onChange={(width) => onChange({ width })}
            />
            <AutoSlider
              label="Rounded corners"
              value={block.corner}
              auto={-1}
              autoValue={block.rounded || data.theme.rounded ? 10 : 0}
              min={0}
              max={IMAGE_CORNER_MAX}
              backLabel="Use the email's corners"
              onChange={(corner) => onChange({ corner }, key("corner"))}
            />
          </>
        ) : null}

        {block.type === "button" ? (
          <>
            <TextInput
              label="Button text"
              value={block.label}
              maxLength={60}
              placeholder="e.g. Shop the sale"
              onChange={(label) => onChange({ label }, key("label"))}
            />
            <TextInput
              label="Where it goes"
              type="url"
              value={block.url}
              maxLength={500}
              placeholder="yourcompany.com/page"
              onChange={(url) => onChange({ url }, key("url"))}
            />
            <Toggle
              label="Full width"
              checked={block.full}
              onChange={(full) => onChange({ full })}
            />
          </>
        ) : null}

        {block.type === "divider" ? (
          <>
            <ColorField
              label="Line color"
              value={block.color}
              emptyLabel="Theme color"
              fallback="#e4e2dd"
              swatches={swatches}
              onChange={(color) => onChange({ color }, key("color"))}
            />
            <Slider
              label="Thickness"
              value={block.thickness}
              min={1}
              max={8}
              step={1}
              unit="px"
              onChange={(thickness) => onChange({ thickness }, key("thickness"))}
            />
            <Choice
              label="Line"
              options={DIVIDER_LINES}
              value={block.line}
              onChange={(line) => onChange({ line })}
            />
          </>
        ) : null}

        {block.type === "spacer" ? (
          <Slider
            label="Height"
            value={block.height}
            min={8}
            max={160}
            step={8}
            onChange={(height) => onChange({ height }, key("height"))}
          />
        ) : null}

        {block.type === "columns" ? (
          <>
            <Choice
              label="Layout"
              options={COLUMNS_LAYOUTS.map((layout) => ({ id: layout.id, label: layout.label }))}
              value={block.layout}
              onChange={(layout) => onChange(setColumnsLayout(block, layout))}
            />
            <Choice
              label="Line up columns"
              options={[
                { id: "top", label: "At the top" },
                { id: "middle", label: "In the middle" },
              ]}
              value={block.valign}
              onChange={(valign) => onChange({ valign })}
            />
            <p className={NOTE}>
              Drag blocks into a column, or pick a column&apos;s block to edit it. On a phone the
              columns sit one under the other.
            </p>
          </>
        ) : null}

        {block.type === "story" ? (
          <>
            <TextInput
              label="Title"
              value={block.title}
              placeholder="The story's headline"
              onChange={(title) => onChange({ title }, key("title"))}
            />
            <p className={NOTE}>
              Type and format the text on the newsletter itself: pick the block, click its text and
              use the bar under the block.
            </p>
            <ImageField
              label="Image (optional)"
              value={block.imageUrl}
              canUpload={canUpload}
              onChange={(imageUrl) => onChange({ imageUrl }, key("imageUrl"))}
            />
            <TextInput
              label="Link"
              type="url"
              value={block.linkUrl}
              maxLength={500}
              placeholder="yourcompany.com/story"
              onChange={(linkUrl) => onChange({ linkUrl }, key("linkUrl"))}
            />
            <TextInput
              label="Link text"
              value={block.linkLabel}
              maxLength={60}
              placeholder="Read more"
              onChange={(linkLabel) => onChange({ linkLabel }, key("linkLabel"))}
            />
          </>
        ) : null}

        {block.type === "product" ? (
          <>
            <TextInput
              label="Name"
              value={block.name}
              placeholder="Product name"
              onChange={(name) => onChange({ name }, key("name"))}
            />
            <TextInput
              label="Price"
              value={block.price}
              maxLength={60}
              placeholder="e.g. $49"
              onChange={(price) => onChange({ price }, key("price"))}
            />
            <p className={NOTE}>
              Type and format the text on the newsletter itself: pick the block, click its text and
              use the bar under the block.
            </p>
            <ImageField
              label="Image"
              value={block.imageUrl}
              canUpload={canUpload}
              onChange={(imageUrl) => onChange({ imageUrl }, key("imageUrl"))}
            />
            <TextInput
              label="Button text"
              value={block.buttonLabel}
              maxLength={60}
              placeholder="Shop now"
              onChange={(buttonLabel) => onChange({ buttonLabel }, key("buttonLabel"))}
            />
            <TextInput
              label="Where it goes"
              type="url"
              value={block.url}
              maxLength={500}
              placeholder="yourshop.com/product"
              onChange={(url) => onChange({ url }, key("url"))}
            />
            <Toggle
              label="Frame around the product"
              checked={block.frame}
              hint="A thin line with rounded corners around the picture, name and button."
              onChange={(frame) => onChange({ frame })}
            />
          </>
        ) : null}

        {block.type === "quote" ? (
          <>
            <p className={NOTE}>
              Type and format the quote on the newsletter itself: pick the block, click its words
              and use the bar under the block. Use a real quote, with the person&apos;s permission.
            </p>
            <TextInput
              label="Name"
              value={block.name}
              maxLength={120}
              placeholder="Who said it"
              onChange={(name) => onChange({ name }, key("name"))}
            />
            <TextInput
              label="Role or company (optional)"
              value={block.role}
              maxLength={120}
              placeholder="e.g. Founder, Acme"
              onChange={(role) => onChange({ role }, key("role"))}
            />
          </>
        ) : null}

        {block.type === "event" ? (
          <>
            <TextInput
              label="Date"
              value={block.date}
              maxLength={30}
              placeholder="20 Mar"
              hint="Short, as it should read on the badge: a day and a month."
              onChange={(date) => onChange({ date }, key("date"))}
            />
            <TextInput
              label="Title"
              value={block.title}
              placeholder="Name of the event"
              onChange={(title) => onChange({ title }, key("title"))}
            />
            <p className={NOTE}>
              Type and format the text on the newsletter itself: pick the block, click its text and
              use the bar under the block.
            </p>
            <TextInput
              label="Link text"
              value={block.buttonLabel}
              maxLength={60}
              placeholder="Save my seat"
              onChange={(buttonLabel) => onChange({ buttonLabel }, key("buttonLabel"))}
            />
            <TextInput
              label="Where it goes"
              type="url"
              value={block.url}
              maxLength={500}
              placeholder="yourcompany.com/event"
              onChange={(url) => onChange({ url }, key("url"))}
            />
          </>
        ) : null}

        {block.type === "video" ? (
          <>
            <TextInput
              label="Video link"
              type="url"
              value={block.url}
              maxLength={500}
              placeholder="youtube.com/watch?v=…"
              hint="An email can't play video, so the picture links to it. For a YouTube link the picture is found by itself."
              onChange={(url) => onChange({ url }, key("url"))}
            />
            <ImageField
              label="Thumbnail (optional for YouTube)"
              value={block.thumbnailUrl}
              canUpload={canUpload}
              onChange={(thumbnailUrl) => onChange({ thumbnailUrl }, key("thumbnailUrl"))}
            />
            <TextInput
              label="Button text"
              value={block.label}
              maxLength={60}
              placeholder="Watch the video"
              onChange={(label) => onChange({ label }, key("label"))}
            />
          </>
        ) : null}

        {block.type === "social" ? (
          <>
            {block.links.map((item, index) => (
              <div key={`${item.platform}-${index}`} className="flex items-end gap-2">
                <div className="w-[116px] shrink-0">
                  <label className={FIELD_LABEL} htmlFor={`${block.id}-platform-${index}`}>
                    {index === 0 ? "Profile" : <span className="sr-only">Profile</span>}
                  </label>
                  <select
                    id={`${block.id}-platform-${index}`}
                    value={item.platform}
                    onChange={(event) =>
                      onChange({
                        links: block.links.map((link, at) =>
                          at === index
                            ? { ...link, platform: event.target.value as SocialPlatform }
                            : link,
                        ),
                      })
                    }
                    className={`mt-1.5 ${FIELD_INPUT} px-2`}
                  >
                    {SOCIAL_PLATFORMS.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  aria-label={`${SOCIAL_PLATFORMS.find((p) => p.id === item.platform)?.label} address`}
                  type={item.platform === "email" ? "email" : "url"}
                  value={item.url}
                  maxLength={500}
                  placeholder={item.platform === "email" ? "hello@yourcompany.com" : "Address"}
                  onChange={(event) =>
                    onChange(
                      {
                        links: block.links.map((link, at) =>
                          at === index ? { ...link, url: event.target.value } : link,
                        ),
                      },
                      key(`link-${index}`),
                    )
                  }
                  className={`${FIELD_INPUT} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  aria-label={`Remove ${SOCIAL_PLATFORMS.find((p) => p.id === item.platform)?.label}`}
                  onClick={() => onChange({ links: block.links.filter((_, at) => at !== index) })}
                  className={`${SMALL_BUTTON} h-10 w-10 shrink-0 px-0`}
                >
                  <span aria-hidden>×</span>
                </button>
              </div>
            ))}
            {block.links.length < NEWSLETTER_MAX_SOCIAL ? (
              <button
                type="button"
                onClick={() => {
                  const next =
                    SOCIAL_PLATFORMS.find(
                      (platform) => !block.links.some((link) => link.platform === platform.id),
                    )?.id ?? "website";
                  onChange({ links: [...block.links, { platform: next, url: "" }] });
                }}
                className={`${SMALL_BUTTON} self-start`}
              >
                + Add a profile
              </button>
            ) : null}
            <Choice
              label="Icons"
              options={[
                { id: "dark", label: "Dark" },
                { id: "light", label: "Light" },
              ]}
              value={block.tone}
              onChange={(tone) => onChange({ tone })}
            />
            <Choice
              label="Icon size"
              options={SOCIAL_SIZES}
              value={block.size}
              onChange={(size) => onChange({ size })}
            />
            <p className={NOTE}>Only profiles with an address are shown in the email.</p>
          </>
        ) : null}
      </Group>

      {block.type === "button" ? (
        <Group title="Button look">
          <ButtonLookFields
            look={buttonLook(block)}
            data={data}
            swatches={swatches}
            fallbackFill={data.theme.accent}
            onChange={(patch, field) =>
              onChange(
                {
                  ...("fill" in patch ? { color: patch.fill } : {}),
                  ...("textColor" in patch ? { textColor: patch.textColor } : {}),
                  ...("size" in patch ? { size: patch.size } : {}),
                  ...("corner" in patch ? { corner: patch.corner } : {}),
                  ...("outline" in patch ? { outline: patch.outline } : {}),
                },
                field ? key(`look-${field}`) : undefined,
              )
            }
          />
        </Group>
      ) : null}

      {block.type === "product" || block.type === "video" ? (
        <Group title="Button look">
          <ButtonLookFields
            look={buttonLook(block)}
            data={data}
            swatches={swatches}
            fallbackFill={(block.type === "product" && block.accentColor) || data.theme.accent}
            onChange={(patch, field) =>
              onChange(
                {
                  ...("fill" in patch ? { buttonColor: patch.fill } : {}),
                  ...("textColor" in patch ? { buttonTextColor: patch.textColor } : {}),
                  ...("size" in patch ? { buttonSize: patch.size } : {}),
                  ...("corner" in patch ? { buttonCorner: patch.corner } : {}),
                  ...("outline" in patch ? { buttonOutline: patch.outline } : {}),
                },
                field ? key(`look-${field}`) : undefined,
              )
            }
          />
        </Group>
      ) : null}

      {block.type === "product" ? (
        <BlockColorFields
          block={block}
          data={data}
          swatches={swatches}
          accentLabel="Price"
          onChange={onChange}
          fieldKey={key}
        />
      ) : null}
      {block.type === "quote" ? (
        <BlockColorFields
          block={block}
          data={data}
          swatches={swatches}
          accentLabel="Line beside the quote"
          onChange={onChange}
          fieldKey={key}
        />
      ) : null}
      {block.type === "event" ? (
        <BlockColorFields
          block={block}
          data={data}
          swatches={swatches}
          accentLabel="Date and link"
          onChange={onChange}
          fieldKey={key}
        />
      ) : null}
      {block.type === "story" ? (
        <BlockColorFields
          block={block}
          data={data}
          swatches={swatches}
          accentLabel="Link"
          onChange={onChange}
          fieldKey={key}
        />
      ) : null}

      <Group title="Layout">
        {hasAlign ? (
          <Choice
            label="Align"
            options={ALIGNS}
            value={block.align}
            onChange={(align) => onChange({ align })}
          />
        ) : null}
        <Slider
          label="Space above"
          value={block.padTop}
          min={0}
          max={96}
          onChange={(padTop) => onChange({ padTop }, key("padTop"))}
        />
        <Slider
          label="Space below"
          value={block.padBottom}
          min={0}
          max={96}
          onChange={(padBottom) => onChange({ padBottom }, key("padBottom"))}
        />
        <ColorField
          label="Background"
          value={block.background}
          emptyLabel="None"
          fallback={data.theme.card}
          swatches={swatches}
          onChange={(background) => onChange({ background }, key("background"))}
        />
        <ImageField
          label="Background picture (optional)"
          value={block.backgroundImage}
          canUpload={canUpload}
          hint="Shown behind the block. Outlook on Windows shows the background color instead, so set one that keeps the words readable."
          onChange={(backgroundImage) => onChange({ backgroundImage }, key("backgroundImage"))}
        />
        <Toggle
          label="Draw as a box"
          checked={block.boxed}
          hint="The background stays inside the newsletter's margins, with room around the content, a border and rounded corners."
          onChange={(boxed) => onChange({ boxed })}
        />
        {block.boxed ? (
          <>
            <Slider
              label="Border"
              value={block.borderWidth}
              min={0}
              max={8}
              step={1}
              onChange={(borderWidth) => onChange({ borderWidth }, key("borderWidth"))}
            />
            {block.borderWidth ? (
              <ColorField
                label="Border color"
                value={block.borderColor}
                emptyLabel="Theme color"
                fallback="#e4e2dd"
                swatches={swatches}
                onChange={(borderColor) => onChange({ borderColor }, key("borderColor"))}
              />
            ) : null}
            <Slider
              label="Rounded corners"
              value={block.radius}
              min={0}
              max={32}
              step={2}
              onChange={(radius) => onChange({ radius }, key("radius"))}
            />
          </>
        ) : null}
      </Group>

      <Group title="Screens">
        <Choice
          label="Show on"
          options={BLOCK_SHOWS}
          value={block.show}
          onChange={(show) => onChange({ show })}
        />
        <p className={NOTE}>
          {block.show === "all"
            ? "Shown to every reader."
            : block.show === "desktop"
              ? "Hidden on phones. A few mail apps ignore this and show it anyway."
              : "Shown on phones only. A few mail apps ignore this and never show it, so don't put anything essential here."}
        </p>
        {block.type === "columns" ? (
          <Toggle
            label="One under the other on phones"
            checked={block.stack}
            hint="Off keeps the columns side by side on every screen; use it for small things like icons."
            onChange={(stack) => onChange({ stack })}
          />
        ) : null}
      </Group>
    </div>
  );
}

export function blockTitle(block: NewsletterBlock): string {
  return blockTypeInfo(block.type).label;
}

// ---------------------------------------------------------------------------
// Header and footer
// ---------------------------------------------------------------------------

export function HeaderInspector({
  data,
  access,
  onChange,
}: {
  data: NewsletterData;
  access: ToolAccess;
  onChange: (patch: Partial<NewsletterData["header"]>, key?: string) => void;
}) {
  const header = data.header;
  return (
    <Group title="Header">
      <Toggle
        label="Show the header"
        checked={header.show}
        onChange={(show) => onChange({ show })}
      />
      {header.show ? (
        <>
          <TextInput
            label="Brand name"
            value={header.brandName}
            maxLength={120}
            placeholder="Your company"
            onChange={(brandName) => onChange({ brandName }, "header:brandName")}
          />
          <ImageField
            label="Logo (optional)"
            value={header.logoUrl}
            canUpload={access.newsletterUpload}
            hint="Shown instead of the name. A PNG or JPG; mail apps don't show SVG."
            onChange={(logoUrl) => onChange({ logoUrl }, "header:logoUrl")}
          />
          {header.logoUrl.trim() ? (
            <Slider
              label="Logo height"
              value={header.logoHeight}
              min={24}
              max={96}
              onChange={(logoHeight) => onChange({ logoHeight }, "header:logoHeight")}
            />
          ) : null}
          <Choice
            label="Style"
            options={HEADER_STYLES}
            value={header.style}
            onChange={(style) => onChange({ style })}
          />
        </>
      ) : null}
    </Group>
  );
}

export function FooterInspector({
  data,
  onChange,
}: {
  data: NewsletterData;
  onChange: (patch: Partial<NewsletterData["footer"]>, key?: string) => void;
}) {
  const footer = data.footer;
  return (
    <Group title="Footer">
      <TextInput
        label="Why they get this email"
        value={footer.note}
        maxLength={300}
        placeholder="e.g. You signed up at yourcompany.com."
        onChange={(note) => onChange({ note }, "footer:note")}
      />
      <TextInput
        label="Postal address"
        value={footer.address}
        placeholder="Street, city, country"
        hint="Anti-spam rules in the US, EU and elsewhere ask for the sender's address in marketing email."
        onChange={(address) => onChange({ address }, "footer:address")}
      />
      <TextInput
        label="Website"
        type="url"
        value={footer.website}
        placeholder="yourcompany.com"
        onChange={(website) => onChange({ website }, "footer:website")}
      />
      <div>
        <Choice
          label="Which service will send it?"
          options={NEWSLETTER_SERVICES}
          value={footer.service}
          onChange={(service) => onChange({ service })}
        />
        <p className={`mt-1.5 ${NOTE}`}>{SERVICE_NOTES[footer.service]}</p>
      </div>
      {footer.service === "other" ? (
        <TextInput
          label="Unsubscribe link or tag"
          value={footer.unsubscribe}
          maxLength={500}
          placeholder="e.g. {{ unsubscribe_url }}"
          onChange={(unsubscribe) => onChange({ unsubscribe }, "footer:unsubscribe")}
        />
      ) : null}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// The newsletter itself: inbox lines and AI writing
// ---------------------------------------------------------------------------

export function NewsletterPanel({
  data,
  access,
  ai,
  subjects,
  onChange,
  onWrite,
  onSuggestSubjects,
}: {
  data: NewsletterData;
  access: ToolAccess;
  ai: AiState;
  /** Subject line ideas from the last AI run. */
  subjects: string[];
  onChange: (patch: Partial<NewsletterData>, key?: string) => void;
  onWrite: (kind: NewsletterKind, brief: string) => void;
  onSuggestSubjects: () => void;
}) {
  const [kind, setKind] = useState<NewsletterKind>("announcement");
  const [brief, setBrief] = useState("");
  const length = data.subject.trim().length;

  const sender = data.header.brandName.trim() || "Your brand";

  return (
    <div>
      <Group title="Inbox preview">
        {/* How the email sits in an inbox list: who it is from, the subject, the preview text. */}
        <div className="flex items-start gap-3 rounded-xl border border-[var(--cs-border)] p-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFE9DF] text-sm font-bold text-[#C2410C]"
          >
            {sender.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 text-[13px] leading-5">
            <p className="truncate font-semibold">{sender}</p>
            <p
              className={`truncate font-semibold ${data.subject.trim() ? "" : "text-[var(--cs-muted)]"}`}
            >
              {data.subject.trim() || "Your subject line"}
            </p>
            <p className="truncate text-[var(--cs-muted)]">
              {data.preheader.trim() || "Your preview text"}
            </p>
          </div>
        </div>
        <TextInput
          label="Subject line"
          value={data.subject}
          maxLength={150}
          placeholder="e.g. Our spring menu is here"
          hint={`${length} characters. Around 60 or fewer isn't cut off in most inboxes. You'll type it into your email service as well.`}
          onChange={(subject) => onChange({ subject }, "subject")}
        />
        <TextInput
          label="Preview text"
          value={data.preheader}
          maxLength={150}
          placeholder="The short line shown after the subject"
          onChange={(preheader) => onChange({ preheader }, "preheader")}
        />
        {access.newsletterAi ? (
          <div>
            <button
              type="button"
              disabled={ai.busy !== null}
              onClick={onSuggestSubjects}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--cs-soft)] px-4 text-[13px] font-semibold text-[var(--cs-soft-text)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 ${TOOL_FOCUS}`}
            >
              {ai.busy === "subjects" ? "Thinking…" : "Suggest subject lines"}
            </button>
            {subjects.length ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {subjects.map((subject) => (
                  <li key={subject}>
                    <button
                      type="button"
                      onClick={() => onChange({ subject })}
                      className={`${SMALL_BUTTON} h-auto w-full justify-start py-2 text-left font-medium whitespace-normal`}
                    >
                      {subject}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Group>

      <div className="pt-4">
        <Fold title="Personal fields" icon="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0">
          <p className={NOTE}>
            Greet each reader by name. Put a field where the name should go; when you export, it
            becomes the tag your email service fills in. The preview and a test email show an
            example instead.
          </p>
          <ul className="flex flex-col gap-1.5">
            {PERSONAL_FIELDS.map((field) => (
              <li key={field.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-[13px] leading-5">
                  <span className="font-semibold">{field.label}</span>{" "}
                  <code className="rounded bg-[var(--cs-background)] px-1 text-[12px]">
                    {personalToken(field.id)}
                  </code>
                </span>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(personalToken(field.id))}
                  className={SMALL_BUTTON}
                >
                  Copy
                </button>
              </li>
            ))}
          </ul>
          <p className={NOTE}>
            {data.footer.service === "other"
              ? "For another service the field stays as written; replace it with that service's own tag."
              : `In ${NEWSLETTER_SERVICES.find((s) => s.id === data.footer.service)?.label} the first name becomes ${serviceTag("first_name", data.footer.service)}.`}{" "}
            In a text block, the bar under it has a button that adds a field for you.
          </p>
        </Fold>

        {access.newsletterAi ? (
          <Fold title="Write with AI" icon={AI_ICON}>
            <p className={NOTE}>
              Say what this issue is about and get a subject, a headline and the text in your
              brand&apos;s voice. It replaces the blocks you have; Undo brings them back. Included
              with your plan: {access.newsletterAiDailyLimit} runs a day for your company.
            </p>
            <Choice label="Kind" options={NEWSLETTER_KINDS} value={kind} onChange={setKind} />
            <div>
              <label htmlFor="newsletter-brief" className={FIELD_LABEL}>
                What should it tell people?
              </label>
              <textarea
                id="newsletter-brief"
                value={brief}
                maxLength={NEWSLETTER_BRIEF_MAX}
                placeholder={AI_PLACEHOLDERS[kind]}
                onChange={(event) => setBrief(event.target.value)}
                className={`mt-1.5 ${FIELD_TEXTAREA}`}
              />
              <p className={`mt-1.5 ${NOTE}`}>
                Include every fact yourself: prices, dates, names. The writer uses only what you
                give it.
              </p>
            </div>
            <button
              type="button"
              disabled={ai.busy !== null || brief.trim().length < NEWSLETTER_BRIEF_MIN}
              onClick={() => onWrite(kind, brief)}
              className={`${SMALL_BUTTON} min-h-10 border-[var(--cs-text)] bg-[var(--cs-text)] text-[var(--cs-surface)] hover:opacity-90`}
            >
              {ai.busy === "draft" ? "Writing…" : "Write my newsletter"}
            </button>
            <AiNote ai={ai} />
          </Fold>
        ) : (
          <Fold title="Write with AI" icon={AI_ICON} badge="Plan">
            <p className={NOTE}>
              With a brandbite plan the newsletter is written in your brand&apos;s voice. A plan
              also brings image upload, columns and the ready-made blocks, newsletters kept in your
              account and test emails.
            </p>
          </Fold>
        )}
      </div>
    </div>
  );
}

/** A four-point sparkle, for what AI writes. */
const AI_ICON = "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 3v4M17 5h4";

// ---------------------------------------------------------------------------
// Style: look, colors, fonts
// ---------------------------------------------------------------------------

export function StylePanel({
  data,
  access,
  onTheme,
  onLook,
}: {
  data: NewsletterData;
  access: ToolAccess;
  onTheme: (patch: Partial<NewsletterData["theme"]>, key?: string) => void;
  onLook: (theme: NewsletterData["theme"], headerStyle: NewsletterData["header"]["style"]) => void;
}) {
  const theme = data.theme;
  return (
    <div>
      <Group title="Look">
        <div className="grid grid-cols-2 gap-2">
          {NEWSLETTER_LOOKS.map((look) => {
            const made = lookTheme(look.id, theme.accent);
            return (
              <button
                key={look.id}
                type="button"
                onClick={() => onLook(made.theme, made.headerStyle)}
                className="flex flex-col gap-2 rounded-lg border border-[var(--cs-border)] p-2 text-left hover:border-[var(--cs-text)] focus-visible:ring-2 focus-visible:ring-[var(--cs-text)] focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="flex h-12 items-center justify-center rounded-md border border-[var(--cs-border)]"
                  style={{ background: made.theme.page }}
                >
                  <span
                    className="flex h-9 w-14 flex-col justify-center gap-1 px-1.5"
                    style={{
                      background: made.theme.card,
                      borderRadius: made.theme.rounded ? 5 : 0,
                      borderTop:
                        made.headerStyle === "band" ? `6px solid ${made.theme.accent}` : undefined,
                    }}
                  >
                    <span className="h-1 w-8 rounded-sm" style={{ background: made.theme.text }} />
                    <span
                      className="h-2 w-5"
                      style={{
                        background: made.theme.accent,
                        borderRadius:
                          made.theme.buttonShape === "pill"
                            ? 4
                            : made.theme.buttonShape === "rounded"
                              ? 2
                              : 0,
                      }}
                    />
                  </span>
                </span>
                <span className="text-[13px] leading-4 font-semibold">{look.label}</span>
              </button>
            );
          })}
        </div>
        <p className={NOTE}>
          A look sets the colors, fonts and header below. Your accent color stays.
        </p>
      </Group>

      <Group title="Colors">
        <ColorField
          label="Accent"
          value={theme.accent}
          fallback={theme.accent}
          swatches={access.brandColors}
          onChange={(accent) => accent && onTheme({ accent }, "theme:accent")}
        />
        <ColorField
          label="Page"
          value={theme.page}
          fallback={theme.page}
          swatches={access.brandColors}
          onChange={(page) => page && onTheme({ page }, "theme:page")}
        />
        <ColorField
          label="Content area"
          value={theme.card}
          fallback={theme.card}
          swatches={access.brandColors}
          onChange={(card) => card && onTheme({ card }, "theme:card")}
        />
        <ColorField
          label="Text"
          value={theme.text}
          fallback={theme.text}
          swatches={access.brandColors}
          onChange={(text) => text && onTheme({ text }, "theme:text")}
        />
      </Group>

      <Group title="Type and shape">
        <Choice
          label="Heading font"
          options={NEWSLETTER_FONTS.map((font) => ({ id: font.id, label: font.label }))}
          value={theme.headingFont}
          onChange={(headingFont) => onTheme({ headingFont })}
        />
        <Choice
          label="Text font"
          options={NEWSLETTER_FONTS.map((font) => ({ id: font.id, label: font.label }))}
          value={theme.font}
          onChange={(font) => onTheme({ font })}
        />
        <p className={NOTE}>
          These four are on every computer and phone. A brand font would be swapped for another in
          most inboxes.
        </p>
        <Choice
          label="Buttons"
          options={BUTTON_SHAPES}
          value={theme.buttonShape}
          onChange={(buttonShape) => onTheme({ buttonShape })}
        />
        <Toggle
          label="Rounded corners"
          checked={theme.rounded}
          onChange={(rounded) => onTheme({ rounded })}
        />
      </Group>
    </div>
  );
}
