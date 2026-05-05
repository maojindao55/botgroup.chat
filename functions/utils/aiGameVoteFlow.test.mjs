import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGameVoteFlow.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { canSubmitUndercoverVoteThisRound } = await import(moduleUrl);

assert.deepEqual(canSubmitUndercoverVoteThisRound({
  latestVoteResultId: 0,
  latestHumanMessageId: 0,
  aiMessagesAfterHuman: 5,
  activeAiCount: 5,
}), { allowed: false, reason: 'needs-human-message' });

assert.deepEqual(canSubmitUndercoverVoteThisRound({
  latestVoteResultId: 12,
  latestHumanMessageId: 10,
  aiMessagesAfterHuman: 5,
  activeAiCount: 5,
}), { allowed: false, reason: 'needs-human-message' });

assert.deepEqual(canSubmitUndercoverVoteThisRound({
  latestVoteResultId: 0,
  latestHumanMessageId: 10,
  aiMessagesAfterHuman: 4,
  activeAiCount: 5,
}), { allowed: false, reason: 'needs-ai-round' });

assert.deepEqual(canSubmitUndercoverVoteThisRound({
  latestVoteResultId: 12,
  latestHumanMessageId: 14,
  aiMessagesAfterHuman: 5,
  activeAiCount: 5,
}), { allowed: true, reason: 'ok' });
