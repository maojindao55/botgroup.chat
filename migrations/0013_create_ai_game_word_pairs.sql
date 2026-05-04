-- Migration number: 0013    Cache generated undercover word pairs

CREATE TABLE IF NOT EXISTS ai_game_word_pairs (
    id TEXT PRIMARY KEY,
    tier TEXT NOT NULL,
    civilian_word TEXT NOT NULL,
    undercover_word TEXT NOT NULL,
    reason TEXT,
    source TEXT NOT NULL DEFAULT 'generated',
    used_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_game_word_pairs_tier_used
ON ai_game_word_pairs(tier, used_count, created_at);
