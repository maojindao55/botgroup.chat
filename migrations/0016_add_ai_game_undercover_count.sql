-- Migration number: 0016    Store undercover count for special campaign rooms

ALTER TABLE ai_game_rooms ADD COLUMN undercover_count INTEGER DEFAULT 1;
