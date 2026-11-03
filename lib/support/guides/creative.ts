// -----------------------------------------------------------------------------
// @file: lib/support/guides/creative.ts
// @purpose: Support guides for the creative (designer) dashboard
//           (/creative/**). Keep in sync with CREATIVE_NAV and the pages they
//           describe — when a creative page changes, update its guide in the
//           same PR.
// -----------------------------------------------------------------------------

import type { SupportGuide } from "../types";

export const CREATIVE_GUIDES: SupportGuide[] = [
  {
    slug: "getting-around",
    title: "Getting around your dashboard",
    summary: "What each part of the sidebar is for and where to find help.",
    category: "Getting started",
    routes: ["/creative/support"],
    keywords: ["navigation", "sidebar", "menu", "start", "help"],
    sections: [
      {
        heading: "The sidebar",
        blocks: [
          {
            type: "p",
            text: "Everything in your dashboard is reached from the sidebar on the left:",
          },
          {
            type: "list",
            items: [
              { term: "Overview", text: "a summary of your current work." },
              { term: "Board", text: "the jobs assigned to you, by status." },
              { term: "Portfolio", text: "the work you show on your profile." },
              { term: "Balance", text: "the tokens you have earned." },
              { term: "Withdrawals", text: "turning your earnings into payouts." },
              {
                term: "Account",
                text: "your **Profile**, **Settings**, the **FAQ** and this **Support** section.",
              },
            ],
          },
          {
            type: "tip",
            text: "On a small screen the sidebar is tucked away behind the menu button at the top. On desktop you can shrink it to icons with the collapse button at the bottom.",
          },
        ],
      },
      {
        heading: "The bottom of the sidebar",
        blocks: [
          {
            type: "list",
            items: [
              { term: "Bell", text: "your notifications. The number shows how many are unread." },
              {
                term: "Help",
                text: "opens the Support guide for the page you are on, or this Support home if the page has no guide yet.",
              },
              { term: "Sign out", text: "ends your session on this device." },
              { term: "Theme", text: "switches the dashboard between light, dark and system." },
            ],
          },
        ],
      },
      {
        heading: "Still stuck?",
        blocks: [
          {
            type: "p",
            text: "Use the **feedback** button in the bottom-right corner of any page and pick **I'm not sure how this works**. Our team reads every message and the page you were on is attached automatically.",
          },
        ],
      },
    ],
  },
];
