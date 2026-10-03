const assert = require('assert');
const PlayerLinkService = require('../server/services/playerLinkService');
const config = require('../server/config');

async function testSkinUnlinkResurrection() {
  console.log('--- 🧪 TESTING SKIN UPDATE AFTER WEBSITE UNLINK ---');

  // Step 1: Ensure User A is linked
  const userA = {
    id: '768387330485518376',
    username: 'kartikplayzz1',
    global_name: 'Kartik...'
  };

  console.log('\n[Step 1] Ensuring User A is linked...');
  const codeA = PlayerLinkService.createLinkCode(userA, true, '88880010');
  const linkResA = await PlayerLinkService.verifyAndLink({
    code: codeA.code,
    minecraftUsername: 'Kartikplayzz'
  });
  assert(linkResA.success, 'User A should be successfully linked');
  console.log('✅ User A successfully linked to Kartikplayzz.');

  // Step 2: Unlink User A via website
  console.log('\n[Step 2] Unlinking User A on website...');
  const unlinkRes = await PlayerLinkService.unlink(userA.id);
  assert(unlinkRes, 'Unlink should return true');
  assert.strictEqual(PlayerLinkService.getLinkStatus(userA.id), null, 'User A must be null in memory');
  assert.strictEqual(PlayerLinkService.getLinkByUsername('Kartikplayzz'), null, 'Kartikplayzz must be unlinked in memory');
  console.log('✅ User A successfully unlinked.');

  // Step 3: Verify Firebase unlinked & pending status
  const firebaseUrl = (process.env.FIREBASE_DATABASE_URL || config.firebaseDatabaseUrl).replace(/\/$/, '');
  const unlinkedRes = await fetch(`${firebaseUrl}/linked_players/__unlinked__/kartikplayzz.json?t=${Date.now()}`);
  const unlinkedData = await unlinkedRes.json();
  assert(unlinkedData && unlinkedData.minecraftUsername === 'Kartikplayzz', 'Kartikplayzz must be registered in __unlinked__');
  console.log('✅ /linked_players/__unlinked__/ contains unlinked record:', unlinkedData);

  const pendingList = await PlayerLinkService.getPendingUnlinks();
  const foundPending = pendingList.find(p => p.player && p.player.toLowerCase() === 'kartikplayzz');
  assert(foundPending, 'Pending unlinks must contain Kartikplayzz for in-game notification/kick');
  console.log('✅ Pending unlinks contains player:', foundPending);

  // Step 4: Simulate player changing skin in Minecraft
  console.log('\n[Step 4] Simulating player changing skin in Minecraft after unlinking...');
  const skinUpdateRes = await PlayerLinkService.updatePlayerSkinByUsername('Kartikplayzz', {
    skinUrl: 'https://mc-heads.net/body/Steve/right',
    avatarUrl: 'https://mc-heads.net/avatar/Steve/128',
    skinName: 'Steve'
  });
  assert.strictEqual(skinUpdateRes, false, 'Skin update MUST return false for unlinked player');
  console.log('✅ Skin update was safely blocked and returned false.');

  // Step 5: Verify Firebase linked_players was NOT revived/resurrected
  const checkFirebaseRes = await fetch(`${firebaseUrl}/linked_players/${userA.id}.json?t=${Date.now()}`);
  const checkFirebaseData = await checkFirebaseRes.json();
  assert.strictEqual(checkFirebaseData, null, 'Firebase linked_players MUST remain null! No zombie link!');
  console.log('✅ Confirmed Firebase /linked_players/ is null (no data resurrection).');

  // Step 6: Test acknowledge pending unlink
  console.log('\n[Step 6] Acknowledging pending unlink (simulating Minecraft plugin action)...');
  await PlayerLinkService.acknowledgeUnlink('Kartikplayzz');
  const pendingAfterAck = await PlayerLinkService.getPendingUnlinks();
  const stillPending = pendingAfterAck.find(p => p.player && p.player.toLowerCase() === 'kartikplayzz');
  assert.strictEqual(stillPending, undefined, 'Pending unlink must be cleared after acknowledgment');
  console.log('✅ Pending unlink successfully cleared from queue.');

  // Step 7: Restore User A link for production
  console.log('\n[Step 7] Restoring User A link for production...');
  const restoreCode = PlayerLinkService.createLinkCode(userA, true, '88880011');
  const restoreRes = await PlayerLinkService.verifyAndLink({
    code: restoreCode.code,
    minecraftUsername: 'Kartikplayzz'
  });
  assert(restoreRes.success, 'Restore link should succeed');
  console.log('✅ User A successfully restored.');

  console.log('\n🎉 ALL SKIN UNLINK & RESURRECTION TESTS PASSED PERFECTLY!');
  process.exit(0);
}

testSkinUnlinkResurrection().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
