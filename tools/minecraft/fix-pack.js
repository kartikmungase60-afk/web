const fs = require('fs');
const path = require('path');

console.log('=== FIXING RESOURCE PACK ===');

// 1. Remove invalid atlas.json inside texture folder
const badAtlas = 'scratch_pack/assets/minecraft/textures/ulg_bp/atlas.json';
if (fs.existsSync(badAtlas)) {
  fs.unlinkSync(badAtlas);
  console.log('✓ Removed invalid texture file:', badAtlas);
}

// 2. Load modern atlas definitions
const modernBlocksPath = 'scratch_pack/ia_overlay_modern_atlas/assets/minecraft/atlases/blocks.json';
const modernItemsPath = 'scratch_pack/ia_overlay_modern_atlas/assets/minecraft/atlases/items.json';

const modernBlocks = JSON.parse(fs.readFileSync(modernBlocksPath, 'utf8'));
const modernItems = JSON.parse(fs.readFileSync(modernItemsPath, 'utf8'));

console.log(`Loaded ${modernBlocks.sources.length} blocks sources and ${modernItems.sources.length} items sources.`);

// Base blocks.json: include ulg_bp directory, ia:0..ia:7 blocks, AND all item sprites (for 1.20-1.21.1 compatibility)
const baseBlocksSources = [
  {
    type: 'directory',
    source: 'ulg_bp',
    prefix: 'ulg_bp/'
  },
  ...modernBlocks.sources,
  ...modernItems.sources
];

// Deduplicate sources by sprite / source
const uniqueBlocksSources = [];
const seenSprites = new Set();
for (const s of baseBlocksSources) {
  const key = s.sprite || (s.type + ':' + s.source);
  if (!seenSprites.has(key)) {
    seenSprites.add(key);
    uniqueBlocksSources.push(s);
  }
}

const baseBlocksAtlas = { sources: uniqueBlocksSources };
fs.writeFileSync('scratch_pack/assets/minecraft/atlases/blocks.json', JSON.stringify(baseBlocksAtlas, null, 2));
console.log(`✓ Updated base assets/minecraft/atlases/blocks.json with ${uniqueBlocksSources.length} sources.`);

// Base items.json: include all 151 item sources + pixel
const baseItemsSources = [
  { type: 'single', resource: 'minecraft:guis/pixel' },
  ...modernItems.sources
];
const uniqueItemsSources = [];
const seenItemSprites = new Set();
for (const s of baseItemsSources) {
  const key = s.sprite || (s.type + ':' + s.resource);
  if (!seenItemSprites.has(key)) {
    seenItemSprites.add(key);
    uniqueItemsSources.push(s);
  }
}
const baseItemsAtlas = { sources: uniqueItemsSources };
fs.writeFileSync('scratch_pack/assets/minecraft/atlases/items.json', JSON.stringify(baseItemsAtlas, null, 2));
console.log(`✓ Created base assets/minecraft/atlases/items.json with ${uniqueItemsSources.length} sources.`);

// Update overlays to have the full sources too
const overlays = ['ia_overlay_modern_atlas', 'ia_overlay_26_1_plus', 'ia_overlay_26_2_plus'];
for (const ov of overlays) {
  const bPath = `scratch_pack/${ov}/assets/minecraft/atlases/blocks.json`;
  const iPath = `scratch_pack/${ov}/assets/minecraft/atlases/items.json`;
  if (fs.existsSync(path.dirname(bPath))) {
    fs.writeFileSync(bPath, JSON.stringify(baseBlocksAtlas, null, 2));
  }
  if (fs.existsSync(path.dirname(iPath))) {
    fs.writeFileSync(iPath, JSON.stringify(baseItemsAtlas, null, 2));
  }
  console.log(`✓ Synchronized atlases in overlay: ${ov}`);
}

