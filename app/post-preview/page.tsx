// -----------------------------------------------------------------------------
// @file: app/post-preview/page.tsx
// @purpose: Post and ad preview. The tool is client-side; the steps and
//           questions below it are in the first HTML for search engines and
//           readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { PostPreview } from "@/components/post-preview/post-preview";
import { JsonLd } from "@/components/seo/json-ld";
import { SwitchTool } from "@/components/tools/switch-tool";
import { ToolFaq, ToolNote, ToolSteps, type ToolFaqItem } from "@/components/tools/tool-page";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Social Post Preview",
  path: "/post-preview",
  description:
    "See how an image and caption will sit in a social feed or a full-screen story before you post: where the caption is cut and which areas the app's own buttons cover. Free, in your browser.",
};

export const metadata: Metadata = pageMetadata({
  title: "Social Media Post Preview Tool",
  description: TOOL.description,
  path: TOOL.path,
});

const STEPS = [
  {
    title: "Add your content",
    text: "Upload your image, write a caption and set the details.",
    // An arrow up out of a tray.
    icon: "M12 15V4M7 9l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  },
  {
    title: "Check the feed",
    text: "See the layout on a phone, with sample engagement.",
    // A phone.
    icon: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2",
  },
  {
    title: "Export your preview",
    text: "Download a PNG or open it in Mockup Studio.",
    // An arrow down into a tray.
    icon: "M12 4v11M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  },
];

const CHECKS = [
  {
    title: "Does the first line carry the message?",
    body: "Feeds show a line or two of the caption and hide the rest. If the offer or the date is in line four, most people never see it.",
  },
  {
    title: "Is anything important under a button?",
    body: "In stories and full-screen video, the top and bottom are covered by the account name, the reply box and action buttons. Keep text and logos in the middle.",
  },
  {
    title: "Does the image have the right shape?",
    body: "An image in another shape is cropped to fit. Check that faces, products and text survive the cut.",
  },
  {
    title: "Is it readable at phone size?",
    body: "Most people see the post a few centimeters wide. Text that looked fine on your monitor may be too small in a feed.",
  },
];

const LINK = "font-semibold text-[var(--cs-text)] underline";

const FAQ: ToolFaqItem[] = [
  {
    question: "Does this publish my post?",
    answer:
      "No. The tool only shows a preview. It is not connected to any social account, nothing is posted, and your image stays in your browser.",
  },
  {
    question: "Can I preview ads?",
    answer:
      "Yes. Set Post/Ad to Ad and choose a button label. The preview shows “Sponsored” under the account name and the button with the picture.",
  },
  {
    question: "Can I see it on a 3D phone?",
    answer: (
      <>
        Yes. “Open Mockup Studio” takes the screen to{" "}
        <Link href="/mockups" className={LINK}>
          Mockup Studio
        </Link>
        , where you can turn the phone, change the scene and download a picture or a video. Your
        post is still here when you come back.
      </>
    ),
  },
  {
    question: "Which platforms and formats can I preview?",
    answer:
      "Instagram square and portrait posts and stories, Facebook, LinkedIn and X feed posts, and a full-screen TikTok video. Stories and full-screen video also show the areas the app's own buttons cover.",
  },
  {
    question: "How close is the preview to the real app?",
    answer: (
      <>
        The frames are plain on purpose. They show the layout: the shape of the picture, where the
        caption sits and what is covered. They are not a copy of any app, and apps change their look
        often. The numbers and comments are made up. The sizes and covered areas come from our{" "}
        <Link href="/sizes" className={LINK}>
          social media size guide
        </Link>
        , which lists each platform&apos;s sources.
      </>
    ),
  },
  {
    question: "What should I check before I post?",
    answer: (
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        {CHECKS.map((check) => (
          <li key={check.title}>
            <span className="font-semibold text-[var(--cs-text)]">{check.title}</span> {check.body}
          </li>
        ))}
      </ol>
    ),
  },
];

export default function PostPreviewPage() {
  return (
    <StudioShell
      label="FREE TOOLS"
      nav={null}
      title="Post & ad preview."
      accent="See it in the feed first."
      accentBelow
      blurb="Preview your post or ad in a feed layout before you go live."
      action={<SwitchTool current="post-preview" />}
      aside={
        <Image
          src="/tools/post-preview-hero.webp"
          alt=""
          width={810}
          height={640}
          priority
          className="-my-4 h-[250px] w-auto max-[1023px]:h-[200px]"
        />
      }
      closing="ready"
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "DesignApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <ToolNote
        title="A layout preview. Nothing is posted."
        text="Your image stays in your browser, and the engagement numbers are made up."
      />

      <PostPreview />

      <ToolSteps steps={STEPS} labelId="preview-steps-heading" />

      <ToolFaq items={FAQ} labelId="preview-faq-heading" />
    </StudioShell>
  );
}
