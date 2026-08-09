// src/privacy.ts
import { mindTraceWindow } from "./runtime-preamble";

export { PASSWORD_KDF_ITERATIONS, PRIVACY_UNLOCK_DURATION_MS, base64ToBytes, bytesToBase64, constantTimeEqual, derivePasswordVerifier, renderPrivacyGate };
var PRIVACY_UNLOCK_DURATION_MS = 2 * 60 * 60 * 1e3;
var PASSWORD_KDF_ITERATIONS = 21e4;
function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function derivePasswordVerifier(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations
    },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}
function constantTimeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
function renderPrivacyGate(container, plugin) {
  if (!plugin.isPrivacyGateEnabled() || plugin.isPrivacyUnlocked()) {
    container.removeClass("mind-trace-locked-view");
    return false;
  }
  container.empty();
  container.addClass("mind-trace-view", "mind-trace-locked-view");
  const shell = container.createDiv({ cls: "mind-trace-lock-shell" });
  shell.createDiv({ cls: "mind-trace-empty-mark", text: "私密" });
  const configured = plugin.isPasswordConfigured();
  shell.createDiv({
    cls: "mind-trace-lock-title",
    text: configured ? "解锁心迹" : "设置心迹密码（可选）",
    attr: { role: "heading", "aria-level": "2" }
  });
  shell.createEl("p", {
    text: configured ? "解锁后两小时内，可以记录、阅读、查看成长看板、导出和编辑日记。" : "密码至少 8 个字符。心迹会保存加盐验证值，不会保存明文密码；也可以暂不设置，直接进入。"
  });
  const form = shell.createEl("form", { cls: "mind-trace-lock-form" });
  const password = form.createEl("input", {
    attr: {
      type: "password",
      placeholder: configured ? "输入心迹密码" : "设置心迹密码",
      autocomplete: configured ? "current-password" : "new-password",
      "aria-label": configured ? "心迹密码" : "设置心迹密码"
    }
  });
  let confirmation = null;
  if (!configured) {
    confirmation = form.createEl("input", {
      attr: {
        type: "password",
        placeholder: "再次输入密码",
        autocomplete: "new-password",
        "aria-label": "确认心迹密码"
      }
    });
  }
  const error = form.createEl("p", {
    cls: "mind-trace-lock-error",
    attr: { role: "alert", "aria-live": "polite" }
  });
  const submit = form.createEl("button", {
    cls: "mod-cta",
    text: configured ? "解锁两小时" : "设置并解锁",
    attr: { type: "submit" }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (submit.disabled) {
      return;
    }
    error.textContent = "";
    const value = password.value;
    if (value.length < 8) {
      error.textContent = "密码至少需要 8 个字符";
      password.focus();
      return;
    }
    if (confirmation !== null && value !== confirmation.value) {
      error.textContent = "两次输入的密码不一致";
      confirmation.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = configured ? "正在解锁…" : "正在设置…";
    void (configured ? plugin.unlockPrivacy(value) : plugin.configurePrivacyPassword(value)).catch((reason) => {
      error.textContent = reason instanceof Error ? reason.message : "无法解锁心迹";
      password.select();
    }).finally(() => {
      submit.disabled = false;
      submit.textContent = configured ? "解锁两小时" : "设置并解锁";
    });
  });
  if (!configured) {
    const skip = shell.createEl("button", {
      cls: "mind-trace-lock-skip",
      text: "暂不设置，直接进入",
      attr: { type: "button" }
    });
    skip.addEventListener("click", () => {
      if (skip.disabled) {
        return;
      }
      error.textContent = "";
      skip.disabled = true;
      void plugin.skipPrivacySetup().catch((reason) => {
        error.textContent = reason instanceof Error ? reason.message : "无法进入心迹";
        skip.disabled = false;
      });
    });
  }
  mindTraceWindow(container).requestAnimationFrame(() => password.focus());
  return true;
}
