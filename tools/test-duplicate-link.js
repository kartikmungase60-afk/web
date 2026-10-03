const assert = require('assert');
const PlayerLinkService = require('../server/services/playerLinkService');
const config = require('../server/config');

async function runTest() {
  console.log('--- 🧪 STARTING STRICT 1-TO-1 ACCOUNT LINKING TEST ---');

  // Load from Firebase
  await PlayerLinkService.ensureLoaded(true);

  // Setup Discord User A and User B
  const userA = {
    id: '768387330485518376',
    username: 'kartikplayzz1',
    global_name: 'Kartik...'
  };

  const userB = {
    id: '1528726101872869387',
    username: 'kartik_xd1',
    global_name: 'Kartik'
  };

  // Step 1: Ensure User A is linked to Kartikplayzz
  console.log('\n[Step 1] Ensuring User A (@kartikplayzz1) is linked to Kartikplayzz...');
  const codeA = PlayerLinkService.createLinkCode(userA, true, '88880001');
  const linkResA = await PlayerLinkService.verifyAndLink({
    code: codeA.code,
    minecraftUsername: 'Kartikplayzz'
  });
  console.log('User A Link Result:', linkResA.success ? 'SUCCESS' : linkResA.error);
  assert(linkResA.success, 'User A should be successfully linked');

  // Step 2: User B generates a code and tries to link the SAME Minecraft account (Kartikplayzz)
  console.log('\n[Step 2] Testing duplicate link attempt from User B (@kartik_xd1)...');
  const codeB = PlayerLinkService.createLinkCode(userB, true, '88880002');
  const linkResB = await PlayerLinkService.verifyAndLink({
    code: codeB.code,
    minecraftUsername: 'Kartikplayzz'
  });

  console.log('User B Link Attempt Result:', {
    success: linkResB.success,
    alreadyLinked: linkResB.alreadyLinked,
    error: linkResB.error
  });

  assert.strictEqual(linkResB.success, false, 'User B linking MUST be rejected!');
  assert.strictEqual(linkResB.alreadyLinked, true, 'Result must flag alreadyLinked = true');
  assert(linkResB.error.includes('already linked to Discord @kartikplayzz1'), 'Error must specify existing Discord account');
  console.log('✅ PASS: Duplicate link was properly BLOCKED with clear message!');

  // Step 3: Unlink User A on the website
  console.log('\n[Step 3] Simulating User A unlinking on https://mineorange.fun/me...');
  const unlinkRes = await PlayerLinkService.unlink(userA.id);
  assert(unlinkRes, 'Unlink should return true');

  const statusAfterUnlinkA = PlayerLinkService.getLinkStatus(userA.id);
  assert.strictEqual(statusAfterUnlinkA, null, 'User A should no longer be linked in memory');

  const mcStatus = PlayerLinkService.getLinkByUsername('Kartikplayzz');
  assert.strictEqual(mcStatus, null, 'Kartikplayzz should no longer be linked to any Discord account');
  console.log('✅ PASS: Kartikplayzz is successfully released and unlinked!');

  // Step 4: Now User B links Kartikplayzz
  console.log('\n[Step 4] Now User B links Kartikplayzz with their code...');
  const codeB2 = PlayerLinkService.createLinkCode(userB, true, '88880003');
  const linkResB2 = await PlayerLinkService.verifyAndLink({
    code: codeB2.code,
    minecraftUsername: 'Kartikplayzz'
  });

  console.log('User B Second Link Attempt Result:', linkResB2.success ? 'SUCCESS' : linkResB2.error);
  assert(linkResB2.success, 'User B should now be able to link Kartikplayzz');
  assert.strictEqual(linkResB2.player.discordId, userB.id);
  console.log('✅ PASS: User B successfully linked Kartikplayzz after User A unlinked!');

  // Step 5: Now User A tries to link Kartikplayzz while User B is linked
  console.log('\n[Step 5] User A tries to link Kartikplayzz again while User B has it linked...');
  const codeA2 = PlayerLinkService.createLinkCode(userA, true, '88880004');
  const linkResA2 = await PlayerLinkService.verifyAndLink({
    code: codeA2.code,
    minecraftUsername: 'Kartikplayzz'
  });

  console.log('User A Second Link Attempt Result:', {
    success: linkResA2.success,
    alreadyLinked: linkResA2.alreadyLinked,
    error: linkResA2.error
  });
  assert.strictEqual(linkResA2.success, false, 'User A must now be BLOCKED');
  assert(linkResA2.error.includes('already linked to Discord @kartik_xd1'), 'Error must specify @kartik_xd1');
  console.log('✅ PASS: User A is properly blocked from stealing User B\'s linked account!');

  // Step 6: Clean reset back to User A if desired
  console.log('\n[Step 6] Restoring User A (@kartikplayzz1) as the linked account...');
  await PlayerLinkService.unlink(userB.id);
  const codeRestore = PlayerLinkService.createLinkCode(userA, true, '88880005');
  await PlayerLinkService.verifyAndLink({
    code: codeRestore.code,
    minecraftUsername: 'Kartikplayzz'
  });
  console.log('✅ Restored User A as the linked player for Kartikplayzz.');

  console.log('\n🎉 ALL STRICT 1-TO-1 LINKING & UNLINKING TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
