// -----------------------------------------------------------------------------
// @file: lib/csv.ts
// @purpose: Build CSV rows that are safe to open in a spreadsheet.
// -----------------------------------------------------------------------------

/** Excel reads this byte-order mark as "the file is UTF-8". */
export const CSV_BOM = "﻿";

/**
 * Text cells are always quoted. A cell that starts like a formula gets a leading
 * apostrophe, so free text such as notes can't run as a formula when opened in a
 * spreadsheet. Numbers stay real numbers, including negative ones.
 */
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  const safe = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}
