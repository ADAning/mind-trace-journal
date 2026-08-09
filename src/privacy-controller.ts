import { DEFAULT_SETTINGS } from "./defaults";
import {
  PASSWORD_KDF_ITERATIONS,
  PRIVACY_UNLOCK_DURATION_MS,
  base64ToBytes,
  bytesToBase64,
  constantTimeEqual,
  derivePasswordVerifier
} from "./privacy";

export class PrivacyController {
  private unlockedUntil = 0;
  private timer: number | null = null;

  constructor(private readonly host: any) {}

  dispose() {
    this.clearTimer();
    this.unlockedUntil = 0;
  }

  isPasswordConfigured() {
    const security = this.host.settings.security;
    return typeof security?.salt === "string" && security.salt.length > 0 && typeof security.verifier === "string" && security.verifier.length > 0;
  }

  isGateEnabled() {
    return this.host.settings.security?.enabled !== false;
  }

  isUnlocked() {
    if (!this.isGateEnabled()) return true;
    if (this.unlockedUntil <= Date.now()) {
      this.unlockedUntil = 0;
      return false;
    }
    return true;
  }

  async verifyPassword(password: string) {
    if (!this.isPasswordConfigured()) return false;
    const security = this.host.settings.security;
    try {
      const verifier = await derivePasswordVerifier(password, base64ToBytes(security.salt), security.iterations);
      return constantTimeEqual(verifier, security.verifier);
    } catch {
      return false;
    }
  }

  async configurePassword(password: string) {
    if (password.length < 8) throw new Error("密码至少需要 8 个字符");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const verifier = await derivePasswordVerifier(password, salt, PASSWORD_KDF_ITERATIONS);
    this.host.settings.security = {
      version: 1,
      salt: bytesToBase64(salt),
      verifier,
      iterations: PASSWORD_KDF_ITERATIONS,
      enabled: true
    };
    await this.host.persist();
    this.activateUnlock();
  }

  async skipSetup() {
    this.host.settings.security = {
      ...structuredClone(DEFAULT_SETTINGS.security),
      ...this.host.settings.security,
      enabled: false
    };
    this.clearTimer();
    await this.host.persist();
    this.host.refreshProtectedViews();
  }

  async unlock(password: string) {
    if (!await this.verifyPassword(password)) throw new Error("密码不正确");
    this.activateUnlock();
  }

  async changePassword(currentPassword: string, newPassword: string) {
    if (!this.isUnlocked() && !await this.verifyPassword(currentPassword)) throw new Error("当前密码不正确");
    await this.configurePassword(newPassword);
  }

  async removePassword(currentPassword: string) {
    if (!this.isUnlocked() && !await this.verifyPassword(currentPassword)) throw new Error("当前密码不正确");
    const resetSecurity = structuredClone(DEFAULT_SETTINGS.security);
    resetSecurity.enabled = false;
    this.host.settings.security = resetSecurity;
    this.unlockedUntil = 0;
    this.host.historyIndex.clear();
    this.clearTimer();
    await this.host.persist();
    this.host.refreshProtectedViews();
    void this.host.closeProtectedSources();
  }

  activateUnlock() {
    this.unlockedUntil = Date.now() + PRIVACY_UNLOCK_DURATION_MS;
    this.clearTimer();
    this.timer = this.host.ownerWindow.setTimeout(() => this.lock(false), PRIVACY_UNLOCK_DURATION_MS);
    this.host.refreshProtectedViews();
  }

  lock(showNotice = false) {
    this.unlockedUntil = 0;
    this.host.historyIndex.clear();
    this.clearTimer();
    this.host.handlePrivacyLock(showNotice);
  }

  private clearTimer() {
    if (this.timer === null) return;
    this.host.ownerWindow.clearTimeout(this.timer);
    this.timer = null;
  }
}
