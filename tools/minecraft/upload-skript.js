const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const skriptContent = fs.readFileSync(path.join(__dirname, 'MineOrangeLink.sk'), 'utf8');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.writeFile('plugins/Skript/scripts/mineorange_link.sk', skriptContent, 'utf8', (err) => {
      if (err) throw err;
      console.log('Successfully written plugins/Skript/scripts/mineorange_link.sk!');
      conn.end();
    });
  });
}).connect({
  host: 'Node1.mineorange.fun',
  port: 2022,
  username: 'master.3297b18b',
  password: 'Kartik@1234'
});
