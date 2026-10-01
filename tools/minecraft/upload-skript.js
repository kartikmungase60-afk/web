const { Client } = require('ssh2');

const skriptContent = `# ========================================================
# Mine Orange Network - Discord Account Linker Bridge
# Compatible with Skript 2.6+ (No external addons required)
# ========================================================

command /link [<text>]:
    description: Link your Minecraft account to Mine Orange Discord
    usage: /link <8-digit code>
    aliases: /mclink, /discordlink
    trigger:
        if arg-1 is not set:
            send "§8[§6§lMine Orange§8] §cUsage: §e/link <8-digit code>" to player
            send "§8[§6§lMine Orange§8] §7Get your link code at: §fhttps://mineorange.fun/me" to player
            stop
        
        # Forward to native Java plugin handler
        make player execute "/mineorangelink:link %arg-1%"
`;

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
