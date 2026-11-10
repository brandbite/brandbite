// -----------------------------------------------------------------------------
// @file: components/ui/stacked-table.ts
// @purpose: Class names that turn a plain HTML table into stacked cards below
//           640px, so phones get every value without sideways scrolling. Each
//           row becomes a card: the row header is its title and every cell
//           shows its column name from `data-label`. Wide screens keep the
//           normal table. Class names are written out in full so Tailwind
//           can find them.
// -----------------------------------------------------------------------------

export const stackedTable = {
  /** On the <table>, next to its min-width. */
  table: "max-[639px]:block max-[639px]:min-w-0",
  /** On the <caption>. */
  caption: "max-[639px]:block",
  /** On the <thead>: the column names move into each cell's label. */
  head: "max-[639px]:hidden",
  /** On the <tbody>. */
  body: "max-[639px]:block",
  /** On each <tr>. */
  row: "max-[639px]:flex max-[639px]:flex-col max-[639px]:px-5 max-[639px]:py-3",
  /** On the row's <th scope="row">: the card's title, always shown first. */
  rowHeader: "max-[639px]:order-first max-[639px]:px-0 max-[639px]:pt-0 max-[639px]:pb-1",
  /** On each <td>, together with a `data-label` attribute. */
  cell: "max-[639px]:flex max-[639px]:justify-between max-[639px]:gap-4 max-[639px]:px-0 max-[639px]:py-1 max-[639px]:text-right max-[639px]:before:text-left max-[639px]:before:text-[var(--cs-muted)] max-[639px]:before:content-[attr(data-label)]",
};
