import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGameVoteTally.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { resolveUniqueTopVote } = await import(moduleUrl);

assert.deepEqual(resolveUniqueTopVote([
  { target_player_id: 'A' },
  { target_player_id: 'B' },
  { target_player_id: 'human' },
]), {
  targetId: null,
  topVotes: 1,
  tiedTargetIds: ['A', 'B', 'human'],
});

assert.deepEqual(resolveUniqueTopVote([
  { target_player_id: 'A' },
  { target_player_id: 'A' },
  { target_player_id: 'human' },
]), {
  targetId: 'A',
  topVotes: 2,
  tiedTargetIds: ['A'],
});