// 3. Fix base item models in assets/minecraft/models/item/
const modelFixes = {
  'diamond_sword.json': {
    textures: { layer0: 'minecraft:item/diamond_sword', particle: '#layer0' }
  },
  'iron_sword.json': {
    textures: { layer0: 'minecraft:item/iron_sword', particle: '#layer0' }
  },
  'bow.json': {
    textures: { layer0: 'minecraft:item/bow', particle: '#layer0' }
  },
  'crossbow.json': {
    textures: { layer0: 'minecraft:item/crossbow_standby', particle: '#layer0' }
  },
  'diamond_axe.json': {
    textures: { layer0: 'minecraft:item/diamond_axe', particle: '#layer0' }
  },
  'diamond_hoe.json': {
    textures: { layer0: 'minecraft:item/diamond_hoe', particle: '#layer0' }
  },
  'diamond_pickaxe.json': {
    textures: { layer0: 'minecraft:item/diamond_pickaxe', particle: '#layer0' }
  },
  'diamond_shovel.json': {
    textures: { layer0: 'minecraft:item/diamond_shovel', particle: '#layer0' }
  },
  'fishing_rod.json': {
    textures: { layer0: 'minecraft:item/fishing_rod', particle: '#layer0' }
  },
  'iron_axe.json': {
    textures: { layer0: 'minecraft:item/iron_axe', particle: '#layer0' }
  },
  'iron_hoe.json': {
    textures: { layer0: 'minecraft:item/iron_hoe', particle: '#layer0' }
  },
  'iron_pickaxe.json': {
    textures: { layer0: 'minecraft:item/iron_pickaxe', particle: '#layer0' }
  },
  'iron_shovel.json': {
    textures: { layer0: 'minecraft:item/iron_shovel', particle: '#layer0' }
  },
  'leather_boots.json': {
    textures: { layer0: 'minecraft:item/leather_boots', layer1: 'minecraft:item/leather_boots_overlay', particle: '#layer0' }
  },
  'leather_chestplate.json': {
    textures: { layer0: 'minecraft:item/leather_chestplate', layer1: 'minecraft:item/leather_chestplate_overlay', particle: '#layer0' }
  },
  'leather_helmet.json': {
    textures: { layer0: 'minecraft:item/leather_helmet', layer1: 'minecraft:item/leather_helmet_overlay', particle: '#layer0' }
  },
  'leather_leggings.json': {
    textures: { layer0: 'minecraft:item/leather_leggings', layer1: 'minecraft:item/leather_leggings_overlay', particle: '#layer0' }
  },
  'potion.json': {
    textures: { layer0: 'minecraft:item/potion', layer1: 'minecraft:item/potion_overlay', particle: '#layer0' }
  },
  'shield.json': {
    textures: { particle: 'minecraft:block/dark_oak_planks' }
  }
};

for (const [file, fix] of Object.entries(modelFixes)) {
  const p = 'scratch_pack/assets/minecraft/models/item/' + file;
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    data.textures = { ...data.textures, ...fix.textures };
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    console.log(`✓ Fixed vanilla textures in models/item/${file}`);
  }
}

// Fix spawner.json in models/block/
const spawnerPath = 'scratch_pack/assets/minecraft/models/block/spawner.json';
if (fs.existsSync(spawnerPath)) {
  const spawnerData = JSON.parse(fs.readFileSync(spawnerPath, 'utf8'));
  spawnerData.textures = { all: 'minecraft:block/spawner', particle: 'minecraft:block/spawner' };
  fs.writeFileSync(spawnerPath, JSON.stringify(spawnerData, null, 2));
  console.log('✓ Fixed vanilla textures in models/block/spawner.json');
}

// Fix original block models
const blockFixes = {
  'brown_mushroom_block.json': { '0': 'minecraft:block/brown_mushroom_block' },
  'chorus_plant.json': { '0': 'minecraft:block/chorus_plant' },
  'mushroom_stem.json': { '0': 'minecraft:block/mushroom_stem' },
  'note_block.json': { all: 'minecraft:block/note_block' },
  'red_mushroom_block.json': { '0': 'minecraft:block/red_mushroom_block' }
};
for (const [file, tex] of Object.entries(blockFixes)) {
  const p = 'scratch_pack/assets/minecraft/models/block/original/' + file;
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    data.textures = { ...data.textures, ...tex };
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    console.log(`✓ Fixed vanilla textures in models/block/original/${file}`);
  }
}

// 4. Copy modern item models (1.21.2+ / 1.21.4) to base assets/minecraft/items/
const modernItemsDir = 'scratch_pack/ia_overlay_1_21_4_to_5/assets/minecraft/items';
const targetItemsDir = 'scratch_pack/assets/minecraft/items';
if (fs.existsSync(modernItemsDir)) {
  const itemFiles = fs.readdirSync(modernItemsDir);
  for (const f of itemFiles) {
    if (f.endsWith('.json')) {
      const src = path.join(modernItemsDir, f);
      const dst = path.join(targetItemsDir, f);
      fs.copyFileSync(src, dst);
    }
  }
  console.log(`✓ Copied ${itemFiles.length} modern item definitions to assets/minecraft/items/`);
}

// 5. Update pack.mcmeta with proper pack_format: 34 (1.21.1) and all overlay ranges
const newMcmeta = {
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
      },
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
          min_inclusive: 32,
          max_inclusive: 99
        }
      }
    ]
  }
};
fs.writeFileSync('scratch_pack/pack.mcmeta', JSON.stringify(newMcmeta, null, 2));
console.log('✓ Updated pack.mcmeta with pack_format: 34 and full overlay support.');

console.log('=== ALL PACK CORRECTIONS COMPLETED ===');
