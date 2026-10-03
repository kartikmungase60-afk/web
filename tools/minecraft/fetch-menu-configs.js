const { Client } = require('ssh2');
const fs = require('fs');

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
  console.log('[SFTP] Connected.');
  conn.sftp(async (err, sftp) => {
    if (err) throw err;

    try {
      // 1. Check DeluxeMenus
      console.log('--- DELUXE MENUS ---');
      try {
        const dmList = await readdir(sftp, 'plugins/DeluxeMenus');
        console.log('DeluxeMenus files:', dmList.map(x => x.filename));
        const dmConfig = await readFile(sftp, 'plugins/DeluxeMenus/config.yml');
        console.log('DeluxeMenus config.yml head:\n', dmConfig.slice(0, 1500));
        
        // check gui_menus if present
        try {
          const guiMenus = await readdir(sftp, 'plugins/DeluxeMenus/gui_menus');
          console.log('gui_menus files:', guiMenus.map(x => x.filename));
          for (const gm of guiMenus) {
            if (gm.filename.endsWith('.yml')) {
              const content = await readFile(sftp, `plugins/DeluxeMenus/gui_menus/${gm.filename}`);
              fs.writeFileSync(`tools/minecraft/dm_${gm.filename}`, content);
              console.log(`Saved dm_${gm.filename} (${content.length} bytes)`);
            }
          }
        } catch (e) {
          console.log('No gui_menus subfolder or error:', e.message);
        }
      } catch (e) {
        console.log('DeluxeMenus error:', e.message);
      }

      // 2. Check ShopGUIPlus
      console.log('\n--- SHOP GUI PLUS ---');
      try {
        const shops = await readdir(sftp, 'plugins/ShopGUIPlus/shops');
        console.log('Shop files:', shops.map(x => x.filename));
        for (const s of shops) {
          if (s.filename.endsWith('.yml')) {
            const content = await readFile(sftp, `plugins/ShopGUIPlus/shops/${s.filename}`);
            fs.writeFileSync(`tools/minecraft/shop_${s.filename}`, content);
            console.log(`Saved shop_${s.filename}`);
          }
        }
        const sgpConfig = await readFile(sftp, 'plugins/ShopGUIPlus/config.yml');
        fs.writeFileSync('tools/minecraft/shopguiplus_config.yml', sgpConfig);
        console.log('Saved shopguiplus_config.yml');
      } catch (e) {
        console.log('ShopGUIPlus error:', e.message);
      }

    } catch (e) {
      console.error(e);
    } finally {
      conn.end();
    }
  });
});

conn.connect(config);
