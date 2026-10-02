const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.readFile('logs/latest.log', 'utf8', (err, content) => {
      if (err) {
        console.error('readFile error:', err);
      } else {
        const lines = content.split('\n');
        console.log('Total log lines:', lines.length);
        console.log('=== Log from restart (last 150 lines) ===');
        console.log(lines.slice(-150).join('\n'));
      }
      conn.end();
    });
  });
}).connect({
  host: 'Node1.mineorange.fun',
  port: 2022,
  username: 'master.3297b18b',
  password: 'Kartik@1234'
});
