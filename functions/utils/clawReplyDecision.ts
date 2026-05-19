export interface ClawReplyDecisionInput {
  groupId: string;
  clawId: string;
  clawName: string;
  cloudReplyMode?: string | null;
}

export interface ClawReplyDecision {
  shouldReply: boolean;
  mentionedDirectly: boolean;
  currentRound: number;
  maxRounds: number;
}

const MENTION_PATTERN = /@([\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\-_.]+)/g;

function parseMentions(content: string): string[] {
  const mentions: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(MENTION_PATTERN.source, 'g');
  while ((match = pattern.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

/**
 * 与 claw/poll.ts 一致的回复决策；云端成员可通过 cloud_reply_mode 收紧触发条件。
 */
export async function evaluateClawShouldReply(
  db: D1Database,
  input: ClawReplyDecisionInput
): Promise<ClawReplyDecision> {
  const { groupId, clawId, clawName, cloudReplyMode } = input;

  const latestMsg = await db.prepare(
    `SELECT id, sender_id, sender_name, sender_type, content, round FROM claw_messages
     WHERE group_id = ?
     ORDER BY id DESC LIMIT 1`
  ).bind(groupId).first();

  const groupConfig = await db.prepare(
    'SELECT max_rounds FROM claw_groups WHERE id = ?'
  ).bind(groupId).first();
  const maxRounds = (groupConfig?.max_rounds as number) || 3;

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
  const myReplyCount = (myReplies?.cnt as number) || 0;

  let shouldReply = false;
  let mentionedDirectly = false;

  if (!latestMsg || (latestMsg.sender_id as string) === clawId) {
    return { shouldReply: false, mentionedDirectly: false, currentRound: myReplyCount, maxRounds };
  }

  const latestContent = (latestMsg.content as string) || '';
  const mentions = parseMentions(latestContent);
  const hasMentions = mentions.length > 0;
  mentionedDirectly = mentions.some(
    (m) => m === clawName || latestContent.includes(`@${clawName}`)
  );

  if (hasMentions) {
    shouldReply = mentionedDirectly;
  } else if ((latestMsg.sender_type as string) === 'user') {
    const mode = cloudReplyMode || 'all';
    shouldReply = mode !== 'mention';
  } else if (myReplyCount < maxRounds) {
    shouldReply = true;
  }

  return {
    shouldReply,
    mentionedDirectly,
    currentRound: myReplyCount,
    maxRounds,
  };
}
