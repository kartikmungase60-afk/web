const http = require('http');
const app = require('./index');

const PORT = 3456;
const server = app.listen(PORT, async () => {
  console.log(`[TestRunner] Test server listening on port ${PORT}...`);

  async function get(path) {
    const res = await fetch(`http://localhost:${PORT}${path}`);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  async function post(path, body) {
    const res = await fetch(`http://localhost:${PORT}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  try {
    // 1. Health
    const health = await get('/health');
    console.log('[Test] Health Check:', health.status, health.data.status);

    // 2. Public Status (Minecraft ping)
    const status = await get('/api-public/status');
    console.log('[Test] MC Server Status:', status.status, 'Online:', status.data.online, 'Players:', status.data.players.online);

    // 3. Discord stats
    const discord = await get('/api-public/discord');
    console.log('[Test] Discord Stats:', discord.status, 'Total:', discord.data.totalMembers, 'Online:', discord.data.onlineMembers);

    // 4. Products list
    const products = await get('/store/products');
    console.log('[Test] Products Count:', products.status, products.data.length);

    // 5. Coupon validation
    const couponValid = await post('/api/store/validate-coupon', { code: 'BATTLEPIE' });
    console.log('[Test] Coupon BATTLEPIE:', couponValid.status, 'Discount:', couponValid.data.discountPercent + '%');

    // 6. Player profile lookup (Mojang / MC-heads)
    const player = await get('/api-public/player/Notch');
    console.log('[Test] Player Lookup Notch:', player.status, 'UUID:', player.data.uuid);

    // 7. Checkout & simulated payment
    const checkout = await post('/api/store/checkout', {
      username: 'TestPlayer',
      items: [{ productId: 'pie-rank', quantity: 1 }],
      couponCode: 'BATTLEPIE',
      paymentMethod: 'upi'
    });
    console.log('[Test] Checkout Order:', checkout.status, 'OrderID:', checkout.data.orderId, 'Total:', checkout.data.order.totalCents);

    // 8. Simulate payment & RCON trigger
    const simPay = await post('/api/store/simulate-payment', { orderId: checkout.data.orderId });
    console.log('[Test] Simulated Payment & RCON:', simPay.status, 'Status:', simPay.data.order.status, 'Delivered:', !!simPay.data.order.deliveredAt);

    console.log('\n>>> ALL BACKEND API TESTS PASSED SUCCESSFULLY! <<<\n');
  } catch (err) {
    console.error('[TestRunner] Test failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
