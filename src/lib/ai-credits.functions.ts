import { createServerFn } from "@tanstack/react-start";

import { probeAiCredits, type AiCreditStatus } from "./ai-credits.server";

export const getAiCreditStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AiCreditStatus> => probeAiCredits(),
);
