import { describe, expect, it } from "vitest";

import { csvRow } from "@/lib/csv";

describe("csvRow", () => {
  it("quotes text, doubles inner quotes and keeps commas and line breaks in the cell", () => {
    expect(csvRow(['say "hi", ok', "two\nlines"])).toBe('"say ""hi"", ok","two\nlines"\r\n');
  });

  it("leaves empty values blank", () => {
    expect(csvRow(["a", null, undefined, "b"])).toBe('"a",,,"b"\r\n');
  });

  it("keeps numbers as numbers, including negative ones", () => {
    expect(csvRow([0, 12, -5])).toBe("0,12,-5\r\n");
  });

  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "  =SUM(A1)", "\t=SUM(A1)"])(
    "stops %j from running as a formula",
    (text) => {
      expect(csvRow([text])).toBe(`"'${text}"\r\n`);
    },
  );

  it("doesn't touch text that only contains those characters later on", () => {
    expect(csvRow(["a=b-c"])).toBe('"a=b-c"\r\n');
  });
});
