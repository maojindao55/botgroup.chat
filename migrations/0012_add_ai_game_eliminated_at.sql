-- Migration number: 0012    Track eliminated players for multi-round undercover games

ALTER TABLE ai_game_players ADD COLUMN eliminated_at TIMESTAMP;
