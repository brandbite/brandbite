// -----------------------------------------------------------------------------
// @file: lib/brand-kit/font-faces.ts
// @purpose: Google Fonts used by the brand kit and font pairing pages, loaded
//           with next/font so they are downloaded at build time and served
//           from our own domain. Visitors' browsers never contact Google
//           (which matters for EU visitors under GDPR).
//
//           preload is off: a page only downloads the fonts it actually uses.
//           next/font needs literal options at module level, so each font is
//           declared on its own.
// -----------------------------------------------------------------------------

import {
  Archivo_Black,
  Bebas_Neue,
  Bricolage_Grotesque,
  Cormorant_Garamond,
  DM_Sans,
  DM_Serif_Display,
  Fraunces,
  Fredoka,
  IBM_Plex_Sans,
  Inter,
  Karla,
  Lato,
  Lexend,
  Libre_Baskerville,
  Lora,
  Manrope,
  Merriweather,
  Montserrat,
  Nunito,
  Open_Sans,
  Outfit,
  Playfair_Display,
  Poppins,
  Sora,
  Source_Sans_3,
  Space_Grotesk,
  Syne,
  Work_Sans,
} from "next/font/google";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["500", "700"],
});
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false });
const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false });
const fredoka = Fredoka({ subsets: ["latin"], display: "swap", preload: false });
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600"],
});
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false });
const karla = Karla({ subsets: ["latin"], display: "swap", preload: false });
const lato = Lato({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "700"] });
const lexend = Lexend({ subsets: ["latin"], display: "swap", preload: false });
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "700"],
});
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false });
const merriweather = Merriweather({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "700"],
});
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false });
const nunito = Nunito({ subsets: ["latin"], display: "swap", preload: false });
const openSans = Open_Sans({ subsets: ["latin"], display: "swap", preload: false });
const outfit = Outfit({ subsets: ["latin"], display: "swap", preload: false });
const playfairDisplay = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false });
const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600", "700"],
});
const sora = Sora({ subsets: ["latin"], display: "swap", preload: false });
const sourceSans3 = Source_Sans_3({ subsets: ["latin"], display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false });
const syne = Syne({ subsets: ["latin"], display: "swap", preload: false });
const workSans = Work_Sans({ subsets: ["latin"], display: "swap", preload: false });

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
