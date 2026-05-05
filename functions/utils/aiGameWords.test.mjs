import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGameWords.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { hashStringToIndex } = await import(moduleUrl);

assert.equal(hashStringToIndex('game-a1b2c3d4e5', 97), hashStringToIndex('game-a1b2c3d4e5', 97));
assert.notEqual(hashStringToIndex('game-ab', 97), hashStringToIndex('game-ba', 97));
assert.ok(hashStringToIndex('game-a1b2c3d4e5', 97) >= 0);
assert.ok(hashStringToIndex('game-a1b2c3d4e5', 97) < 97);
assert.equal(hashStringToIndex('anything', 0), 0);
