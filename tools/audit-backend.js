const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function runAudit() {
  console.log('========================================================');
  console.log('🔍 RUNNING COMPREHENSIVE BACKEND & API AUDIT');
  console.log('========================================================\n');

  const issues = [];
  const warnings = [];
  const passes = [];

  // Helper for testing endpoints
  async function testEndpoint(name, url, options = {}, expectedStatus = [200]) {
    try {
      const res = await fetch(BASE_URL + url, options);
      const isExpected = expectedStatus.includes(res.status);
      let body = null;
      const text = await res.text();
      try { body = JSON.parse(text); } catch (e) { body = text; }

      if (isExpected) {
        passes.push(`${name} (${res.status})`);
        return { ok: true, status: res.status, body };
      } else {
        issues.push(`${name}: Expected HTTP ${expectedStatus.join('/')}, got ${res.status}. Body: ${text.substring(0, 150)}`);
        return { ok: false, status: res.status, body };
      }
    } catch (e) {
      issues.push(`${name}: Network/Fetch error: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  // 1. Core Endpoints
  console.log('--- 1. Testing Core Endpoints ---');
  await testEndpoint('Health Check', '/health');
  await testEndpoint('Public Status', '/api-public/status');
  await testEndpoint('Discord Stats', '/api-public/discord');
  await testEndpoint('Resolve Profile (Valid)', '/api-public/resolve-profile?username=Kartikplayzz');
  await testEndpoint('Resolve Profile (Bedrock)', '/api-public/resolve-profile?username=.Kartikplayzz&bedrock=true');
  await testEndpoint('Resolve Profile (Empty)', '/api-public/resolve-profile?username=', {}, [400]);

  // 2. Store Endpoints
  console.log('--- 2. Testing Store Endpoints ---');
  await testEndpoint('Get Products', '/store/products');
  await testEndpoint('Get Cart', '/store/cart');
  await testEndpoint('Get Top Donor', '/store/top-donor');
  await testEndpoint('Get Recent Payments', '/store/recent-payments');
  await testEndpoint('Validate Coupon (Valid)', '/store/validate-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'MINEORANGE' })
  });
  await testEndpoint('Validate Coupon (Invalid)', '/store/validate-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'INVALID_COUPON_999' })
  });
  await testEndpoint('Checkout Missing Username', '/store/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '' })
  }, [400]);

  // 3. Feature Endpoints
  console.log('--- 3. Testing Feature Endpoints ---');
  await testEndpoint('Tournaments List', '/api/tournaments');
  await testEndpoint('Tournaments Detail (Non-existent)', '/api/tournaments/fake-id', {}, [404]);
  await testEndpoint('Applications List', '/api/applications');
  await testEndpoint('Mailbox List', '/api/mailbox');
  await testEndpoint('Orders My (No username)', '/api/orders/my');
  await testEndpoint('Orders My (With username)', '/api/orders/my?username=Kartikplayzz');

  // 4. Auth & Link Endpoints
  console.log('--- 4. Testing Auth & Link Endpoints ---');
  await testEndpoint('Auth Me (Unauthenticated)', '/api/auth/me');
  await testEndpoint('Auth Check (Unauthenticated)', '/api/auth/check');
  await testEndpoint('Link Status (Unauthenticated)', '/api/auth/link/status');
  await testEndpoint('In-Game Link Missing Secret', '/api/auth/link/ingame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '12345678', player: 'Test' })
  }, [403]);
  await testEndpoint('In-Game Link Missing Fields', '/api/auth/link/ingame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverSecret: 'battlepie_secret_token_123' })
  }, [400]);
  await testEndpoint('In-Game Link Invalid Secret', '/api/auth/link/ingame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '12345678', player: 'Test', serverSecret: 'wrong_secret' })
  }, [403]);
  await testEndpoint('In-Game Link Invalid Code', '/api/auth/link/ingame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '99999999', player: 'NonExistentPlayerXYZ123', serverSecret: 'battlepie_secret_token_123' })
  }, [400]);

  // 5. Admin Endpoints
  console.log('--- 5. Testing Admin Security ---');
  await testEndpoint('Admin Check (Unauthenticated)', '/api/admin/auth/check');
  await testEndpoint('Admin Overview (Unauthorized)', '/api/admin/overview', {}, [401]);
  await testEndpoint('Admin Login (Wrong credentials)', '/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
  }, [401]);

  // 6. JSON Data Files Integrity Check
  console.log('--- 6. Checking JSON Database Integrity ---');
  const dataDir = path.join(__dirname, '../server/data');
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(dataDir, f), 'utf8');
        JSON.parse(content);
        passes.push(`Data File: ${f} valid JSON`);
      } catch (err) {
        issues.push(`Data File Corruption: ${f} failed JSON.parse: ${err.message}`);
      }
    }
  }

  // 7. Summary
  console.log('\n========================================================');
  console.log(`✅ PASSED CHECKS: ${passes.length}`);
  console.log(`⚠️ WARNINGS:     ${warnings.length}`);
  console.log(`❌ ISSUES FOUND: ${issues.length}`);
  console.log('========================================================');

  if (issues.length > 0) {
    console.log('\n❌ DETECTED ISSUES:');
    issues.forEach((iss, i) => console.log(` ${i + 1}. ${iss}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    warnings.forEach((w, i) => console.log(` ${i + 1}. ${w}`));
  }
}

runAudit();
