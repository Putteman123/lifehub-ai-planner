/**
 * Lätt haptisk feedback.
 *
 * - Android/Chrome: navigator.vibrate.
 * - iOS (Safari 17.4+): saknar vibrate, men en dold <input type="checkbox" switch>
 *   ger en systemhaptik när den växlas via en label-klick.
 */
let switchLabel: HTMLLabelElement | null = null;

function ensureIosSwitch(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (switchLabel?.isConnected) return switchLabel;

  const input = document.createElement("input");
  input.type = "checkbox";
  // `switch` är ett iOS-specifikt attribut; okänt i andra webbläsare och därmed ofarligt.
  input.setAttribute("switch", "");
  input.id = "haptic-switch";
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;

  const label = document.createElement("label");
  label.htmlFor = input.id;
  label.setAttribute("aria-hidden", "true");

  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);pointer-events:none;opacity:0;";
  wrap.append(input, label);
  document.body.append(wrap);

  switchLabel = label;
  return label;
}

/** Kort vibration vid t.ex. flikbyte. Tyst no-op där stöd saknas. */
export function hapticTick(duration = 8) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const nav = window.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate === "function") {
    try {
      if (nav.vibrate(duration)) return;
    } catch {
      /* ignorera */
    }
  }

  try {
    ensureIosSwitch()?.click();
  } catch {
    /* ignorera */
  }
}
