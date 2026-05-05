import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./qr.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { createQrSvgDataUrl } = await import(moduleUrl);

const qr = createQrSvgDataUrl('https://botgroup.chat/ai-game?challenge=12');
assert.equal(qr.startsWith('data:image/svg+xml;utf8,'), true);
assert.equal(decodeURIComponent(qr).includes('<svg'), true);
assert.throws(() => createQrSvgDataUrl('x'.repeat(77)), /too long/);
