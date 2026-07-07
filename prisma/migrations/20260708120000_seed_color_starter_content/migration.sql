-- Starter content for the public color tools (Palette Ideas gallery + Color
-- Meanings encyclopedia) so the pages aren't empty on launch.
--
-- Idempotent: every row is keyed on its unique slug with ON CONFLICT DO
-- NOTHING, so re-running (or a re-deploy) never duplicates or overwrites. Site
-- admins can freely edit or delete these afterward — deletions won't reappear
-- because the slug will simply be absent (nothing re-inserts existing slugs).
-- Stable string ids (seed_pi_* / seed_cm_*) make the rows identifiable.

-- ---------------------------------------------------------------------------
-- Palette Ideas
-- ---------------------------------------------------------------------------
INSERT INTO "PaletteIdea" ("id", "title", "slug", "summary", "colors", "tags", "status", "publishedAt", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('seed_pi_vintage_sunset', 'Vintage Sunset', 'vintage-sunset', 'Warm, faded tones with a retro feel.',
   '["#e8c4a0","#d98859","#a0522d","#6b4226"]'::jsonb, ARRAY['Vintage','Warm'], 'PUBLISHED', CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_pi_corporate_trust', 'Corporate Trust', 'corporate-trust', 'Confident blues for a professional, dependable brand.',
   '["#1d3557","#457b9d","#a8dadc","#f1faee"]'::jsonb, ARRAY['Corporate','Cool'], 'PUBLISHED', CURRENT_TIMESTAMP, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_pi_neon_nights', 'Neon Nights', 'neon-nights', 'High-energy, electric colors that pop on dark backgrounds.',
   '["#ff006e","#fb5607","#ffbe0b","#8338ec","#3a86ff"]'::jsonb, ARRAY['Neon','Vibrant'], 'PUBLISHED', CURRENT_TIMESTAMP, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_pi_pastel_dream', 'Pastel Dream', 'pastel-dream', 'Soft, airy pastels for a gentle, friendly look.',
   '["#ffd6e0","#ffef9f","#c1fba4","#a0e7e5","#b8b8ff"]'::jsonb, ARRAY['Pastel','Soft'], 'PUBLISHED', CURRENT_TIMESTAMP, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_pi_earthy_calm', 'Earthy Calm', 'earthy-calm', 'Grounded greens and clays with a natural, organic mood.',
   '["#606c38","#283618","#dda15e","#bc6c25","#fefae0"]'::jsonb, ARRAY['Earthy','Natural'], 'PUBLISHED', CURRENT_TIMESTAMP, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_pi_mono_slate', 'Mono Slate', 'mono-slate', 'A clean grayscale ramp for minimal, modern interfaces.',
   '["#f8f9fa","#dee2e6","#adb5bd","#495057","#212529"]'::jsonb, ARRAY['Monochrome','Corporate'], 'PUBLISHED', CURRENT_TIMESTAMP, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_pi_berry_bold', 'Berry Bold', 'berry-bold', 'Rich berry reds and pinks for a confident, romantic brand.',
   '["#590d22","#a4133c","#ff4d6d","#ffb3c1","#fff0f3"]'::jsonb, ARRAY['Vibrant','Warm'], 'PUBLISHED', CURRENT_TIMESTAMP, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_pi_ocean_breeze', 'Ocean Breeze', 'ocean-breeze', 'Fresh blues from deep navy to pale sky.',
   '["#03045e","#0077b6","#00b4d8","#90e0ef","#caf0f8"]'::jsonb, ARRAY['Cool','Fresh'], 'PUBLISHED', CURRENT_TIMESTAMP, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Color Meanings
-- ---------------------------------------------------------------------------
INSERT INTO "ColorMeaning" ("id", "name", "slug", "hex", "summary", "meaning", "associations", "samplePalettes", "status", "publishedAt", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('seed_cm_red', 'Red', 'red', '#e63946', 'Energy, passion, and urgency.',
   '<p>Red is the most physically stimulating color. It raises the pulse and grabs attention faster than any other hue, which is why it dominates sales, warnings, and calls to action.</p><p>Used well, red signals <strong>passion, confidence, and appetite</strong>; overused, it can feel aggressive. A little goes a long way.</p>',
   ARRAY['passion','energy','urgency','appetite','warning'],
   '[["#e63946","#f1faee","#1d3557"],["#a4133c","#ff4d6d","#fff0f3"]]'::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_cm_orange', 'Orange', 'orange', '#f4801f', 'Warmth, enthusiasm, and creativity.',
   '<p>Orange blends the energy of red with the cheer of yellow. It reads as <strong>friendly, playful, and affordable</strong>, which makes it popular for brands that want to feel approachable and energetic.</p>',
   ARRAY['warmth','enthusiasm','creativity','playful','affordable'],
   '[["#f4801f","#ffb703","#023047"],["#fb8500","#ffb703","#8ecae6"]]'::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_cm_yellow', 'Yellow', 'yellow', '#ffd60a', 'Optimism, clarity, and attention.',
   '<p>Yellow is the color of sunshine and optimism. It is the most visible color in daylight, so it draws the eye — but at high saturation it can tire the eyes quickly. Best as an accent that signals <strong>happiness and caution</strong> alike.</p>',
   ARRAY['optimism','happiness','clarity','caution','warmth'],
   '[["#ffd60a","#003566","#ffffff"],["#ffef9f","#606c38","#283618"]]'::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_cm_green', 'Green', 'green', '#2a9d8f', 'Growth, health, and balance.',
   '<p>Green sits at the center of the spectrum and feels the most restful to the eye. It carries strong associations with <strong>nature, health, and money</strong>, making it a natural fit for wellness, finance, and sustainability brands.</p>',
   ARRAY['growth','health','nature','balance','money'],
   '[["#2a9d8f","#e9c46a","#264653"],["#606c38","#dda15e","#fefae0"]]'::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_cm_blue', 'Blue', 'blue', '#0077b6', 'Trust, calm, and professionalism.',
   '<p>Blue is the world''s most-loved color and the default of trust. It lowers the pulse and reads as <strong>calm, reliable, and competent</strong> — which is why banks, tech, and healthcare lean on it so heavily.</p>',
   ARRAY['trust','calm','professional','reliable','cool'],
   '[["#0077b6","#90e0ef","#03045e"],["#1d3557","#457b9d","#f1faee"]]'::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_cm_purple', 'Purple', 'purple', '#7b2cbf', 'Luxury, creativity, and imagination.',
   '<p>Historically the most expensive dye to produce, purple still signals <strong>royalty, luxury, and craft</strong>. It also leans creative and imaginative, bridging the calm of blue and the energy of red.</p>',
   ARRAY['luxury','creativity','royalty','imagination','spirituality'],
   '[["#7b2cbf","#c77dff","#10002b"],["#8338ec","#3a86ff","#ffbe0b"]]'::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_cm_black', 'Black', 'black', '#212529', 'Sophistication, power, and elegance.',
   '<p>Black is absence and authority at once. It reads as <strong>elegant, premium, and timeless</strong>, which is why luxury and fashion brands use it to project confidence and let other elements breathe.</p>',
   ARRAY['sophistication','power','elegance','luxury','formality'],
   '[["#212529","#f8f9fa","#e63946"],["#000000","#ffd60a","#ffffff"]]'::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_cm_white', 'White', 'white', '#f8f9fa', 'Simplicity, cleanliness, and space.',
   '<p>White is clarity and room to breathe. It signals <strong>simplicity, cleanliness, and honesty</strong>, and gives every other color around it more impact. The backbone of minimal, modern design.</p>',
   ARRAY['simplicity','cleanliness','space','purity','minimalism'],
   '[["#f8f9fa","#212529","#0077b6"],["#ffffff","#dee2e6","#495057"]]'::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
