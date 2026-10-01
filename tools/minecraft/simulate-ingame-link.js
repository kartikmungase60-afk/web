#!/usr/bin/env node
/**
 * Battlepie Network In-Game /link Command Simulator CLI
 * 
 * Usage:
 *   node tools/minecraft/simulate-ingame-link.js <PlayerName> <8DigitCode> [--skin <name>] [--bedrock]
 * 
 * Examples:
 *   node tools/minecraft/simulate-ingame-link.js kartik_xd1 95238934
 *   node tools/minecraft/simulate-ingame-link.js CrackPlayer123 95238934 --skin Technoblade
 *   node tools/minecraft/simulate-ingame-link.js .KartikPE 95238934 --bedrock
 */

const args = process.argv.slice(2);
const player = args[0] || 'kartik_xd1';
const code = args[1] || '95238934';
const isBedrock = args.includes('--bedrock') || player.startsWith('.') || player.startsWith('*');

let skinName = null;
const skinIdx = args.indexOf('--skin');
if (skinIdx !== -1 && args[skinIdx + 1]) {
  skinName = args[skinIdx + 1];
}

const endpoint = 'http://localhost:3000/api/auth/link/ingame';

console.log('========================================================');
console.log('  🎮 BATTLEPIE IN-GAME /LINK SIMULATOR');
console.log('========================================================');
console.log(`  Player Name:    ${player}`);
console.log(`  Link Code:      ${code}`);
console.log(`  Custom Skin:    ${skinName ? skinName + ' (SkinsRestorer)' : 'Automatic / Mojang'}`);
console.log(`  Platform:       ${isBedrock ? 'Bedrock PE (Geyser/Floodgate)' : 'Java Edition'}`);
console.log(`  Target URL:     ${endpoint}`);
console.log('--------------------------------------------------------');

async function run() {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        player,
        skinName,
        isBedrock,
        serverSecret: 'battlepie_secret_token_123'
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      console.log('  ✅ SUCCESS: Account Linked Successfully!');
      console.log(`  Minecraft ID:   ${data.player.minecraftUsername}`);
      console.log(`  UUID:           ${data.player.minecraftUuid}`);
      console.log(`  Account Type:   ${data.player.accountType}`);
      console.log(`  Skin Source:    ${data.player.skinSource}`);
      console.log(`  Avatar URL:     ${data.player.avatarUrl}`);
      console.log(`  Discord User:   @${data.player.discordUsername}`);
      console.log(`  Linked At:      ${data.player.linkedAt}`);
      console.log(`  Chat Message:   ${data.minecraftChatResponse}`);
      console.log('--------------------------------------------------------');
      console.log('  ⚡ Look at your browser on http://localhost:3000/me:');
      console.log('     It has updated instantly in real-time without reloading!');
    } else {
      console.error('  ❌ FAILED:', data.error || data.message || 'Unknown error');
    }
  } catch (err) {
    console.error('  ❌ Connection Error:', err.message);
    console.log('     Is your backend running on http://localhost:3000?');
  }
  console.log('========================================================\n');
}

run();
