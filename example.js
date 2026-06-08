/**
 * Authon JavaScript SDK - Complete Usage Example
 * ================================================
 *
 * Before running:
 * 1. Create an account at https://authon.pro
 * 2. Create an application in the dashboard
 * 3. Copy your App ID and API Key below
 *
 * Run:
 *   node example.js
 *
 * Need help? Join Discord: https://discord.gg/jMZCTKPsmE
 */

const { Authon } = require('./authon');
const readline = require('readline');
const fs = require('fs');

// ╔══════════════════════════════════════════════════════════════╗
// ║  CONFIGURATION - Replace with your credentials             ║
// ║  Get these from: https://authon.pro/dashboard              ║
// ╚══════════════════════════════════════════════════════════════╝

const APP_ID = 'your-app-id';     // Dashboard → Apps → App ID
const API_KEY = 'your-api-key';   // Dashboard → Apps → Settings → API Key

// ══════════════════════════════════════════════════════════════

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  const auth = new Authon(APP_ID, API_KEY);

  console.log('═'.repeat(50));
  console.log('  Authon SDK Example - JavaScript/Node.js');
  console.log('═'.repeat(50));

  // STEP 1: Initialize
  console.log('\n[*] Connecting to Authon API...');

  if (!await auth.init()) {
    console.log('[-] Failed to connect to Authon API');
    console.log('    → Check your APP_ID and API_KEY');
    console.log('    → API status: https://api.authon.pro/health');
    process.exit(1);
  }

  console.log(`[+] Connected: ${auth.appName} v${auth.appVersion}`);
  console.log(`    HWID Lock: ${auth.hwidLock ? 'Enabled' : 'Disabled'}`);
  console.log(`    Your HWID: ${Authon.getHWID()}`);

  // STEP 2: Authenticate
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  [1] Login (Username + Password)    │');
  console.log('│  [2] License Key                    │');
  console.log('│  [3] Register (New Account)         │');
  console.log('└─────────────────────────────────────┘');

  const choice = await ask('\n> ');
  let result;

  if (choice === '1') {
    const username = await ask('  Username: ');
    const password = await ask('  Password: ');
    console.log('\n[*] Logging in...');
    result = await auth.login(username.trim(), password.trim());
  } else if (choice === '2') {
    const key = await ask('  License Key: ');
    console.log('\n[*] Validating license...');
    result = await auth.license(key.trim());
  } else if (choice === '3') {
    const username = await ask('  Username: ');
    const password = await ask('  Password: ');
    const licenseKey = await ask('  License Key: ');
    console.log('\n[*] Registering...');
    result = await auth.register(username.trim(), password.trim(), licenseKey.trim());
    if (result.success) {
      console.log('[+] Registered! Logging in...');
      result = await auth.login(username.trim(), password.trim());
    }
  } else {
    console.log('[-] Invalid choice');
    process.exit(1);
  }

  if (!result.success) {
    console.log(`\n[-] Failed: ${result.message}`);
    process.exit(1);
  }

  // STEP 3: Authenticated
  console.log('\n[+] ✓ Authenticated!');
  console.log(`    ├─ Username:     ${auth.username || 'N/A'}`);
  console.log(`    ├─ Level:        ${auth.level}`);
  console.log(`    ├─ Subscription: ${auth.subscription || 'None'}`);
  console.log(`    ├─ Expires:      ${auth.expiresAt || 'Lifetime'}`);
  console.log(`    └─ Session:      ${auth.sessionToken.slice(0, 16)}...`);

  // STEP 4: Features
  console.log('\n' + '─'.repeat(50));
  console.log('  FEATURES DEMO');
  console.log('─'.repeat(50));

  // Variables
  const welcome = await auth.getVar('welcome_message');
  if (welcome) console.log(`\n[*] App Variable: ${welcome}`);

  await auth.setVar('last_os', `Node.js ${process.version} on ${process.platform}`);
  const saved = await auth.getUserVar('last_os');
  console.log(`[*] User Variable saved: ${saved}`);

  // Files
  const files = await auth.listFiles();
  if (files.length > 0) {
    console.log(`\n[*] Available Files (${files.length}):`);
    files.forEach((f, i) => {
      console.log(`    [${i + 1}] ${f.name} (${(f.size / 1024).toFixed(1)} KB) — Level ${f.minLevel}`);
    });
  }

  // Online
  const online = await auth.fetchOnline();
  console.log(`\n[*] Online Users: ${online.count}`);

  // Stats
  const stats = await auth.fetchStats();
  if (stats.totalUsers !== undefined) {
    console.log(`[*] App Stats: ${stats.totalUsers} users, ${stats.onlineUsers} online, ${stats.totalKeys} keys`);
  }

  // Log
  await auth.log('JavaScript SDK example executed');
  console.log('[*] Activity logged ✓');

  // Session check
  if (await auth.check()) console.log('[*] Session valid ✓');

  // STEP 5: Cleanup
  console.log('\n' + '─'.repeat(50));
  await ask('Press Enter to logout...');
  await auth.logout();
  console.log('[+] Logged out. Goodbye!');
  rl.close();
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
