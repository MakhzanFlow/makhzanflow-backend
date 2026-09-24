// Loads .env.production into process env (no values printed) then runs prisma command.
// Usage: node scripts/prod-prisma.js migrate status
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env.production');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const idx = trimmed.indexOf('=');
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}
process.env.NODE_ENV = 'production';

const args = process.argv.slice(2);
console.log('Running: prisma ' + args.join(' ') + ' (production env loaded, values hidden)');
const result = spawnSync('npx', ['prisma', ...args], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
