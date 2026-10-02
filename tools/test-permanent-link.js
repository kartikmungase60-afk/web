const assert = require('assert');

async function testPermanentLink() {
  console.log('--- Testing Permanent Link Token & Cold-Start Rehydration ---');

  // 1. Generate link code for a test Discord user
  const user = {
    id: 'test_discord_999888',
    username: 'testgamer',
    global_name: 'Test Gamer'
  };

  const codeRes = await fetch('http://localhost:3000/api/auth/link/generate-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user })
  });
  const codeData = await codeRes.json();
  console.log('1. Generated link code:', codeData.code);
  assert(codeData.code, 'Should generate an 8-digit code');

  // 2. Simulate Minecraft server linking the player
  const linkRes = await fetch('http://localhost:3000/api/auth/link/ingame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: codeData.code,
      player: 'PermanentMCPlayer',
      uuid: '99887766-5544-3322-1100-aabbccddeeff',
      serverSecret: 'battlepie_secret_token_123',
      skinName: 'Steve'
    })
  });
  const linkData = await linkRes.json();
  console.log('2. In-game link result:', linkData.success ? 'SUCCESS' : 'FAILED');
  assert(linkData.success, 'In-game link should succeed');
  assert(linkData.player.linkToken, 'Should include cryptographic linkToken');
  const token = linkData.player.linkToken;
  console.log('   Received Link Token (length):', token.length);

  // 3. Query status - should be linked
  const statusRes = await fetch('http://localhost:3000/api/auth/link/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, linkToken: token })
  });
  const statusData = await statusRes.json();
  assert(statusData.isLinked, 'Status should report isLinked=true');
  console.log('3. Live status check: isLinked =', statusData.isLinked);

  // 4. Test Cold-Start / Refresh Resilience:
  // Query status with linkToken even if Discord session was not found in cookie/session
  const coldStartRes = await fetch('http://localhost:3000/api/auth/link/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Link-Token': token
    },
    body: JSON.stringify({
      user: { id: user.id, username: user.username },
      linkToken: token,
      cachedLinkedPlayer: linkData.player
    })
  });
  const coldStartData = await coldStartRes.json();
  assert(coldStartData.isLinked, 'Should remain linked across cold starts via Link Token');
  assert.strictEqual(coldStartData.linkedPlayer.minecraftUsername, 'PermanentMCPlayer');
  console.log('4. Cold-Start / Refresh Simulation: isLinked =', coldStartData.isLinked, '| Player =', coldStartData.linkedPlayer.minecraftUsername);

  console.log('\n✅ ALL PERMANENT LINK RESILIENCE TESTS PASSED!\n');
}

testPermanentLink().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
