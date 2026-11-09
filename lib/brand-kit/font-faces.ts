// -----------------------------------------------------------------------------
// @file: lib/brand-kit/font-faces.ts
// @purpose: Fonts used by the brand kit and font pairing pages, loaded with
//           next/font/local from files in assets/brand-kit-fonts (latin
//           subset, from the Fontsource packages of these Google Fonts, all
//           under the SIL Open Font License). Nothing is fetched from Google,
//           neither by visitors (GDPR) nor at build time: next/font/google
//           failed a Vercel build when one download didn't arrive.
//
//           preload is off: a page only downloads the fonts it actually uses.
//           next/font needs literal options at module level, so each font is
//           declared on its own.
// -----------------------------------------------------------------------------

import localFont from "next/font/local";

const archivoBlack = localFont({
  src: [
    {
      path: "../../assets/brand-kit-fonts/archivo-black-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
});
const bebasNeue = localFont({
  src: [
    { path: "../../assets/brand-kit-fonts/bebas-neue-400.woff2", weight: "400", style: "normal" },
  ],
  display: "swap",
  preload: false,
});
const bricolageGrotesque = localFont({
  src: "../../assets/brand-kit-fonts/bricolage-grotesque.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const cormorantGaramond = localFont({
  src: "../../assets/brand-kit-fonts/cormorant-garamond.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const dmSans = localFont({
  src: "../../assets/brand-kit-fonts/dm-sans.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const dmSerifDisplay = localFont({
  src: [
    {
      path: "../../assets/brand-kit-fonts/dm-serif-display-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
});
const fraunces = localFont({
  src: "../../assets/brand-kit-fonts/fraunces.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const fredoka = localFont({
  src: "../../assets/brand-kit-fonts/fredoka.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const ibmPlexSans = localFont({
  src: "../../assets/brand-kit-fonts/ibm-plex-sans.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const inter = localFont({
  src: "../../assets/brand-kit-fonts/inter.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const karla = localFont({
  src: "../../assets/brand-kit-fonts/karla.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const lato = localFont({
  src: [
    { path: "../../assets/brand-kit-fonts/lato-400.woff2", weight: "400", style: "normal" },
    { path: "../../assets/brand-kit-fonts/lato-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
});
const lexend = localFont({
  src: "../../assets/brand-kit-fonts/lexend.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const libreBaskerville = localFont({
  src: [
    {
      path: "../../assets/brand-kit-fonts/libre-baskerville-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../assets/brand-kit-fonts/libre-baskerville-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
});
const lora = localFont({
  src: "../../assets/brand-kit-fonts/lora.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const manrope = localFont({
  src: "../../assets/brand-kit-fonts/manrope.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const merriweather = localFont({
  src: "../../assets/brand-kit-fonts/merriweather.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const montserrat = localFont({
  src: "../../assets/brand-kit-fonts/montserrat.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const nunito = localFont({
  src: "../../assets/brand-kit-fonts/nunito.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const openSans = localFont({
  src: "../../assets/brand-kit-fonts/open-sans.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const outfit = localFont({
  src: "../../assets/brand-kit-fonts/outfit.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const playfairDisplay = localFont({
  src: "../../assets/brand-kit-fonts/playfair-display.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const poppins = localFont({
  src: [
    { path: "../../assets/brand-kit-fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "../../assets/brand-kit-fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "../../assets/brand-kit-fonts/poppins-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
});
const sora = localFont({
  src: "../../assets/brand-kit-fonts/sora.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const sourceSans3 = localFont({
  src: "../../assets/brand-kit-fonts/source-sans-3.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const spaceGrotesk = localFont({
  src: "../../assets/brand-kit-fonts/space-grotesk.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const syne = localFont({
  src: "../../assets/brand-kit-fonts/syne.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const workSans = localFont({
  src: "../../assets/brand-kit-fonts/work-sans.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});

/** The CSS font-family value for each font id, as next/font generated it. */
export const FONT_FAMILY: Record<string, string> = {
  "archivo-black": archivoBlack.style.fontFamily,
  "bebas-neue": bebasNeue.style.fontFamily,
  "bricolage-grotesque": bricolageGrotesque.style.fontFamily,
  "cormorant-garamond": cormorantGaramond.style.fontFamily,
  "dm-sans": dmSans.style.fontFamily,
  "dm-serif-display": dmSerifDisplay.style.fontFamily,
  fraunces: fraunces.style.fontFamily,
  fredoka: fredoka.style.fontFamily,
  "ibm-plex-sans": ibmPlexSans.style.fontFamily,
  inter: inter.style.fontFamily,
  karla: karla.style.fontFamily,
  lato: lato.style.fontFamily,
  lexend: lexend.style.fontFamily,
  "libre-baskerville": libreBaskerville.style.fontFamily,
  lora: lora.style.fontFamily,
  manrope: manrope.style.fontFamily,
  merriweather: merriweather.style.fontFamily,
  montserrat: montserrat.style.fontFamily,
  nunito: nunito.style.fontFamily,
  "open-sans": openSans.style.fontFamily,
  outfit: outfit.style.fontFamily,
  "playfair-display": playfairDisplay.style.fontFamily,
  poppins: poppins.style.fontFamily,
  sora: sora.style.fontFamily,
  "source-sans-3": sourceSans3.style.fontFamily,
  "space-grotesk": spaceGrotesk.style.fontFamily,
  syne: syne.style.fontFamily,
  "work-sans": workSans.style.fontFamily,
};
