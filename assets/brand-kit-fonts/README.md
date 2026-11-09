# Brand kit fonts

Latin-subset WOFF2 files for the fonts in `lib/brand-kit/fonts.ts`, used by
`lib/brand-kit/font-faces.ts` through `next/font/local`.

Downloaded 2026-11-09 from the Fontsource packages on jsDelivr:

- variable fonts: `@fontsource-variable/<id>/files/<id>-latin-wght-normal.woff2`
- static fonts: `@fontsource/<id>/files/<id>-latin-<weight>-normal.woff2`

All are Google Fonts released under the SIL Open Font License 1.1
(https://openfontlicense.org), which allows bundling and commercial use.
To add a font, download it the same way, add it to `fonts.ts` and declare it
in `font-faces.ts`.
