/**
 * Authon JavaScript/Node.js SDK v1.0.0
 * Official SDK for Authon — Software Licensing & Authentication Platform
 *
 * Website: https://authon.pro
 * API:     https://api.authon.pro/v1
 * Docs:    https://authon.pro/docs
 * Discord: https://discord.gg/jMZCTKPsmE
 * Status:  https://authon.pro/status
 *
 * Requirements: Node.js 18+ (built-in fetch)
 * Works with: Node.js, Electron, Bun, Deno
 *
 * Usage:
 *   const { Authon } = require('./authon');
 *   const auth = new Authon('your-app-id', 'your-api-key');
 *   await auth.init();
 *   const result = await auth.login('username', 'password');
 *
 * License: MIT
 */

'use strict';

const { createHash } = require('crypto');
const { hostname, platform, arch, cpus } = require('os');
const fs = require('fs');
const path = require('path');

const SDK_VERSION = '1.0.0';
const DEFAULT_API_URL = 'https://api.authon.pro/v1';
const REQUEST_TIMEOUT = 15000; // 15 seconds
const FILE_TIMEOUT = 60000;    // 60 seconds for downloads

class AuthonError extends Error {
  constructor(message, code = null) {
    super(message);
    this.name = 'AuthonError';
    this.code = code;
  }
}

class Authon {
  /**
   * Create an Authon SDK instance.
   *
   * @param {string} appId - Your Application ID (Dashboard → Apps → Your App)
   * @param {string} apiKey - Your API Key (Dashboard → Apps → Settings)
   * @param {string} [apiUrl] - Custom API URL (default: https://api.authon.pro/v1)
   *
   * @example
   * const auth = new Authon('your-app-id', 'your-api-key');
   */
  constructor(appId, apiKey, apiUrl = DEFAULT_API_URL) {
    if (!appId || !apiKey) {
      throw new AuthonError('appId and apiKey are required');
    }

    this.appId = appId;
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;

    // Session state (populated after authentication)
    this.sessionToken = null;
    this.username = null;
    this.level = 0;
    this.subscription = null;
    this.expiresAt = null;

    // App info (populated after init())
    this.appName = null;
    this.appVersion = null;
    this.hwidLock = false;

    this._initialized = false;
  }

  /** @returns {boolean} Whether user has an active session */
  get isAuthenticated() {
    return this.sessionToken !== null;
  }

