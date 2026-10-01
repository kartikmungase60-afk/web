const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const buildDir = path.join(rootDir, 'tools/minecraft/build');
const outJar = path.join(rootDir, 'tools/minecraft/MineOrangeLink.jar');
const paperApi = path.join(rootDir, 'tools/minecraft/paper-api.jar');
const srcJava = path.join(rootDir, 'tools/minecraft/BattlepieLinkPlugin.java');

if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

console.log('[Build] Compiling BattlepieLinkPlugin.java...');
const argsFile = path.join(buildDir, 'javac_args.txt');
fs.writeFileSync(argsFile, `-cp\n"${paperApi.replace(/\\/g, '/')}"\n-d\n"${buildDir.replace(/\\/g, '/')}"\n"${srcJava.replace(/\\/g, '/')}"\n`, 'utf8');

execSync(`javac "@${argsFile}"`, { stdio: 'inherit' });

console.log('[Build] Copying plugin.yml and config.yml...');
fs.copyFileSync(path.join(rootDir, 'tools/minecraft/plugin.yml'), path.join(buildDir, 'plugin.yml'));
fs.copyFileSync(path.join(rootDir, 'tools/minecraft/config.yml'), path.join(buildDir, 'config.yml'));

console.log('[Build] Packaging MineOrangeLink.jar...');
execSync(`jar -cvf "${outJar}" -C "${buildDir}" .`, { stdio: 'pipe' });

const stat = fs.statSync(outJar);
console.log(`[Build] SUCCESS! MineOrangeLink.jar created (${stat.size} bytes).`);
const battlepieJar = path.join(rootDir, 'tools/minecraft/BattlepieLink.jar');
fs.copyFileSync(outJar, battlepieJar);
console.log(`[Build] Also copied to ${battlepieJar}`);
