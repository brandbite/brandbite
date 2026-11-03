// -----------------------------------------------------------------------------
// @file: lib/support/guides/customer.ts
// @purpose: Support guides for the customer dashboard (/customer/**).
//           Keep in sync with CUSTOMER_NAV and the pages they describe —
//           when a customer page changes, update its guide in the same PR.
// -----------------------------------------------------------------------------

import type { SupportGuide } from "../types";

export const CUSTOMER_GUIDES: SupportGuide[] = [
  {
    slug: "getting-around",
    title: "Getting around your dashboard",
    summary: "What each part of the sidebar is for and where to find help.",
    category: "Getting started",
    routes: ["/customer/support"],
    keywords: ["navigation", "sidebar", "menu", "start", "help"],
    sections: [
      {
        heading: "The sidebar",
        blocks: [
          {
            type: "p",
            text: "Everything in your dashboard is reached from the sidebar on the left. It is grouped into three sections:",
          },
          {
            type: "list",
            items: [
              {
                term: "Workspace",
                text: "your day-to-day work: **Overview**, the **Board** with all your requests, **Moodboards** and **AI Tools**.",
              },
              {
                term: "Billing",
                text: "**Services** you can request, your **Tokens** balance and history, and **Consultation** bookings.",
              },
              {
                term: "Account",
                text: "your **Profile**, the **Members** of your company, **Settings**, the **FAQ** and this **Support** section.",
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
