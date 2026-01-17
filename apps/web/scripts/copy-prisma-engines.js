const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appDir, '..', '..');
const pnpmStoreDir = path.join(repoRoot, 'node_modules', '.pnpm');
const sourceDir = path.join(repoRoot, 'node_modules', '.prisma', 'client');
const targetDirs = [
  path.join(appDir, '.prisma', 'client'),
  path.join(appDir, 'node_modules', '.prisma', 'client'),
  path.join(repoRoot, 'node_modules', '.prisma', 'client'),
];

function findPnpmPrismaClientDir() {
  if (!fs.existsSync(pnpmStoreDir)) return null;
  const entries = fs.readdirSync(pnpmStoreDir, { withFileTypes: true });
  const prismaEntry = entries.find((entry) =>
    entry.isDirectory() && entry.name.startsWith('@prisma+client@')
  );
  if (!prismaEntry) return null;
  const candidate = path.join(pnpmStoreDir, prismaEntry.name, 'node_modules', '.prisma', 'client');
  return fs.existsSync(candidate) ? candidate : null;
}

function copyPrismaEngines() {
  let resolvedSource = null;

  if (fs.existsSync(sourceDir)) {
    resolvedSource = sourceDir;
  } else {
    resolvedSource = findPnpmPrismaClientDir();
  }

  if (!resolvedSource) {
    console.error(
      `[prisma] Source not found. Checked: ${sourceDir} and ${pnpmStoreDir}/@prisma+client@*/node_modules/.prisma/client`
    );
    process.exit(1);
  }

  for (const targetDir of targetDirs) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.cpSync(resolvedSource, targetDir, { recursive: true });
  }

  console.log(
    `[prisma] Copied engines from ${resolvedSource} to:\n- ${targetDirs.join('\n- ')}`
  );
}

copyPrismaEngines();
