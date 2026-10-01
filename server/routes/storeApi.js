const express = require('express');
const router = express.Router();
const fs = require('fs');
const config = require('../config');
const orderStore = require('../services/orderStore');
const { resolveMinecraftProfile } = require('../services/mojangService');
const rconClient = require('../services/rconService');

// Load products database
function getProducts() {
  try {
    if (fs.existsSync(config.paths.productsFile)) {
      return JSON.parse(fs.readFileSync(config.paths.productsFile, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading products.json:', e);
  }
  return [];
}

// In-memory session cart map: sessionId -> { lines: [], subtotalUsdCents: 0 }
const carts = new Map();

function getSessionCart(req, res) {
  let sessionId = req.cookies && req.cookies['zl-session'];
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
    res.cookie('zl-session', sessionId, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  }

  if (!carts.has(sessionId)) {
    carts.set(sessionId, { lines: [], subtotalUsdCents: 0 });
  }
  return { sessionId, cart: carts.get(sessionId) };
}

function recalculateCart(cart) {
  const products = getProducts();
  let subtotal = 0;
  let count = 0;

  cart.lines = cart.lines.filter(line => {
    const prod = products.find(p => p.id === line.productId);
    if (!prod) return false;
    line.unitPriceUsdCents = prod.priceUsdCents;
    line.name = prod.name;
    line.imageUrl = prod.imageUrl;
    line.lineTotalUsdCents = prod.priceUsdCents * line.quantity;
    subtotal += line.lineTotalUsdCents;
    count += line.quantity;
    return true;
  });

  cart.subtotalUsdCents = subtotal;
  return { cart, count };
}

// GET /store/products
router.get('/products', (req, res) => {
  const products = getProducts();
  const category = req.query.category;
  if (category && category !== 'all') {
    return res.json(products.filter(p => p.category === category));
  }
  res.json(products);
});

// GET /store/cart
router.get('/cart', (req, res) => {
  const { cart } = getSessionCart(req, res);
  const result = recalculateCart(cart);
  res.json(result);
});

// POST /store/cart/update
router.post('/cart/update', (req, res) => {
  const { productId, quantity } = req.body;
  const qty = parseInt(quantity, 10);
  const { cart } = getSessionCart(req, res);
  const products = getProducts();
  const prod = products.find(p => p.id === productId);

  if (!prod) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const existingIdx = cart.lines.findIndex(l => l.productId === productId);

  if (qty <= 0) {
    if (existingIdx !== -1) cart.lines.splice(existingIdx, 1);
  } else {
    if (existingIdx !== -1) {
      cart.lines[existingIdx].quantity = prod.allowQuantity ? qty : 1;
    } else {
      cart.lines.push({
        productId: prod.id,
        slug: prod.slug,
        name: prod.name,
        quantity: prod.allowQuantity ? qty : 1,
        unitPriceUsdCents: prod.priceUsdCents,
        originalPriceUsdCents: prod.originalPriceUsdCents,
        saleName: prod.saleName,
        imageUrl: prod.imageUrl,
        allowQuantity: prod.allowQuantity,
        isSubscription: prod.isSubscription,
        lineTotalUsdCents: prod.priceUsdCents * (prod.allowQuantity ? qty : 1)
      });
    }
  }

  const result = recalculateCart(cart);
  res.json(result);
});

// POST /store/cart/remove
router.post('/cart/remove', (req, res) => {
  const { productId } = req.body;
  const { cart } = getSessionCart(req, res);
  cart.lines = cart.lines.filter(l => l.productId !== productId);
  const result = recalculateCart(cart);
  res.json(result);
});

// POST /api/store/validate-coupon
router.post('/validate-coupon', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ valid: false, error: 'Coupon code required' });

  const upper = code.trim().toUpperCase();
  const coupon = config.coupons[upper];
  if (coupon) {
    res.json({ valid: true, code: upper, discountPercent: coupon.discountPercent, description: coupon.description });
  } else {
    res.json({ valid: false, error: 'Invalid coupon code or expired' });
  }
});

// GET /api/store/top-donor
router.get('/top-donor', (req, res) => {
  res.json(orderStore.getTopDonor());
});

// GET /api/store/recent-payments
router.get('/recent-payments', (req, res) => {
  res.json(orderStore.getRecentPayments());
});

// POST /api/store/checkout
router.post('/checkout', async (req, res) => {
  try {
    const { username, isBedrock, email, couponCode, paymentMethod, items } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Minecraft username is required' });
    }

    // Verify player profile
    const profile = await resolveMinecraftProfile(username, isBedrock);

    // Get products and calculate prices
    const products = getProducts();
    const resolvedItems = [];
    let subtotalCents = 0;

    const sourceItems = Array.isArray(items) && items.length > 0 ? items : (getSessionCart(req, res).cart.lines);

    for (const item of sourceItems) {
      const prod = products.find(p => p.id === (item.productId || item.id));
      if (prod) {
        const qty = item.quantity || 1;
        const lineTotal = prod.priceUsdCents * qty;
        subtotalCents += lineTotal;
        resolvedItems.push({
          productId: prod.id,
          name: prod.name,
          quantity: qty,
          unitPriceCents: prod.priceUsdCents,
          lineTotalCents: lineTotal,
          rconCommands: prod.rconCommands || []
        });
      }
    }

    if (resolvedItems.length === 0) {
      return res.status(400).json({ error: 'No items in cart' });
    }

    // Apply coupon if valid
    let discountCents = 0;
    if (couponCode) {
      const upper = couponCode.trim().toUpperCase();
      const coupon = config.coupons[upper];
      if (coupon) {
        discountCents = Math.round(subtotalCents * (coupon.discountPercent / 100));
      }
    }

    const totalCents = Math.max(0, subtotalCents - discountCents);

    // Create order record
    const order = orderStore.createOrder({
      username: profile.username,
      isBedrock: profile.isBedrock,
      email: email || '',
      items: resolvedItems,
      couponCode: couponCode || null,
      paymentMethod: paymentMethod || 'upi',
      subtotalCents,
      discountCents,
      totalCents
    });

    // Clear session cart
    const { cart } = getSessionCart(req, res);
    cart.lines = [];
    cart.subtotalUsdCents = 0;

    res.json({
      success: true,
      orderId: order.id,
      order,
      profile,
      paymentInstructions: {
        method: paymentMethod || 'upi',
        amountFormatted: '$' + (totalCents / 100).toFixed(2),
        message: 'Order created successfully. Confirm payment to receive instant in-game perks.'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Checkout failed', details: err.message });
  }
});

// POST /api/store/simulate-payment (useful for instant testing and sandbox demonstration!)
router.post('/simulate-payment', async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = orderStore.getOrder(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID') {
      return res.json({ success: true, message: 'Order is already marked as paid', order });
    }

    // Mark as paid
    const updatedOrder = orderStore.markPaid(orderId);

    // Execute in-game RCON rewards
    const deliveryResults = [];
    for (const item of updatedOrder.items) {
      if (item.rconCommands && item.rconCommands.length > 0) {
        const cmdResults = await rconClient.executeRewardCommands(updatedOrder.username, item.rconCommands);
        deliveryResults.push({ item: item.name, commands: cmdResults });
      }
    }

    updatedOrder.deliveredAt = new Date().toISOString();
    updatedOrder.deliveryLogs = deliveryResults;
    orderStore.save();

    res.json({
      success: true,
      message: 'Payment simulation successful. In-game rewards dispatched!',
      order: updatedOrder
    });
  } catch (err) {
    res.status(500).json({ error: 'Payment simulation failed', details: err.message });
  }
});

module.exports = router;
