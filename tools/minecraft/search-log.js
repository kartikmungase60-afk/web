const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createReadStream('logs/latest.log');
    let data = '';
    stream.on('data', c => data += c);
    stream.on('end', () => {
      const lines = data.split('\n');
      console.log('Total log lines:', lines.length);
      const matches = lines.filter(l => 
        l.toLowerCase().includes('skript') || 
        l.toLowerCase().includes('/link') || 
        l.toLowerCase().includes('mineorangelink') ||
        l.toLowerCase().includes('battlepie_link') ||
        l.toLowerCase().includes('reload')
      );
      console.log('=== Matching lines in entire latest.log ===');
      console.log(matches.join('\n'));
      conn.end();
    });
  });
}).connect({
  host: 'Node1.mineorange.fun',
  port: 2022,
  username: 'master.3297b18b',
  password: 'Kartik@1234'
});
