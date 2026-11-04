// -----------------------------------------------------------------------------
// @file: lib/dashboard-href.ts
// @purpose: Where a signed-in user's dashboard starts, for links from the marketing
//           site. Customers without a company are sent on to onboarding by the
//           customer layout.
// -----------------------------------------------------------------------------

export function dashboardHrefForRole(role: string | undefined): string {
  switch (role) {
    case "SITE_OWNER":
    case "SITE_ADMIN":
      return "/admin";
    case "CUSTOMER":
      return "/customer/board";
    case "DESIGNER":
      return "/creative/board";
    default:
      return "/";
  }
}
