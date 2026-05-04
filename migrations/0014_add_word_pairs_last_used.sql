-- Migration number: 0014    Add last_used_at to ai_game_word_pairs for round-robin diversity

ALTER TABLE ai_game_word_pairs ADD COLUMN last_used_at TIMESTAMP;
