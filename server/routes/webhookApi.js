const express = require('express');
const router = express.Router();
const orderStore = require('../services/orderStore');
const rconClient = require('../services/rconService');
const config = require('../config');

// POST /api/webhooks/payment
router.post('/payment', async (req, res) => {
  try {
    const { orderId, transactionId, status, secret } = req.body;

    if (config.serverSecret && (!secret || secret !== config.serverSecret)) {
      return res.status(403).json({ error: 'Unauthorized webhook secret' });
    }

    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const order = orderStore.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID') {
      return res.json({ received: true, message: 'Order was already processed' });
    }

    // Mark order as paid
    const updatedOrder = orderStore.markPaid(orderId, transactionId);

    // Trigger in-game RCON commands
    const deliveryLogs = [];
    for (const item of updatedOrder.items) {
      if (item.rconCommands && item.rconCommands.length > 0) {
        const results = await rconClient.executeRewardCommands(updatedOrder.username, item.rconCommands);
        deliveryLogs.push({ item: item.name, commands: results });
      }
    }

    updatedOrder.deliveredAt = new Date().toISOString();
    updatedOrder.deliveryLogs = deliveryLogs;
    orderStore.save();

    console.log(`[Webhook] Order ${orderId} successfully processed and delivered to ${updatedOrder.username}!`);
    res.json({ success: true, orderId, status: 'DELIVERED' });
  } catch (err) {
    console.error('[Webhook] Error processing payment webhook:', err);
    res.status(500).json({ error: 'Webhook processing error', details: err.message });
  }
});

module.exports = router;
