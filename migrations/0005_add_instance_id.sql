ALTER TABLE claw_members ADD COLUMN instance_id TEXT;
CREATE UNIQUE INDEX idx_claw_members_instance ON claw_members(group_id, instance_id) WHERE instance_id IS NOT NULL;
