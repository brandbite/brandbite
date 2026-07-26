// -----------------------------------------------------------------------------
// @file: components/marketing/color-tool-card.tsx
// @purpose: Tool card from the Figma Color Tools design — icon, title, blurb,
//           orange arrow CTA. Used on the /colors hub and in the "more tools"
//           strip on each tool page.
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";

import type { ColorTool } from "@/components/marketing/color-tools";

export function ColorToolCard({ tool }: { tool: ColorTool }) {
  return (
    <Link
      href={tool.href}
      className="flex w-[190px] shrink-0 flex-col items-center gap-2.5 self-stretch rounded-xl border-[0.5px] border-[#D7D8DD] bg-[#F7F4F1] px-2.5 py-5 transition-shadow hover:shadow-[0_6px_18px_rgba(31,32,36,0.08)]"
    >
      <Image src={tool.icon} alt="" width={140} height={140} className="size-[140px]" />
      <span className="flex w-full flex-1 flex-col gap-px">
        <span className="text-base leading-5 font-bold text-[#2B2D33]">{tool.title}</span>
        <span className="text-sm leading-6 text-[#5E616E]">{tool.description}</span>
      </span>
      <span className="flex w-full items-end justify-end">
        <Image src="/home/arrow-chat.svg" alt="" width={24} height={24} />
      </span>
    </Link>
  );
}
