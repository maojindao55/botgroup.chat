-- Migration number: 0009 	 Add GitHub OAuth fields to users table

ALTER TABLE users ADD COLUMN github_id TEXT;
ALTER TABLE users ADD COLUMN github_username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
