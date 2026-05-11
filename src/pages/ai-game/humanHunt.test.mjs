import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTs(sourcePath) {
  const source = await readFile(sourcePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
  return import(moduleUrl);
}

const configModule = await importTs(new URL('../../config/aiGame.ts', import.meta.url));
const humanHuntModule = await importTs(new URL('./humanHunt.ts', import.meta.url));

const { generateHumanHuntLevel, getHumanHuntLevels } = configModule;
const { getHumanHuntTurnState } = humanHuntModule;

const levels = getHumanHuntLevels();
assert.equal(levels.length, 9);
assert.equal(generateHumanHuntLevel(1).aiCount, 2);
assert.equal(generateHumanHuntLevel(9).aiCount, 10);
assert.equal(generateHumanHuntLevel(99).aiCount, 10);

const players = [
  { id: 'human', display_name: '1号玩家', player_type: 'human', seat_index: 0 },
  { id: 'ai-1', display_name: '2号玩家', player_type: 'ai', seat_index: 1 },
  { id: 'ai-2', display_name: '3号玩家', player_type: 'ai', seat_index: 2 },
];

const messages = [
  { id: 1, player_id: 'system', sender_type: 'system', sender_name: '系统', content: '第 1 轮自由讨论开始，2号玩家先开场。' },
];

const opening = getHumanHuntTurnState(players, messages);
assert.equal(opening.round, 1);
assert.equal(opening.currentSpeaker.id, 'ai-1');
assert.equal(opening.starterName, '2号玩家');
assert.equal(opening.canVote, false);
assert.equal(opening.minUniqueSpeakerCount, 3);

const afterHuman = [
  ...messages,
  { id: 2, player_id: 'human', sender_type: 'human', sender_name: '1号玩家', content: '我会先看看情况' },
];

const turnState = getHumanHuntTurnState(players, afterHuman);
assert.equal(turnState.round, 1);
assert.equal(turnState.currentSpeaker, null);
assert.equal(turnState.complete, false);
assert.equal(turnState.uniqueSpeakerCount, 1);

const completed = getHumanHuntTurnState(players, [
  ...afterHuman,
  { id: 3, player_id: 'ai-1', sender_type: 'ai', sender_name: '2号玩家', content: '差不多吧' },
  { id: 4, player_id: 'ai-2', sender_type: 'ai', sender_name: '3号玩家', content: '我先观望' },
]);
assert.equal(completed.currentSpeaker, null);
assert.equal(completed.complete, true);
assert.equal(completed.canVote, true);
assert.equal(completed.uniqueSpeakerCount, 3);

const enoughMessagesNotEnoughCoverage = getHumanHuntTurnState(players, [
  ...messages,
  { id: 2, player_id: 'human', sender_type: 'human', sender_name: '1号玩家', content: '第一句' },
  { id: 3, player_id: 'human', sender_type: 'human', sender_name: '1号玩家', content: '第二句' },
  { id: 4, player_id: 'ai-1', sender_type: 'ai', sender_name: '2号玩家', content: '第三句' },
]);
assert.equal(enoughMessagesNotEnoughCoverage.speechCount, 3);
assert.equal(enoughMessagesNotEnoughCoverage.uniqueSpeakerCount, 2);
assert.equal(enoughMessagesNotEnoughCoverage.canVote, false);

const roundTwo = getHumanHuntTurnState(players, [
  ...messages,
  { id: 2, player_id: 'ai-1', sender_type: 'ai', sender_name: '2号玩家', content: '上一轮发言' },
  { id: 3, player_id: 'system', sender_type: 'system', sender_name: '系统', content: '第 2 轮自由讨论开始，1号玩家先开场。' },
]);
assert.deepEqual(roundTwo.order.map((p) => p.id), ['human', 'ai-1', 'ai-2']);
assert.equal(roundTwo.currentSpeaker.id, 'human');
