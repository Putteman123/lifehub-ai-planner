import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

const firebaseConfig = {
  apiKey: "DIN_API_NYCKEL", // Ändra till din API-nyckel från Project Settings i Firebase Console
  authDomain: "pm-juridik-applex.firebaseapp.com",
  projectId: "pm-juridik-applex",
  storageBucket: "pm-juridik-applex.appspot.com",
  messagingSenderId: "361480860589",
  appId: "DITT_APP_ID", // Ändra till ditt App ID från Project Settings i Firebase Console
  measurementId: "G-529389007",
};

const app = initializeApp(firebaseConfig);

// Skydda dina Vertex AI-anrop med App Check
if (typeof window !== "undefined") {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider("DIN_RECAPTCHA_SITE_KEY"), // Ändra till din reCAPTCHA Enterprise Site Key
    isTokenAutoRefreshEnabled: true,
  });
}

// Initiera Firebase AI Logic med Google Cloud/Vertex AI som Enterprise-backend
const ai = getAI(app, { backend: new GoogleAIBackend() });

// Andrea drivs av Gemini Enterprise (t.ex. gemini-2.5-pro för högsta kvalitet)
export const andreaModel = getGenerativeModel(ai, {
  model: "gemini-2.5-pro",
  generationConfig: {
    temperature: 0.6,
    maxOutputTokens: 800,
  },
  systemInstruction:
    "Du är röstassistenten Andrea för vår hemtjänstplattform. Svara personligt, tryggt och professionellt på svenska.",
});

export async function askAndrea(userPrompt: string): Promise<string> {
  try {
    const result = await andreaModel.generateContent(userPrompt);
    return result.response.text() || "Inget svar genererades.";
  } catch (error) {
    console.error("Fel vid anrop till Gemini Enterprise (Andrea):", error);
    throw error;
  }
}
