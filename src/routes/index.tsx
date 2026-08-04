import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LifeHub AI – din personliga planering" },
      {
        name: "description",
        content:
          "Jobb, juristuppdrag, barnens aktiviteter och privatliv i en intelligent kalender med AI-hjälp.",
      },
      { property: "og:title", content: "LifeHub AI" },
      {
        property: "og:description",
        content: "En intelligent kalender som samlar allt och planerar din tid med AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
