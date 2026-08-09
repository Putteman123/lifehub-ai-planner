import { createFileRoute } from "@tanstack/react-router";
import {
  searchCases,
  searchClients,
  upcomingDeadlines,
} from "@/lib/apples.server";

export const Route = createFileRoute("/api/apples-test")({
  server: {
    handlers: {
      GET: async () => {
        const [cases, clients, deadlines] = await Promise.all([
          searchCases(""),
          searchClients(""),
          upcomingDeadlines(30),
        ]);
        return Response.json({ cases, clients, deadlines });
      },
    },
  },
});
