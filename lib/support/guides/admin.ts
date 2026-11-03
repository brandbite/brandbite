// -----------------------------------------------------------------------------
// @file: lib/support/guides/admin.ts
// @purpose: Support guides for the admin dashboard (/admin/**). Keep in sync
//           with ADMIN_NAV and the pages they describe — when an admin page
//           changes, update its guide in the same PR. Guides for ownerOnly
//           pages set `ownerOnly: true` so SITE_ADMINs don't see them.
// -----------------------------------------------------------------------------

import type { SupportGuide } from "../types";

export const ADMIN_GUIDES: SupportGuide[] = [
  {
    slug: "getting-around",
    title: "Getting around the admin",
    summary: "How the admin is organised, how to jump to any page, and where help lives.",
    category: "Getting started",
    routes: ["/admin/support"],
    keywords: ["navigation", "sidebar", "menu", "start", "help", "command palette", "shortcut"],
    sections: [
      {
        heading: "The sidebar",
        blocks: [
          {
            type: "p",
            text: "Admin pages are grouped into sections in the sidebar: **Workspace**, **Catalog**, **Finance**, **People**, **Content** and **System**. Click a section name to fold or unfold it. Your choice is remembered.",
          },
          {
            type: "p",
            text: "**Support** and **Settings** are pinned at the bottom of the sidebar, above your account menu.",
          },
          {
            type: "tip",
            text: "Some pages, such as Talent applications, Audit Log and Two-factor, are only visible to the site owner.",
          },
        ],
      },
      {
        heading: "The top bar",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Breadcrumb",
                text: "shows which section and page you are on.",
              },
              {
                term: "Search workspace",
                text: "jumps to any admin page by name. Press **Ctrl K** (**⌘K** on a Mac) from anywhere.",
              },
              {
                term: "Help",
                text: "opens the Support guide for the page you are on, or this Support home if the page has no guide yet.",
              },
              { term: "Bell", text: "your notifications." },
            ],
          },
        ],
      },
      {
        heading: "Unsaved changes",
        blocks: [
          {
            type: "p",
            text: "Editors warn you before you leave a page with changes you haven't saved, including when you click a sidebar link, use the search, sign out or close the tab.",
          },
        ],
      },
    ],
  },
];
