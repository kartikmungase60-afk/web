const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
  host: 'Node1.mineorange.fun',
  port: 2022,
  username: 'master.3297b18b',
  password: 'Kartik@1234'
};

const rootDir = path.resolve(__dirname, '../..');

function ensureRemoteDir(sftp, remoteDir) {
  return new Promise((resolve) => {
    sftp.mkdir(remoteDir, (err) => {
      // Ignore EEXIST
      resolve();
    });
  });
}

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    console.log(`[Upload] ${path.basename(localPath)} -> ${remotePath}...`);
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) {
        console.error(`[Upload Error] ${remotePath}:`, err.message);
        reject(err);
      } else {
        const stats = fs.statSync(localPath);
        console.log(`[Upload Success] ${remotePath} (${stats.size} bytes)`);
        resolve();
      }
    });
  });
}

async function deploy() {
  const conn = new Client();

  conn.on('ready', () => {
    console.log('[SFTP] Connected to Node1.mineorange.fun:2022 successfully!');

    conn.sftp(async (err, sftp) => {
      if (err) {
        console.error('[SFTP Error]', err);
        conn.end();
        return;
      }

      try {
        // 1. Ensure plugins/Skript/scripts directory
        console.log('[SFTP] Ensuring plugins directory structure...');
        await ensureRemoteDir(sftp, 'plugins/Skript');
        await ensureRemoteDir(sftp, 'plugins/Skript/scripts');
        await ensureRemoteDir(sftp, 'plugins/BattlepieLink');

        // 2. Upload MineOrangeLink.sk
        const localSk = path.join(rootDir, 'tools/minecraft/MineOrangeLink.sk');
        await uploadFile(sftp, localSk, 'plugins/Skript/scripts/mineorange_link.sk');

        // 3. Upload BattlepieLink.sk as backup
        await uploadFile(sftp, localSk, 'plugins/Skript/scripts/battlepie_link.sk');

        // 4. Upload Skript plugin jar (for servers without Skript engine)
        const skriptJar = path.join(rootDir, 'tools/minecraft/Skript-2.16.2.jar');
        if (fs.existsSync(skriptJar)) {
          await uploadFile(sftp, skriptJar, 'plugins/Skript-2.16.2.jar');
        }

        // 5. Upload config.yml
        const localConfig = path.join(rootDir, 'tools/minecraft/config.yml');
        await uploadFile(sftp, localConfig, 'plugins/BattlepieLink/config.yml');

        // 6. Upload Java plugin jar to both filenames
        const localJar = path.join(rootDir, 'tools/minecraft/BattlepieLink.jar');
        if (fs.existsSync(localJar)) {
          await uploadFile(sftp, localJar, 'plugins/MineOrangeLink.jar');
          await uploadFile(sftp, localJar, 'plugins/BattlepieLink.jar');
        }

        console.log('\n>>> ALL FILES SUCCESSFULLY MIGRATED TO MINECRAFT SERVER! <<<');
      } catch (e) {
        console.error('[Migration Error]', e.message);
      } finally {
        conn.end();
      }
    });
  });

  conn.on('error', (err) => {
    console.error('[SFTP Connection Error]', err.message);
  });

  conn.connect(config);
}

deploy();
