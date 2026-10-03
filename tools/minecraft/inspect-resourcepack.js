const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
  host: 'Node1.mineorange.fun',
  port: 2022,
  username: 'master.3297b18b',
  password: 'Kartik@1234'
};

const conn = new Client();

function readdir(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) return reject(err);
      resolve(list);
    });
  });
}

function readFile(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.readFile(remotePath, 'utf8', (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

conn.on('ready', () => {
  console.log('[SFTP] Connected to server.');
  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }

    try {
      // 1. Read server.properties
      console.log('--- 📄 SERVER.PROPERTIES RESOURCE PACK CONFIG ---');
      try {
        const props = await readFile(sftp, 'server.properties');
        const lines = props.split('\n').filter(l => l.toLowerCase().includes('resource-pack'));
        lines.forEach(l => console.log(' ', l.trim()));
      } catch (e) {
        console.log('Could not read server.properties:', e.message);
      }

      // 2. List root files
      console.log('\n--- 📁 ROOT DIRECTORY FILES ---');
      const rootList = await readdir(sftp, '.');
      rootList.forEach(item => {
        if (item.filename.endsWith('.zip') || item.filename.includes('pack') || item.filename.endsWith('.jar') || item.filename.endsWith('.properties') || item.filename.endsWith('.yml')) {
          console.log(`  ${item.filename} (${item.attrs.size} bytes)`);
        }
      });

      // 3. List plugins
      console.log('\n--- 🔌 PLUGINS DIRECTORY ---');
      try {
        const pluginsList = await readdir(sftp, 'plugins');
        const pluginNames = pluginsList.map(p => p.filename);
        console.log('  Plugins found:', pluginNames.filter(p => !p.endsWith('.jar')).join(', '));
        console.log('  Plugin JARs:', pluginNames.filter(p => p.endsWith('.jar')).join(', '));
      } catch (e) {
        console.log('Could not read plugins:', e.message);
      }

    } catch (e) {
      console.error('Error during inspection:', e);
    } finally {
      conn.end();
    }
  });
});

conn.on('error', (err) => {
  console.error('SFTP connection error:', err);
});

conn.connect(config);
