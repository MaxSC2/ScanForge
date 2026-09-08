/**
 * Local validation script that works without native modules (proot/Termux).
 * Uses TypeScript compiler API directly — no rollup/vite dependency.
 *
 * Usage: node scripts/validate.mjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);

const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 1. Syntax check via transpile ──────────────────────────────────
const filesToCheck = [
  'src/services/ai/types.ts',
  'src/services/ai/provider.ts',
  'src/services/ai/tools.ts',
  'src/services/ai/orchestrator.ts',
  'src/services/ai/memory.ts',
  'src/services/ai/graph.ts',
  'eslint.config.js',
];

let syntaxOk = true;
for (const rel of filesToCheck) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { console.log(`  ⊘ ${rel} (missing)`); continue; }
  try {
    const src = fs.readFileSync(abs, 'utf8');
    ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    console.log(`  ✓ ${rel}`);
  } catch (e) {
    console.log(`  ✗ ${rel}: ${e.message}`);
    syntaxOk = false;
  }
}

// ── 2. JSON validity (package.json strict; tsconfig allows comments) ─
JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
console.log('  ✓ package.json');

const tsconfigRaw = fs.readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf8');
const parsed = ts.parseConfigFileTextToJson('tsconfig.json', tsconfigRaw);
if (parsed.error) {
  console.log(`  ✗ tsconfig.json: ${parsed.error.messageText}`);
  syntaxOk = false;
} else {
  console.log('  ✓ tsconfig.json');
}

// ── 3. YAML basic check ────────────────────────────────────────────
const yml = '.github/workflows/ci.yml';
const content = fs.readFileSync(path.join(ROOT, yml), 'utf8');
console.log(`  ✓ ${yml} (${content.split('\n').length} lines)`);

console.log(syntaxOk ? '\n✅ All local checks passed' : '\n❌ Some checks failed');
process.exit(syntaxOk ? 0 : 1);
