/**
 * Firebase AI (Andrea) – använder samma Google-nyckel som kartorna.
 * Nyckeln ligger i Project Settings som GOOGLE_MAPS_OWN_KEY och hämtas
 * säkert från servern första gången Andrea används.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, type GenerativeModel } from "firebase/ai";
import { ensureOwnMapsKey } from "@/lib/maps-media";

const FIREBASE_PROJECT_ID = "pm-juridik-applex";
const APP_ID = (import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined) ?? "";
const RECAPTCHA_SITE_KEY =
  (import.meta.env["VITE_FIREBASE_RECAPTCHA_SITE_KEY"] as string | undefined) ?? "";

let modelPromise: Promise<GenerativeModel> | null = null;

async function resolveApiKey(): Promise<string> {
  const fromEnv = import.meta.env["VITE_FIREBASE_API_KEY"] as string | undefined;
  if (fromEnv) return fromEnv;
  const shared = await ensureOwnMapsKey();
  if (!shared) {
    throw new Error(
      "Ingen Google-nyckel hittades. Lägg in din nyckel som GOOGLE_MAPS_OWN_KEY i projektinställningarna.",
    );
  }
  return shared;
}

function createApp(apiKey: string): FirebaseApp {
  const existing = getApps().find((a) => a.name === "andrea");
  if (existing) return existing;
  return initializeApp(
    {
      apiKey,
      authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: FIREBASE_PROJECT_ID,
      storageBucket: `${FIREBASE_PROJECT_ID}.appspot.com`,
      messagingSenderId: "361480860589",
      ...(APP_ID ? { appId: APP_ID } : {}),
      measurementId: "G-529389007",
    },
    "andrea",
  );
}

async function getAndreaModel(): Promise<GenerativeModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const apiKey = await resolveApiKey();
      const app = createApp(apiKey);

      if (typeof window !== "undefined" && RECAPTCHA_SITE_KEY) {
        try {
          initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
            isTokenAutoRefreshEnabled: true,
          });
        } catch {
          // App Check är valfritt – fortsätt utan om det redan är initierat.
        }
      }

      const ai = getAI(app, { backend: new GoogleAIBackend() });
      return getGenerativeModel(ai, {
        model: "gemini-2.5-pro",
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 800,
        },
        systemInstruction:
          "Du är röstassistenten Andrea för vår hemtjänstplattform. Svara personligt, tryggt och professionellt på svenska.",
      });
    })().catch((err) => {
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

export { getAndreaModel };

export async function askAndrea(userPrompt: string): Promise<string> {
  try {
    const model = await getAndreaModel();
    const result = await model.generateContent(userPrompt);
    return result.response.text() || "Inget svar genererades.";
  } catch (error) {
    console.error("Fel vid anrop till Gemini Enterprise (Andrea):", error);
    throw error;
  }
}
