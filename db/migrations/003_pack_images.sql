-- Add image_url to trivia_packs and backfill with placeholder
ALTER TABLE trivia_packs
  ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '/Trivia-Default.png';

-- Touch updated_at for existing rows to reflect backfill
UPDATE trivia_packs SET updated_at = now();
