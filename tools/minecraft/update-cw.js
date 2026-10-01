const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.readFile('plugins/CommandWhitelist/config.yml', 'utf8', (err, data) => {
      if (err) throw err;
      let updated = data;
      const commandsToAdd = ['link', 'battlepielink', 'battlepielink:link', 'mineorangelink', 'mclink'];
      commandsToAdd.forEach(cmd => {
        if (!updated.includes(`- ${cmd}\n`)) {
          updated = updated.replace('commands:\n', `commands:\n    - ${cmd}\n`);
        }
      });
      sftp.writeFile('plugins/CommandWhitelist/config.yml', updated, 'utf8', (err) => {
        if (err) throw err;
        console.log('Successfully added all link aliases to CommandWhitelist!');
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
