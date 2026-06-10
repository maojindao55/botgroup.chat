import OpenAI from 'openai';
import { modelConfigs } from '../../src/config/aiCharacters';
import { evaluateClawShouldReply } from './clawReplyDecision';

interface CloudClawMember {
  id: string;
  group_id: string;
  name: string;
  cloud_model: string | null;
  cloud_system_prompt: string | null;
  cloud_reply_mode: string | null;
}

export interface CloudClawEnv {
  bgdb: D1Database;
  OPENAI_API_KEY?: string;
  CLOUD_CLAW_ENABLED?: string;
  [key: string]: unknown;
}

function isCloudClawEnabled(env: CloudClawEnv): boolean {
  if (env.CLOUD_CLAW_ENABLED === '0' || env.CLOUD_CLAW_ENABLED === 'false') {
    return false;
  }
  return Boolean(env.OPENAI_API_KEY?.trim());
}

async function listCloudMembers(db: D1Database, groupId: string) {
  const result = await db.prepare(
    `SELECT id, group_id, name, cloud_model, cloud_system_prompt, cloud_reply_mode
     FROM claw_members
     WHERE group_id = ? AND status = 1 AND member_type = 'cloud'`
  ).bind(groupId).all();
  return (result.results || []) as CloudClawMember[];
}

async function fetchGroupHistory(db: D1Database, groupId: string, limit = 20) {
  const rows = await db.prepare(
    `SELECT sender_name, sender_type, content FROM claw_messages
     WHERE group_id = ?
     ORDER BY id DESC
     LIMIT ?`
  ).bind(groupId, limit).all();

  return (rows.results || []).slice().reverse().map((row: Record<string, string>) => {
    const label = row.sender_type === 'claw' ? '🦞' : '👤';
    return {
      role: 'user' as const,
      content: `${label} ${row.sender_name}: ${row.content}`,
    };
  });
}

async function generateCloudReply(env: CloudClawEnv, member: CloudClawMember, groupId: string) {
  const modelName = member.cloud_model || 'gpt-4o-mini';
  const modelConfig = modelConfigs.find((c) => c.model === modelName);
  if (!modelConfig) {
    throw new Error(`不支持的云端模型: ${modelName}`);
  }

  const apiKey = env[modelConfig.apiKey] as string | undefined;
  if (!apiKey) {
    throw new Error(`${modelConfig.apiKey} 未配置`);
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: modelConfig.baseURL,
  });

  const history = await fetchGroupHistory(env.bgdb, groupId);
  const systemPrompt =
    (member.cloud_system_prompt || '') +
    `\n你在群里叫「${member.name}」。输出不要加「${member.name}：」前缀。技术问题可稍长，闲聊控制在 80 字以内。`;

  const completion = await openai.chat.completions.create({
    model: modelName,
    messages: [{ role: 'system', content: systemPrompt }, ...history],
    max_tokens: 1200,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('模型返回为空');
  }
  return text;
}

async function insertClawReply(
  db: D1Database,
  member: CloudClawMember,
  content: string,
  triggerMsgId?: number
) {
  const groupId = member.group_id;
  const clawId = member.id;

  const lastUserMsg = await db.prepare(
    `SELECT id FROM claw_messages
     WHERE group_id = ? AND sender_type = 'user'
     ORDER BY id DESC LIMIT 1`
  ).bind(groupId).first();
  const lastUserMsgId = (lastUserMsg?.id as number) || 0;

  const myReplies = await db.prepare(
    `SELECT COUNT(*) as cnt FROM claw_messages
     WHERE group_id = ? AND sender_id = ? AND sender_type = 'claw' AND id > ?`
  ).bind(groupId, clawId, lastUserMsgId).first();
  const nextRound = ((myReplies?.cnt as number) || 0) + 1;

  await db.prepare(
    `INSERT INTO claw_messages (group_id, sender_id, sender_name, sender_type, content, round, trigger_msg_id, created_at)
     VALUES (?, ?, ?, 'claw', ?, ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(groupId, clawId, member.name, content, nextRound, triggerMsgId ?? null)
    .run();
}

async function processCloudMember(env: CloudClawEnv, member: CloudClawMember, triggerMsgId?: number) {
  const db = env.bgdb;
  const decision = await evaluateClawShouldReply(db, {
    groupId: member.group_id,
    clawId: member.id,
    clawName: member.name,
    cloudReplyMode: member.cloud_reply_mode,
  });

  if (!decision.shouldReply) {
    await db.prepare('UPDATE claw_members SET thinking_at = NULL WHERE id = ?').bind(member.id).run();
    return;
  }

  await db
    .prepare(
      'UPDATE claw_members SET thinking_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
    .bind(member.id)
    .run();

  try {
    const replyText = await generateCloudReply(env, member, member.group_id);
    await insertClawReply(db, member, replyText, triggerMsgId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cloud-claw] ${member.name} failed:`, message);
  } finally {
    await db.prepare('UPDATE claw_members SET thinking_at = NULL WHERE id = ?').bind(member.id).run();
  }
}

/**
 * 用户发消息后由 Worker 触发云端龙虾回复（无需本地 OpenClaw / Codex）。
 */
export async function triggerCloudClawReplies(env: CloudClawEnv, groupId: string, triggerMsgId?: number) {
  if (!isCloudClawEnabled(env)) {
    return;
  }

  const members = await listCloudMembers(env.bgdb, groupId);
  if (members.length === 0) {
    return;
  }

  for (const member of members) {
    const thinkingClaws = await env.bgdb
      .prepare(
        `SELECT COUNT(*) as cnt FROM claw_members
         WHERE group_id = ? AND thinking_at IS NOT NULL AND id != ?`
      )
      .bind(groupId, member.id)
      .first();
    const delayMs = ((thinkingClaws?.cnt as number) || 0) * 5000;
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    await processCloudMember(env, member, triggerMsgId);
  }
}
