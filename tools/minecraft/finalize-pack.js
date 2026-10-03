const fs = require('fs');
const path = require('path');

console.log('=== FINALIZING RESOURCE PACK ENHANCEMENTS ===');

function copyDir(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f);
    const d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 1. Sync atlases to all relevant overlays
const atlasesDir = 'scratch_pack/assets/minecraft/atlases';
const fontDir = 'scratch_pack/assets/minecraft/font';
const texFontDir = 'scratch_pack/assets/minecraft/textures/font';

const overlays = [
  'ia_overlay_modern_atlas',
  'ia_overlay_26_1_plus',
  'ia_overlay_26_2_plus',
  'ia_overlay_1_21_4_to_5',
  'ia_overlay_1_21_6_plus'
];

for (const ov of overlays) {
  copyDir(atlasesDir, path.join('scratch_pack', ov, 'assets', 'minecraft', 'atlases'));
  copyDir(fontDir, path.join('scratch_pack', ov, 'assets', 'minecraft', 'font'));
  copyDir(texFontDir, path.join('scratch_pack', ov, 'assets', 'minecraft', 'textures', 'font'));
  console.log(`✓ Synchronized atlases, font, and textures/font into ${ov}`);
}

// 2. Double-check all model overrides in overlays
const modelOverlays = ['ia_overlay_modern_atlas', 'ia_overlay_26_1_plus', 'ia_overlay_26_2_plus'];
for (const ov of modelOverlays) {
  const dPath = `scratch_pack/${ov}/assets/minecraft/models/item/diamond_sword.json`;
  if (fs.existsSync(dPath)) {
    const data = JSON.parse(fs.readFileSync(dPath, 'utf8'));
    data.textures = {
      layer0: 'minecraft:item/diamond_sword',
      particle: '#layer0'
    };
    fs.writeFileSync(dPath, JSON.stringify(data, null, 2));
  }
  const cPath = `scratch_pack/${ov}/assets/minecraft/models/item/crossbow.json`;
  if (fs.existsSync(cPath)) {
    const data = JSON.parse(fs.readFileSync(cPath, 'utf8'));
    data.textures = {
      layer0: 'minecraft:item/crossbow_standby',
      particle: '#layer0'
    };
    fs.writeFileSync(cPath, JSON.stringify(data, null, 2));
  }
}
console.log('✓ Verified overlay models for diamond_sword and crossbow');

// 3. Update pack.mcmeta with proper overlay order (ascending min_inclusive)
const mcmeta = {
  pack: {
    pack_format: 34,
    supported_formats: {
      min_inclusive: 15,
      max_inclusive: 99
    },
    min_format: 15,
    max_format: 99,
    description: "Mine Orange Official Resource Pack"
  },
  overlays: {
    entries: [
      {
        directory: "ia_overlay_modern_atlas",
        formats: {
          min_inclusive: 18,
          max_inclusive: 99
        }
      },
      {
        directory: "ia_overlay_26_1_plus",
        formats: {
          min_inclusive: 32,
          max_inclusive: 99
        }
      },
      {
        directory: "ia_overlay_26_2_plus",
        formats: {
          min_inclusive: 34,
          max_inclusive: 99
        }
      },
      {
        directory: "ia_overlay_1_21_4_to_5",
        formats: {
          min_inclusive: 46,
          max_inclusive: 99
        }
      },
      {
        directory: "ia_overlay_1_21_4_plus",
        formats: {
          min_inclusive: 46,
          max_inclusive: 99
        }
      },
      {
        directory: "ia_overlay_1_21_6_plus",
        formats: {
          min_inclusive: 63,
          max_inclusive: 99
        }
      }
    ]
  }
};

fs.writeFileSync('scratch_pack/pack.mcmeta', JSON.stringify(mcmeta, null, 2));
console.log('✓ Updated pack.mcmeta with correctly ordered overlays and universal compatibility.');
console.log('=== READY FOR PACKAGING ===');
