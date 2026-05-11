import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./voteMessage.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { getPlayerRoleLabel, parseVoteResultMessage } = await import(moduleUrl);

const message = '投票完成：你 -> 阿哲，小秋 -> 阿哲，林川 -> 小秋。多数票投出 阿哲，游戏结束，身份已揭晓。';

assert.deepEqual(parseVoteResultMessage(message), {
  votes: [
    { voter: '你', target: '阿哲' },
    { voter: '小秋', target: '阿哲' },
    { voter: '林川', target: '小秋' },
  ],
  eliminatedName: '阿哲',
  resultLines: ['多数票投出 阿哲，游戏结束，身份已揭晓'],
});

const tiedMessage = '投票完成：你 -> A，A -> B，B -> 你。最高票并列（A、B、你），本轮无人出局，进入下一轮。';
assert.deepEqual(parseVoteResultMessage(tiedMessage), {
  votes: [
    { voter: '你', target: 'A' },
    { voter: 'A', target: 'B' },
    { voter: 'B', target: '你' },
  ],
  eliminatedName: null,
  resultLines: ['最高票并列（A、B、你），本轮无人出局，进入下一轮'],
});

assert.equal(getPlayerRoleLabel({
  player: { display_name: '阿哲', secret_role: 'human', ai_persona: 'undercover|role=undercover|word=猫|civilian=狗|undercover=猫' },
  isUndercoverMode: true,
}), '卧底');

assert.equal(getPlayerRoleLabel({
  player: { display_name: '小秋', secret_role: 'human', ai_persona: 'undercover|role=civilian|word=狗|civilian=狗|undercover=猫' },
  isUndercoverMode: true,
}), '平民');

assert.equal(getPlayerRoleLabel({
  player: { display_name: 'AI一号', secret_role: 'ai', ai_persona: '' },
  isUndercoverMode: false,
}), 'AI');
