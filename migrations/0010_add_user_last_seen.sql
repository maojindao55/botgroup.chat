-- Migration number: 0010    Add last_seen_at to claw_group_users for heartbeat-based online status

ALTER TABLE claw_group_users ADD COLUMN last_seen_at TIMESTAMP;
