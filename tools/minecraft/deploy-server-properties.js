const { Client } = require('ssh2');
const fs = require('fs');
const crypto = require('crypto');

const NEW_PACK_URL = 'https://mineorange.fun/packs/mineorange_pack.zip';
const NEW_SHA1 = '71ca65054f52b416f962446eca892308a5eeea90';
const NEW_PACK_ID = crypto.randomUUID();

console.log('--- UPDATING SERVER.PROPERTIES ---');
console.log('URL:', NEW_PACK_URL);
console.log('SHA1:', NEW_SHA1);
console.log('ID:', NEW_PACK_ID);

const conn = new Client();
conn.on('ready', () => {
  console.log('[SFTP] Connected.');
  conn.sftp(async (err, sftp) => {
    if (err) throw err;

    sftp.readFile('server.properties', 'utf8', (err, data) => {
      if (err) {
        console.error('Failed to read server.properties:', err);
        conn.end();
        return;
      }

      fs.writeFileSync('tools/minecraft/server.properties.bak', data);
      console.log('✓ Saved backup server.properties.bak');

      // Update lines
      let lines = data.split('\n');
      let foundUrl = false, foundSha = false, foundId = false, foundReq = false;

      lines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('resource-pack=')) {
          foundUrl = true;
          return 'resource-pack=' + NEW_PACK_URL.replace(/:/g, '\\:');
        }
        if (trimmed.startsWith('resource-pack-sha1=')) {
          foundSha = true;
          return 'resource-pack-sha1=' + NEW_SHA1;
        }
        if (trimmed.startsWith('resource-pack-id=')) {
          foundId = true;
          return 'resource-pack-id=' + NEW_PACK_ID;
        }
        if (trimmed.startsWith('require-resource-pack=')) {
          foundReq = true;
          return 'require-resource-pack=true';
        }
        return line;
      });

      if (!foundUrl) lines.push('resource-pack=' + NEW_PACK_URL.replace(/:/g, '\\:'));
      if (!foundSha) lines.push('resource-pack-sha1=' + NEW_SHA1);
      if (!foundId) lines.push('resource-pack-id=' + NEW_PACK_ID);
      if (!foundReq) lines.push('require-resource-pack=true');

      const updated = lines.join('\n');

      sftp.writeFile('server.properties', updated, 'utf8', (err) => {
        if (err) {
          console.error('Failed to write server.properties:', err);
        } else {
          console.log('✓ Successfully updated server.properties on remote server!');
          const checkLines = updated.split('\n').filter(l => l.includes('resource-pack'));
          console.log('New server.properties entries:\n', checkLines.join('\n'));
        }
        conn.end();
      });
    });
  });
}).connect({
  host: 'Node1.mineorange.fun',
  port: 2022,
  username: 'master.3297b18b',
  password: 'Kartik@1234'
});
