const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure data directory exists
if (!fs.existsSync(config.paths.dataDir)) {
  fs.mkdirSync(config.paths.dataDir, { recursive: true });
}

// Initial mock recent payments if none exist
const initialPayments = [
  { id: 'pay_101', username: 'RISHU69Sucks', packageName: 'Pie++ Rank', priceUsdCents: 1999, timestamp: Date.now() - 1000 * 60 * 25 },
  { id: 'pay_102', username: 'Vortex_Gamer', packageName: '10,000 Coins', priceUsdCents: 799, timestamp: Date.now() - 1000 * 60 * 75 },
  { id: 'pay_103', username: 'ShadowBlade', packageName: 'Pie+ Rank', priceUsdCents: 999, timestamp: Date.now() - 1000 * 60 * 180 },
  { id: 'pay_104', username: 'PixelKnight', packageName: '5x Heart Package', priceUsdCents: 399, timestamp: Date.now() - 1000 * 60 * 320 },
  { id: 'pay_105', username: 'KryptonMC', packageName: '20,000 Coins', priceUsdCents: 1399, timestamp: Date.now() - 1000 * 60 * 540 }
];

class OrderStore {
  constructor() {
    this.filePath = config.paths.ordersFile;
    this.orders = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[OrderStore] Error reading orders file:', e.message);
    }
    const defaults = {
      orders: [],
      recentPayments: initialPayments,
      topDonor: {
        username: 'RISHU69Sucks',
        amount: '$145.00',
        amountCents: 14500,
        badge: 'Top Supporter',
        avatarUrl: 'https://mc-heads.net/avatar/RISHU69Sucks/64',
        skin3dUrl: 'https://mc-heads.net/body/RISHU69Sucks/right'
      }
    };
    this.save(defaults);
    return defaults;
  }

  save(data = this.orders) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[OrderStore] Error saving orders:', e.message);
    }
  }

  createOrder({ username, isBedrock, email, items, couponCode, paymentMethod, subtotalCents, discountCents, totalCents }) {
    const orderId = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const order = {
      id: orderId,
      username,
      isBedrock: !!isBedrock,
      email: email || '',
      items,
      couponCode: couponCode || null,
      paymentMethod,
      subtotalCents,
      discountCents,
      totalCents,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      paidAt: null,
      deliveredAt: null,
      deliveryLogs: []
    };

    this.orders.orders.push(order);
    this.save();
    return order;
  }

  getOrder(orderId) {
    return this.orders.orders.find(o => o.id === orderId);
  }

  markPaid(orderId, transactionId = null) {
    const order = this.getOrder(orderId);
    if (!order) return null;

    order.status = 'PAID';
    order.paidAt = new Date().toISOString();
    order.transactionId = transactionId || 'TXN-' + Math.random().toString(36).substring(2, 9).toUpperCase();

    // Add to recent payments feed
    const firstItem = order.items && order.items[0];
    const pkgName = firstItem ? (firstItem.name + (order.items.length > 1 ? ` (+${order.items.length - 1} more)` : '')) : 'Store Package';

    this.orders.recentPayments.unshift({
      id: order.id,
      username: order.username,
      packageName: pkgName,
      priceUsdCents: order.totalCents,
      timestamp: Date.now()
    });

    // Keep recent payments to last 20
    if (this.orders.recentPayments.length > 20) {
      this.orders.recentPayments.pop();
    }

    this.save();
    return order;
  }

  getRecentPayments() {
    return this.orders.recentPayments || initialPayments;
  }

  getTopDonor() {
    return this.orders.topDonor;
  }
}

module.exports = new OrderStore();
