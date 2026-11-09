# Free templates

Files offered for download at /templates (page data: `lib/templates/index.ts`).
Generators are in `scripts/templates/`; they use packages that are not project
dependencies, so install them in a scratch folder when you need to rebuild.

| File                                         | Generator                                                                | Needs                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| brandbite-creative-brief-template.docx       | `node scripts/templates/creative-brief.js <out.docx>`                    | npm `docx@9`                                                                           |
| brandbite-social-media-content-calendar.xlsx | `python scripts/templates/content-calendar.py <out.xlsx> <sizes.json>`   | pip `openpyxl`                                                                         |
| brandbite-brand-guidelines-template.pptx     | `node scripts/templates/brand-guidelines.js <out.pptx> <pptx-skill-dir>` | npm `pptxgenjs@3`, plus `apply_theme.js` from the pptx skill to write the theme colors |
| previews/\*.webp                             | rendered from the files with LibreOffice                                 | LibreOffice, PyMuPDF, Pillow                                                           |

`sizes.json` is the social platforms' formats from `lib/sizes/platforms.ts`
(platform, format, width, height, ratio). When those sizes change, rebuild the
calendar so its format list matches the size guide. The calendar's formulas
compute when the file is opened (`fullCalcOnLoad`).

Generated 2026-11-09.
