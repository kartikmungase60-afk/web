const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const serverDir = path.join(rootDir, 'tools/local-mc-server');
const buildDir = path.join(rootDir, 'tools/minecraft/build');
const outJar = path.join(rootDir, 'tools/minecraft/BattlepieLink.jar');
const serverPluginJar = path.join(serverDir, 'plugins/BattlepieLink.jar');

console.log('[Build] Cleaning previous build...');
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
fs.mkdirSync(buildDir, { recursive: true });

// Collect classpath: purpur-1.20.4.jar + all jars in libraries/
const purpurJar = path.join(serverDir, 'versions/1.20.4/purpur-1.20.4.jar');
const libDir = path.join(serverDir, 'libraries');

function findJars(dir) {
  let jars = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      jars = jars.concat(findJars(full));
    } else if (ent.name.endsWith('.jar')) {
      jars.push(full);
    }
  }
  return jars;
}

const libJars = fs.existsSync(libDir) ? findJars(libDir) : [];
const cpList = [purpurJar, ...libJars];
const cp = cpList.join(';');

console.log(`[Build] Found ${libJars.length} server library JARs. Compiling BattlepieLinkPlugin.java...`);

const srcJava = path.join(rootDir, 'tools/minecraft/BattlepieLinkPlugin.java');
const argsFile = path.join(buildDir, 'javac_args.txt');
fs.writeFileSync(argsFile, `-cp\n"${cp.replace(/\\/g, '/')}"\n-d\n"${buildDir.replace(/\\/g, '/')}"\n"${srcJava.replace(/\\/g, '/')}"\n`, 'utf8');

try {
  execSync(`javac "@${argsFile}"`, { encoding: 'utf8' });
} catch (e) {
  console.error('[Build] Javac error:');
  console.error(e.stdout || e.stderr || e.message);
  process.exit(1);
}

console.log('[Build] Copying plugin.yml and config.yml...');
fs.copyFileSync(path.join(rootDir, 'tools/minecraft/plugin.yml'), path.join(buildDir, 'plugin.yml'));
fs.copyFileSync(path.join(rootDir, 'tools/minecraft/config.yml'), path.join(buildDir, 'config.yml'));

console.log('[Build] Packaging BattlepieLink.jar...');
execSync(`jar -cvf "${outJar}" -C "${buildDir}" .`, { stdio: 'pipe' });

// Copy to local server plugins directory
fs.mkdirSync(path.dirname(serverPluginJar), { recursive: true });
fs.copyFileSync(outJar, serverPluginJar);

const stat = fs.statSync(serverPluginJar);
console.log(`[Build] SUCCESS! BattlepieLink.jar built successfully (${stat.size} bytes).`);
console.log(`[Build] Installed to: ${serverPluginJar}`);
