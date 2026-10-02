const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    console.log('SFTP connected. Checking root and plugin directories...');
    
    // Check root files and directories
    sftp.readdir('.', (err, list) => {
      if (err) console.error('Root readdir error:', err);
      else {
        console.log('=== Root files & dirs ===');
        list.forEach(i => {
          console.log(`${i.filename} (${i.attrs.size || 0} bytes) [${i.attrs.isDirectory() ? 'DIR' : 'FILE'}]`);
        });
      }

      // Check crash-reports or logs
      sftp.readdir('logs', (err, logList) => {
        if (!err && logList) {
          console.log('\n=== Logs directory ===');
          logList.forEach(i => {
            console.log(`${i.filename} (${(i.attrs.size / (1024*1024)).toFixed(2)} MB)`);
          });
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
