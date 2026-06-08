<p align="center">
  <img src="https://authon.pro/logo.png" alt="Authon" width="100" />
</p>

<h1 align="center">Authon JavaScript SDK</h1>

<p align="center">
  <strong>Official JavaScript/Node.js SDK for <a href="https://authon.pro">Authon</a> — Software Licensing & Authentication Platform</strong>
</p>

<p align="center">
  <a href="https://authon.pro"><img src="https://img.shields.io/badge/Website-authon.pro-7c3aed?style=flat-square" alt="Website" /></a>
  <a href="https://discord.gg/jMZCTKPsmE"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
  <a href="https://authon.pro/status"><img src="https://img.shields.io/badge/Status-Check-22c55e?style=flat-square" alt="Status" /></a>
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 🚀 Quick Start

### 1. Requirements

- Node.js 18+ (uses built-in `fetch`)
- **No external dependencies**

Also works with: **Electron**, **Bun**, **Deno**

### 2. Get Your Credentials

1. Create an account at [authon.pro](https://authon.pro)
2. Go to **Dashboard → Apps → Create Application**
3. Copy your **App ID** and **API Key**

### 3. Use

```javascript
const { Authon } = require('./authon');

const auth = new Authon('your-app-id', 'your-api-key');

async function main() {
  // Connect
  await auth.init();
  console.log(`Connected: ${auth.appName} v${auth.appVersion}`);

  // Login
  const result = await auth.login('username', 'password');
  if (result.success) {
    console.log(`Welcome ${auth.username}! Level: ${auth.level}`);
    console.log(`Subscription: ${auth.subscription}`);
    console.log(`Expires: ${auth.expiresAt}`);
  } else {
    console.log(`Error: ${result.message}`);
  }

  // Download files
  const files = await auth.listFiles();
  if (files.length > 0) {
    const buffer = await auth.downloadFile(files[0].id);
    require('fs').writeFileSync(files[0].name, buffer);
  }

  // Logout
  await auth.logout();
}

main();
```

---

## 📖 API Reference

### Initialization

```javascript
const auth = new Authon(appId, apiKey, [apiUrl]);
await auth.init();  // Returns: boolean
```

### Authentication

```javascript
await auth.login(username, password, [hwid])   // Returns: {success, message, data}
await auth.license(key, [hwid])                // Returns: {success, message, data}
await auth.register(username, password, key)   // Returns: {success, message}
await auth.check()                             // Returns: boolean
await auth.logout()                            // Returns: boolean
```

### Variables

```javascript
await auth.getVar('key')              // Returns: string | null
await auth.setVar('key', 'value')     // Returns: boolean
await auth.getUserVar('key')          // Returns: string | null
```

### Files

```javascript
await auth.listFiles()                // Returns: [{id, name, size, minLevel}]
await auth.downloadFile(fileId)       // Returns: Buffer | null
```

### Stats & Logging

```javascript
await auth.log('message')             // Returns: boolean
await auth.fetchOnline()              // Returns: {count, users}
await auth.fetchStats()               // Returns: {totalUsers, onlineUsers, totalKeys}
```

### Utility

```javascript
Authon.getHWID()                      // Returns: string (static method)
await auth.checkBlacklist(ip, hwid)   // Returns: {blacklisted, reason}
await auth.redeemReferral(code)       // Returns: {success, message, data}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `sessionToken` | `string` | Active session token |
| `username` | `string` | Authenticated username |
| `level` | `number` | User access level |
| `subscription` | `string` | Subscription name |
| `expiresAt` | `string` | Expiry date |
| `appName` | `string` | Application name |
| `appVersion` | `string` | Application version |
| `isAuthenticated` | `boolean` | Has active session |

---

## ⚠️ Error Handling

```javascript
const result = await auth.login('user', 'wrong');
if (!result.success) {
  // Possible messages:
  // - "Invalid credentials"
  // - "Account banned"
  // - "Hardware ID mismatch"
  // - "Subscription expired"
  // - "Account is frozen"
  // - "VPN/Proxy connections are not allowed"
  // - "Application is paused"
  console.error(result.message);
}
```

---

## 🏗️ Project Structure

```
javascript-Loader/
├── authon.js           # SDK source (single file, zero dependencies)
├── example.js          # Full interactive example
├── package.json        # NPM package metadata
└── README.md           # This file
```

---

## 🔗 Links

| Resource | URL |
|----------|-----|
| 🌐 Website | https://authon.pro |
| 📖 Documentation | https://authon.pro/docs |
| 💬 Discord | https://discord.gg/jMZCTKPsmE |
| 📊 Status | https://authon.pro/status |
| 🔗 API Health | https://api.authon.pro/health |
| 🐙 GitHub | https://github.com/authonpro |

---

## 📄 License

MIT — Free for commercial and personal use.

---

<p align="center">
  <strong>Built with ❤️ by <a href="https://authon.pro">Authon</a></strong><br/>
  The #1 KeyAuth Alternative
</p>
