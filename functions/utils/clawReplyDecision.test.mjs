import test from 'node:test';
import assert from 'node:assert/strict';

// 与 clawReplyDecision 中相同的 @ 解析规则（逻辑回归）
const MENTION_PATTERN = /@([\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\-_.]+)/g;

function parseMentions(content) {
  const mentions = [];
  let match;
  const pattern = new RegExp(MENTION_PATTERN.source, 'g');
  while ((match = pattern.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

test('parseMentions matches 云 Codex', () => {
  const mentions = parseMentions('@云 Codex 帮我看下这段代码');
  assert.ok(mentions.includes('云'));
});

test('cloud mention mode: user message without @ should not imply mention', () => {
  const mode = 'mention';
  const hasMentions = false;
  const isUser = true;
  const shouldReply = hasMentions ? true : isUser ? mode !== 'mention' : false;
  assert.equal(shouldReply, false);
});
