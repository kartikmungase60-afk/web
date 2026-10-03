const fs = require('fs');
const path = require('path');

function copyDir(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f);
    const d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const fontDir = 'scratch_pack/assets/minecraft/font';
const texFontDir = 'scratch_pack/assets/minecraft/textures/font';

const overlays = ['ia_overlay_1_21_4_to_5', 'ia_overlay_modern_atlas', 'ia_overlay_26_1_plus', 'ia_overlay_26_2_plus'];
for (const ov of overlays) {
  copyDir(fontDir, path.join('scratch_pack', ov, 'assets', 'minecraft', 'font'));
  copyDir(texFontDir, path.join('scratch_pack', ov, 'assets', 'minecraft', 'textures', 'font'));
  console.log('✓ Copied font and textures/font to overlay:', ov);
}
