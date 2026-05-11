-- Migration number: 0017 	 Add Linux.do OAuth fields to users table

ALTER TABLE users ADD COLUMN linuxdo_id TEXT;
ALTER TABLE users ADD COLUMN linuxdo_username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_linuxdo_id ON users(linuxdo_id);
