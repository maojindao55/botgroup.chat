import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGamePermission.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { canControlAiGameRoom } = await import(moduleUrl);

assert.equal(canControlAiGameRoom(null), false);
assert.equal(canControlAiGameRoom({ player_type: 'observer' }), false);
assert.equal(canControlAiGameRoom({ player_type: 'ai' }), false);
assert.equal(canControlAiGameRoom({ player_type: 'human' }), true);