  /**
   * Generate a unique Hardware ID from the current machine.
   * - Windows: disk serial + hostname
   * - macOS: hardware UUID
   * - Linux: /etc/machine-id
   *
   * @returns {string} MD5 hash of hardware identifiers
   */
  static getHWID() {
    try {
      let raw;
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        const serial = execSync('wmic diskdrive get serialnumber', { encoding: 'utf8', timeout: 5000 })
          .split('\n')[1]?.trim() || '';
        raw = serial + hostname();
      } else if (process.platform === 'darwin') {
        const { execSync } = require('child_process');
        const output = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { encoding: 'utf8', timeout: 5000 });
        const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        raw = match ? match[1] : hostname() + arch();
      } else {
        // Linux
        if (fs.existsSync('/etc/machine-id')) {
          raw = fs.readFileSync('/etc/machine-id', 'utf8').trim();
        } else {
          raw = hostname() + platform() + arch() + (cpus()[0]?.model || '');
        }
      }
      return createHash('md5').update(raw).digest('hex');
    } catch {
      return createHash('md5').update(hostname() + platform()).digest('hex');
    }
  }

  /**
   * Internal: Send POST request to Authon API
   * @private
   */
  async _request(data, timeout = REQUEST_TIMEOUT) {
    data.appId = this.appId;
    data.apiKey = this.apiKey;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Authon-JS-SDK/${SDK_VERSION}`,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle binary response (file downloads)
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('octet-stream')) {
        const buffer = Buffer.from(await response.arrayBuffer());
        return { success: true, binary: buffer };
      }

      const json = await response.json();
      return json;
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Request timed out. Check API status: https://authon.pro/status' };
      }
      return { success: false, message: err.message || 'Connection failed' };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Initialize connection to Authon API.
   * Must be called before any other method.
   *
   * @returns {Promise<boolean>} True if connection successful
   *
   * @example
   * const auth = new Authon('app-id', 'api-key');
   * if (!await auth.init()) {
   *   console.error('Connection failed');
   *   process.exit(1);
   * }
   * console.log(`Connected to ${auth.appName} v${auth.appVersion}`);
   */
  async init() {
    const result = await this._request({ type: 'init' });
    if (result.success && result.data) {
      this.appName = result.data.name;
      this.appVersion = result.data.version;
      this.hwidLock = result.data.hwidLock || false;
      this._initialized = true;
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Login with username and password.
   *
   * @param {string} username - User's username
   * @param {string} password - User's password
   * @param {string} [hwid] - Hardware ID (auto-generated if not provided)
   * @returns {Promise<Object>} {success, message, data: {sessionToken, username, level, subscription, expiresAt}}
   *
   * @example
   * const result = await auth.login('john', 'mypassword');
   * if (result.success) {
   *   console.log(`Welcome ${auth.username}! Level: ${auth.level}`);
   * } else {
   *   console.log(`Error: ${result.message}`);
   *   // Possible: "Invalid credentials", "Account banned", "HWID mismatch",
   *   //           "Subscription expired", "VPN/Proxy not allowed"
   * }
   */
  async login(username, password, hwid = null) {
    if (!username || !password) {
      return { success: false, message: 'Username and password are required' };
    }

    const result = await this._request({
      type: 'login',
      username,
      password,
      hwid: hwid || Authon.getHWID(),
    });

    if (result.success && result.data) {
      this.sessionToken = result.data.sessionToken;
      this.username = result.data.username;
      this.level = result.data.level || 0;
      this.subscription = result.data.subscription;
      this.expiresAt = result.data.expiresAt;
    }
    return result;
  }

  /**
   * Authenticate with license key only (no username/password needed).
   *
   * @param {string} key - License key (e.g., "XXXXX-XXXXX-XXXXX-XXXXX")
   * @param {string} [hwid] - Hardware ID (auto-generated if not provided)
   * @returns {Promise<Object>} {success, message, data}
   *
   * @example
   * const result = await auth.license('A1B2C-D3E4F-G5H6I-J7K8L');
   * if (result.success) {
   *   console.log(`Valid! Level: ${auth.level}, Expires: ${auth.expiresAt}`);
   * }
   */
  async license(key, hwid = null) {
    if (!key) return { success: false, message: 'License key is required' };

    const result = await this._request({
      type: 'license',
      licenseKey: key,
      hwid: hwid || Authon.getHWID(),
    });

    if (result.success && result.data) {
      this.sessionToken = result.data.sessionToken;
      this.level = result.data.level || 0;
      this.subscription = result.data.subscription;
      this.expiresAt = result.data.expiresAt;
    }
    return result;
  }

  /**
   * Register a new account with a license key.
   *
   * @param {string} username - Desired username
   * @param {string} password - Desired password
   * @param {string} licenseKey - Valid unused license key
   * @param {string} [hwid] - Hardware ID
   * @returns {Promise<Object>} {success, message}
   */
  async register(username, password, licenseKey, hwid = null) {
    if (!username || !password || !licenseKey) {
      return { success: false, message: 'username, password, and licenseKey are required' };
    }

    return this._request({
      type: 'register',
      username,
      password,
      licenseKey,
      hwid: hwid || Authon.getHWID(),
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  /**
   * Validate current session (heartbeat).
   * @returns {Promise<boolean>} True if session is still valid
   */
  async check() {
    if (!this.sessionToken) return false;
    const result = await this._request({ type: 'check', sessionToken: this.sessionToken });
    return result.success === true;
  }

  /**
   * End current session.
   * @returns {Promise<boolean>} True if logout successful
   */
  async logout() {
    if (!this.sessionToken) return false;
    const result = await this._request({ type: 'logout', sessionToken: this.sessionToken });
    if (result.success) {
      this.sessionToken = null;
      this.username = null;
      this.level = 0;
    }
    return result.success === true;
  }

  // ═══════════════════════════════════════════════════════════
  // VARIABLES
  // ═══════════════════════════════════════════════════════════

  /**
   * Get an application-level variable (set by seller in dashboard).
   * @param {string} key - Variable name
   * @returns {Promise<string|null>} Value or null
   */
  async getVar(key) {
    const result = await this._request({ type: 'var', key, sessionToken: this.sessionToken });
    return result.success ? result.data?.value : null;
  }

  /**
   * Set a user-level variable (stored per-user).
   * @param {string} key - Variable name
   * @param {string} value - Variable value
   * @returns {Promise<boolean>}
   */
  async setVar(key, value) {
    const result = await this._request({ type: 'setvar', key, value: String(value), sessionToken: this.sessionToken });
    return result.success === true;
  }

  /**
   * Get a user-level variable.
   * @param {string} key - Variable name
   * @returns {Promise<string|null>} Value or null
   */
  async getUserVar(key) {
    const result = await this._request({ type: 'getvar', key, sessionToken: this.sessionToken });
    return result.success ? result.data?.value : null;
  }

  // ═══════════════════════════════════════════════════════════
  // FILES
  // ═══════════════════════════════════════════════════════════

  /**
   * List files available for the current user's level.
   * @returns {Promise<Array<{id: string, name: string, size: number, minLevel: number}>>}
   */
  async listFiles() {
    const result = await this._request({ type: 'list_files', sessionToken: this.sessionToken });
    return result.success ? (result.data || []) : [];
  }

  /**
   * Download a file by ID (returns Buffer).
   * @param {string} fileId - File ID from listFiles()
   * @returns {Promise<Buffer|null>} File content or null
   *
   * @example
   * const files = await auth.listFiles();
   * const buffer = await auth.downloadFile(files[0].id);
   * fs.writeFileSync('output.exe', buffer);
   */
  async downloadFile(fileId) {
    if (!this.sessionToken || !fileId) return null;

    const result = await this._request({
      type: 'file',
      fileId,
      sessionToken: this.sessionToken,
    }, FILE_TIMEOUT);

    if (result.binary) return result.binary;

    // Fallback: GET endpoint
    try {
      const baseUrl = this.apiUrl.replace('/v1', '');
      const url = `${baseUrl}/v1/files/download/${fileId}?token=${this.sessionToken}`;
      const response = await fetch(url, {
        headers: { 'X-Session-Token': this.sessionToken },
        signal: AbortSignal.timeout(FILE_TIMEOUT),
      });
      if (response.headers.get('content-type')?.includes('octet-stream')) {
        return Buffer.from(await response.arrayBuffer());
      }
    } catch { /* ignore fallback failure */ }

    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // LOGGING & STATS
  // ═══════════════════════════════════════════════════════════

  /**
   * Send an activity log (visible in seller dashboard).
   * @param {string} message - Log message (max 500 chars)
   * @returns {Promise<boolean>}
   */
  async log(message) {
    const result = await this._request({ type: 'log', message: String(message).slice(0, 500), sessionToken: this.sessionToken });
    return result.success === true;
  }

  /**
   * Get online user count and list.
   * @returns {Promise<{count: number, users: Array}>}
   */
  async fetchOnline() {
    const result = await this._request({ type: 'fetch_online', sessionToken: this.sessionToken });
    return result.success ? (result.data || { count: 0, users: [] }) : { count: 0, users: [] };
  }

  /**
   * Get application statistics.
   * @returns {Promise<{totalUsers: number, onlineUsers: number, totalKeys: number, appVersion: string}>}
   */
  async fetchStats() {
    const result = await this._request({ type: 'fetch_stats', sessionToken: this.sessionToken });
    return result.success ? (result.data || {}) : {};
  }

  // ═══════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════

  /**
   * Check if IP or HWID is blacklisted.
   * @param {string} [ip] - IP to check
   * @param {string} [hwid] - HWID to check
   * @returns {Promise<{blacklisted: boolean, reason: string|null}>}
   */
  async checkBlacklist(ip = null, hwid = null) {
    const data = { type: 'check_blacklist' };
    if (ip) data.ip = ip;
    if (hwid) data.hwid = hwid;
    const result = await this._request(data);
    return result.success ? (result.data || { blacklisted: false }) : { blacklisted: false };
  }

  /**
   * Redeem a referral code for bonus days.
   * @param {string} code - Referral code
   * @returns {Promise<Object>} {success, message, data: {expiresAt, rewardDays}}
   */
  async redeemReferral(code) {
    return this._request({ type: 'redeem_referral', code, sessionToken: this.sessionToken });
  }
}

module.exports = { Authon, AuthonError };
