/**
 * Snabblåset: när du väl loggat in med ditt konto räcker pinkod/Face ID för att
 * öppna appen. Upplåsningen gäller i den här webbläsaren i 12 timmar.
 */
const KEY = "lifehub.unlocked";
const TTL_MS = 12 * 60 * 60 * 1000;

export function markUnlocked() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(Date.now()));
}

export function isUnlocked() {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < TTL_MS;
}

export function clearUnlock() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
