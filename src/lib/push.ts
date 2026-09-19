/**
 * Registrerar webbläsaren för riktiga pushnotiser via Firebase Cloud Messaging.
 * Nycklarna kommer från Firebase-kopplingen i projektinställningarna.
 */
const appId = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] as
  | string
  | undefined;
const vapidKey = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] as
  | string
  | undefined;

const firebaseConfig = {
  apiKey: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] as
    | string
    | undefined,
  projectId: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] as
    | string
    | undefined,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushStatus =
  | "registered"
  | "not-configured"
  | "unsupported"
  | "open-in-new-tab"
  | "install-on-home-screen"
  | "denied";

export type PushResult = { status: PushStatus; token?: string };

export function pushIsConfigured() {
  return Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && appId && vapidKey && firebaseConfig.messagingSenderId,
  );
}

/** Webbläsarens nuvarande läge utan att fråga användaren. */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function isIosStandalone() {
  if (typeof window === "undefined") return true;
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (!isIos) return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Måste anropas från ett klick – webbläsare ignorerar frågan annars. */
export async function enablePush(): Promise<PushResult> {
  if (!pushIsConfigured()) return { status: "not-configured" };
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return { status: "unsupported" };
  }

  const { isSupported, getMessaging, getToken } = await import("firebase/messaging");
  if (!(await isSupported())) return { status: "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };
  if (!isIosStandalone()) return { status: "install-on-home-screen" };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const { initializeApp, getApps } = await import("firebase/app");
  const existing = getApps().find((a) => a.name === "push");
  const app = existing ?? initializeApp(firebaseConfig as Record<string, string>, "push");

  const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${query}`,
  );

  const token = await getToken(getMessaging(app), {
    vapidKey: vapidKey!,
    serviceWorkerRegistration,
  });
  return token ? { status: "registered", token } : { status: "denied" };
}

export function pushPlatform() {
  if (typeof window === "undefined") return "web";
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "web";
}
