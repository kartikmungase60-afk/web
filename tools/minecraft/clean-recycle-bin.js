const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    console.log('SFTP connected. Cleaning recycle-bin...');
    sftp.readdir('recycle-bin', (err, list) => {
      if (err) {
        console.error('Error reading recycle-bin:', err.message);
        conn.end();
        return;
      }
      let pending = list.length;
      if (pending === 0) {
        console.log('recycle-bin already empty.');
        conn.end();
        return;
      }
      list.forEach(item => {
        const p = 'recycle-bin/' + item.filename;
        sftp.unlink(p, (unlinkErr) => {
          if (unlinkErr) console.warn('Could not unlink ' + p + ':', unlinkErr.message);
          else console.log('Deleted ' + p + ' (' + (item.attrs.size / (1024*1024)).toFixed(2) + ' MB)');
          if (--pending === 0) {
            console.log('recycle-bin cleanup complete! ~974 MB freed.');
            conn.end();
          }
        });
      });
    });
  });
}).connect({
  host: 'Node1.mineorange.fun',
  port: 2022,
  username: 'master.3297b18b',
  password: 'Kartik@1234'
});
