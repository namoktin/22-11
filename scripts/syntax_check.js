const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IGNORE = new Set(['node_modules', '.git', 'audio', 'backups']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
}

walk(ROOT);
let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    console.error(`❌ Syntax error in ${path.relative(ROOT, f)}:\n${err.stderr?.toString() || err.message}`);
  }
}

if (failed > 0) {
  console.error(`\n❌ Syntax check FAILED: ${failed}/${files.length} files had errors.`);
  process.exit(1);
}
console.log(`✓ Syntax check PASSED: ${files.length}/${files.length} JS files valid.`);
