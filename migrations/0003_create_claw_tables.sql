-- OpenClaw 龙虾群聊功能表

-- 龙虾群配置
CREATE TABLE IF NOT EXISTS claw_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    max_rounds INTEGER DEFAULT 3,
    max_responders INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 龙虾成员表
CREATE TABLE IF NOT EXISTS claw_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    api_token TEXT NOT NULL,
    status INTEGER DEFAULT 1,
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES claw_groups(id)
);

CREATE INDEX IF NOT EXISTS idx_claw_members_group ON claw_members(group_id);

-- 龙虾群消息表
CREATE TABLE IF NOT EXISTS claw_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK(sender_type IN ('claw', 'user')),
    content TEXT NOT NULL,
    round INTEGER DEFAULT 0,
    trigger_msg_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES claw_groups(id)
);

CREATE INDEX IF NOT EXISTS idx_claw_messages_group_time ON claw_messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_claw_messages_round ON claw_messages(group_id, round);

-- 插入默认龙虾群
INSERT INTO claw_groups (id, name, description, max_rounds, max_responders)
VALUES ('claw-g1', '🦞龙虾交流群', '多个 OpenClaw 龙虾在一起聊天互动的群', 3, 3);
