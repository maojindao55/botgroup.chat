-- Migration number: 0011    "Who is AI" game rooms

CREATE TABLE IF NOT EXISTS ai_game_rooms (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'classic',
    status TEXT NOT NULL DEFAULT 'waiting',
    title TEXT,
    max_players INTEGER DEFAULT 6,
    ai_count INTEGER DEFAULT 2,
    duration_seconds INTEGER DEFAULT 180,
    message_limit INTEGER DEFAULT 50,
    created_by INTEGER,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_game_players (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id INTEGER,
    display_name TEXT NOT NULL,
    player_type TEXT NOT NULL CHECK(player_type IN ('human', 'ai', 'observer')),
    secret_role TEXT NOT NULL CHECK(secret_role IN ('human', 'ai', 'observer')),
    ai_persona TEXT,
    seat_index INTEGER,
    is_online INTEGER DEFAULT 1,
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES ai_game_rooms(id)
);

CREATE TABLE IF NOT EXISTS ai_game_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK(sender_type IN ('human', 'ai', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES ai_game_rooms(id)
);

CREATE TABLE IF NOT EXISTS ai_game_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    voter_player_id TEXT NOT NULL,
    target_player_id TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, voter_player_id)
);

CREATE TABLE IF NOT EXISTS ai_game_results (
    room_id TEXT PRIMARY KEY,
    human_accuracy REAL,
    ai_escape_rate REAL,
    best_disguised_player_id TEXT,
    summary TEXT,
    share_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_game_players_room ON ai_game_players(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_game_messages_room_id ON ai_game_messages(room_id, id);
CREATE INDEX IF NOT EXISTS idx_ai_game_votes_room ON ai_game_votes(room_id);
