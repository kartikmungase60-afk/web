const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err);
      conn.end();
      return;
    }

    console.log('Connected to SFTP. Checking plugins/Skript/scripts...');
    sftp.readdir('plugins/Skript/scripts', (err, list) => {
      if (err) {
        console.log('Error reading plugins/Skript/scripts:', err.message);
      } else {
        console.log('=== plugins/Skript/scripts ===');
        list.forEach(item => console.log(' - ' + item.filename));
      }

      console.log('\nChecking plugins/ for Link plugins...');
      sftp.readdir('plugins', (err, pList) => {
        if (err) {
          console.log('Error reading plugins:', err.message);
        } else {
          console.log('=== Link related jars in plugins/ ===');
          pList
            .filter(item => item.filename.toLowerCase().includes('link') || item.filename.toLowerCase().includes('skript'))
            .forEach(item => console.log(' - ' + item.filename));
        }

        console.log('\nReading last 100 lines of logs/latest.log...');
        sftp.stat('logs/latest.log', (err, stats) => {
          if (err) {
            console.log('Error stat logs/latest.log:', err.message);
            conn.end();
            return;
          }

          const stream = sftp.createReadStream('logs/latest.log', {
            start: Math.max(0, stats.size - 30000),
            end: stats.size
          });

          let data = '';
          stream.on('data', chunk => { data += chunk.toString('utf8'); });
          stream.on('end', () => {
            const lines = data.split('\n');
            const recent = lines.slice(-80);
            console.log('=== Recent server log (last 80 lines) ===');
            console.log(recent.join('\n'));
            conn.end();
          });
          stream.on('error', err => {
            console.error('Stream error:', err.message);
            conn.end();
          });
        });
      });
    });
  });
}).on('error', (err) => {
  console.error('SSH error:', err);
}).connect({
  host: 'Node1.mineorange.fun',
  port: 2022,
  username: 'master.3297b18b',
  password: 'Kartik@1234'
});
