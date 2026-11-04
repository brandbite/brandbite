// -----------------------------------------------------------------------------
// @file: lib/colors/palette-idea-catalog.ts
// @purpose: Built-in curated palettes shown after the CMS-managed PaletteIdea
//           entries in the Palette ideas gallery.
// -----------------------------------------------------------------------------

export interface PaletteIdeaEntry {
  id: string;
  title: string;
  slug: string;
  summary: string;
  colors: string[];
  tags: string[];
}

function idea(title: string, summary: string, colors: string[], tags: string[]): PaletteIdeaEntry {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { id: `catalog-${slug}`, title, slug, summary, colors, tags };
}

export const PALETTE_IDEA_CATALOG: PaletteIdeaEntry[] = [
  idea(
    "Terracotta Courtyard",
    "Sun-baked clay with cool shade.",
    ["#7a3b24", "#c4633a", "#e8a77c", "#f5e3cf", "#2f5d62"],
    ["Earthy", "Warm"],
  ),
  idea(
    "Nordic Morning",
    "Pale light over quiet blue-gray.",
    ["#22333b", "#5e7c8b", "#a9bcc4", "#e3e8ea", "#f7f4ef"],
    ["Cool", "Soft"],
  ),
  idea(
    "Citrus Market",
    "Juicy and bright with a green snap.",
    ["#ff9f1c", "#ffbf69", "#fff3d6", "#cbdf6b", "#2ec4b6"],
    ["Fresh", "Vibrant"],
  ),
  idea(
    "Velvet Lounge",
    "Moody plum with a warm gold accent.",
    ["#1f1029", "#4a1c5e", "#8e3b7b", "#d98e73", "#f2c572"],
    ["Vibrant", "Vintage"],
  ),
  idea(
    "Sage Studio",
    "Muted greens for a calm, modern brand.",
    ["#2f3e36", "#5c7566", "#94a89a", "#d5ddd2", "#f4f2ea"],
    ["Natural", "Soft"],
  ),
  idea(
    "Fintech Night",
    "Confident navy with an electric accent.",
    ["#0b1426", "#172a4f", "#2f5fd0", "#5ee0c9", "#eef2fb"],
    ["Corporate", "Cool"],
  ),
  idea(
    "Peach Fuzz Club",
    "Soft peach with a playful berry edge.",
    ["#ffe5d4", "#ffc6a8", "#ff9e7d", "#e8596c", "#6b2747"],
    ["Pastel", "Warm"],
  ),
  idea(
    "Desert Dusk",
    "Dusty rose fading into evening blue.",
    ["#f3d9c5", "#d99b82", "#a8605c", "#5c4567", "#23304f"],
    ["Earthy", "Vintage"],
  ),
  idea(
    "Arcade Pop",
    "Loud, glowing colors made for dark screens.",
    ["#0d0221", "#f706cf", "#7b2ff7", "#00e5ff", "#fdf500"],
    ["Neon", "Vibrant"],
  ),
  idea(
    "Paper and Ink",
    "A classic editorial grayscale.",
    ["#111214", "#3a3c40", "#7b7e84", "#c9cbce", "#f6f5f1"],
    ["Monochrome", "Corporate"],
  ),
  idea(
    "Orchard Harvest",
    "Apple red and leafy green, ripe and homely.",
    ["#8c1c13", "#c94c35", "#f2c078", "#7a9a4f", "#3c5a35"],
    ["Natural", "Warm"],
  ),
  idea(
    "Lagoon Drift",
    "Clear turquoise over warm sand.",
    ["#04506a", "#0c8fa8", "#58cfd2", "#c6f0ea", "#f6e7cb"],
    ["Cool", "Fresh"],
  ),
  idea(
    "Lavender Fields",
    "Gentle violets with a soft green note.",
    ["#3f3567", "#7766a8", "#b6a7dc", "#e6dff5", "#a9c29a"],
    ["Pastel", "Soft"],
  ),
  idea(
    "Retro Diner",
    "Cherry, cream and teal from another decade.",
    ["#b3202c", "#f05d4d", "#fbe9c6", "#55b5ae", "#1e4b57"],
    ["Vintage", "Vibrant"],
  ),
  idea(
    "Forest Cabin",
    "Deep pines with weathered wood.",
    ["#14281d", "#2d4a36", "#6b7d5a", "#a6815b", "#e8ddc7"],
    ["Earthy", "Natural"],
  ),
  idea(
    "Clean Clinic",
    "Reassuring blues and plenty of air.",
    ["#123c69", "#2a7fba", "#8fc7e8", "#dff1f9", "#ffffff"],
    ["Corporate", "Fresh"],
  ),
  idea(
    "Sorbet Stand",
    "Light, cool scoops of summer color.",
    ["#ffc2d1", "#ffe5a3", "#c8f2c2", "#b5e8f7", "#d9c7f5"],
    ["Pastel", "Fresh"],
  ),
  idea(
    "Copper Workshop",
    "Burnished metal against dark steel.",
    ["#1d2125", "#3e464d", "#b0623a", "#dc9a68", "#f2e6d8"],
    ["Earthy", "Corporate"],
  ),
  idea(
    "Midnight Festival",
    "Deep violet lit by hot pink and amber.",
    ["#120a2a", "#37106b", "#ff2e93", "#ff9e2c", "#fff1c9"],
    ["Neon", "Warm"],
  ),
  idea(
    "Olive Grove",
    "Silvery greens with a Mediterranean warmth.",
    ["#3b3f24", "#6c7236", "#a8ab6d", "#e4dfb8", "#b5683c"],
    ["Natural", "Earthy"],
  ),
  idea(
    "Blush Stationery",
    "Delicate pinks with a refined charcoal.",
    ["#fdf0ed", "#f7d3cf", "#e6a7a8", "#a86a78", "#3d3438"],
    ["Soft", "Warm"],
  ),
  idea(
    "Glacier Line",
    "An icy ramp from deep water to frost.",
    ["#0a2a43", "#17567a", "#3f8fb5", "#9dd0e3", "#e7f6fa"],
    ["Monochrome", "Cool"],
  ),
  idea(
    "Marigold Parade",
    "Golden and festive with a rich magenta.",
    ["#f9a602", "#fbc531", "#fff2c2", "#d6246e", "#5a1846"],
    ["Vibrant", "Warm"],
  ),
  idea(
    "Vintage Postcard",
    "Faded teal, mustard and coral.",
    ["#2f6f73", "#7fb0a6", "#e9c46a", "#e58e5f", "#f7ecd8"],
    ["Vintage", "Soft"],
  ),
  idea(
    "Startup Violet",
    "A friendly, techy purple with warm contrast.",
    ["#1c1537", "#4b2fd6", "#8b76f5", "#e5e0ff", "#ff7a59"],
    ["Corporate", "Vibrant"],
  ),
  idea(
    "Morning Matcha",
    "Creamy green with a soft earthy base.",
    ["#3f5a36", "#7f9f57", "#c3d59a", "#f1f2d9", "#a58a6d"],
    ["Fresh", "Natural"],
  ),
  idea(
    "Rust and Denim",
    "Workwear blue with oxidized orange.",
    ["#14263d", "#35577d", "#8aa5c2", "#c6622f", "#efe2d0"],
    ["Vintage", "Cool"],
  ),
  idea(
    "Laser Grid",
    "Saturated lines on near black.",
    ["#08090f", "#39ff14", "#00c2ff", "#ff2079", "#f4f4f4"],
    ["Neon", "Cool"],
  ),
  idea(
    "Warm Neutrals",
    "Oat, sand and espresso for an easy base.",
    ["#2e2622", "#6e5b4f", "#a8937f", "#d9cbb8", "#f6f0e6"],
    ["Monochrome", "Earthy"],
  ),
  idea(
    "Coral Reef",
    "Living coral against tropical water.",
    ["#ff6f61", "#ffa48e", "#ffe0d1", "#29b6b0", "#0d4f5c"],
    ["Fresh", "Vibrant"],
  ),
  idea(
    "Boardroom Slate",
    "Steady blue-grays with one assured accent.",
    ["#1b2733", "#3b4d5e", "#7c8d9c", "#e4e8ec", "#c8963e"],
    ["Corporate", "Cool"],
  ),
  idea(
    "Rose Garden",
    "Layered pinks and a leafy counterpoint.",
    ["#7a1f3d", "#c2476d", "#f09bb0", "#fbe1e6", "#4f7a5a"],
    ["Natural", "Warm"],
  ),
  idea(
    "Cotton Candy Sky",
    "Dreamy pink and blue at sunset.",
    ["#ffd1e8", "#f9b4e0", "#c9b6f2", "#a8d8f5", "#fff4e0"],
    ["Pastel", "Soft"],
  ),
  idea(
    "Ember Glow",
    "A hot ramp from dark coal to bright flame.",
    ["#2a0a05", "#7a1c0b", "#c9390f", "#f4791f", "#ffc65c"],
    ["Monochrome", "Warm"],
  ),
  idea(
    "Seaside Linen",
    "Airy blues and washed-out naturals.",
    ["#2c5a6e", "#79a7b5", "#c9dfe2", "#efe8da", "#c7ae8f"],
    ["Soft", "Cool"],
  ),
  idea(
    "Jungle Canopy",
    "Dense greens with a flash of tropical bird.",
    ["#0c2b1f", "#1d5a3c", "#3f9a5f", "#a3d977", "#ff8a3c"],
    ["Vibrant", "Natural"],
  ),
  idea(
    "Art Deco Gold",
    "Black lacquer, emerald and brass.",
    ["#101010", "#0f4c3a", "#b08d3c", "#e3c878", "#f6efd9"],
    ["Vintage", "Corporate"],
  ),
  idea(
    "Spring Picnic",
    "Sunny and casual, with blue skies.",
    ["#ffe066", "#f7a072", "#f25f8a", "#70c1b3", "#247ba0"],
    ["Fresh", "Vibrant"],
  ),
  idea(
    "Inkwell Blue",
    "One blue from deep ink to pale wash.",
    ["#071a3a", "#123a7a", "#2f6bc4", "#8db4ea", "#e4eefb"],
    ["Monochrome", "Corporate"],
  ),
  idea(
    "Autumn Trail",
    "Falling leaves on a cool morning.",
    ["#5a2a1a", "#a34a1f", "#d98a2b", "#e9c46a", "#5b7065"],
    ["Earthy", "Warm"],
  ),
];
