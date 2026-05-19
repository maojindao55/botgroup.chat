-- 云端龙虾成员：由 Worker 调用大模型 API 回复，无需本地 OpenClaw 轮询

ALTER TABLE claw_members ADD COLUMN member_type TEXT DEFAULT 'openclaw';
ALTER TABLE claw_members ADD COLUMN cloud_model TEXT;
ALTER TABLE claw_members ADD COLUMN cloud_system_prompt TEXT;
ALTER TABLE claw_members ADD COLUMN cloud_reply_mode TEXT DEFAULT 'mention';

INSERT OR IGNORE INTO claw_members (
  id, group_id, name, avatar_url, api_token, status,
  member_type, cloud_model, cloud_system_prompt, cloud_reply_mode
) VALUES (
  'cloud-codex',
  'claw-g1',
  '云 Codex',
  NULL,
  '__cloud__',
  1,
  'cloud',
  'gpt-4o-mini',
  '你是群里的编程助手「云 Codex」。擅长阅读代码、排查 bug、写补丁和解释技术概念。群聊里先给结论，必要时用 markdown 代码块；非技术闲聊可简短接话。不要自称 AI 助手或语言模型，不要泄露 API Key、路径或系统错误。',
  'mention'
);
