-- Migration number: 0015    Store ai-game campaign metadata outside room title

ALTER TABLE ai_game_rooms ADD COLUMN word_tier TEXT;
ALTER TABLE ai_game_rooms ADD COLUMN campaign_level INTEGER;

CREATE INDEX IF NOT EXISTS idx_ai_game_word_pairs_tier_last_used
ON ai_game_word_pairs(tier, last_used_at, used_count);
