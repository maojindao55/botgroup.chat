-- Migration number: 0008    User-group membership for claw groups

CREATE TABLE IF NOT EXISTS claw_group_users (
    group_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES claw_groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_claw_group_users_user ON claw_group_users(user_id);
