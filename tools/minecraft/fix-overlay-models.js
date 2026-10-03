const fs = require('fs');

const overlays = ['ia_overlay_26_1_plus', 'ia_overlay_26_2_plus', 'ia_overlay_modern_atlas'];

for (const ov of overlays) {
  const dPath = `scratch_pack/${ov}/assets/minecraft/models/item/diamond_sword.json`;
  if (fs.existsSync(dPath)) {
    const data = JSON.parse(fs.readFileSync(dPath, 'utf8'));
    data.textures = {
      layer0: 'minecraft:item/diamond_sword',
      particle: '#layer0'
    };
    fs.writeFileSync(dPath, JSON.stringify(data, null, 2));
    console.log(`✓ Fixed ${ov} diamond_sword.json`);
  }

  const cPath = `scratch_pack/${ov}/assets/minecraft/models/item/crossbow.json`;
  if (fs.existsSync(cPath)) {
    const data = JSON.parse(fs.readFileSync(cPath, 'utf8'));
    data.textures = {
      layer0: 'minecraft:item/crossbow_standby',
      particle: '#layer0'
    };
    fs.writeFileSync(cPath, JSON.stringify(data, null, 2));
    console.log(`✓ Fixed ${ov} crossbow.json`);
  }
}
