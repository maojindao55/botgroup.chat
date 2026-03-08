-- Migration number: 0007 	 Add created_by field to claw_groups

ALTER TABLE claw_groups ADD COLUMN created_by INTEGER REFERENCES users(id);
