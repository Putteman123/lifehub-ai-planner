import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { IptvUserList } from "@/components/iptv/IptvUserList";

export const Route = createFileRoute("/_authenticated/iptv")({
  head: () => ({
    meta: [
      { title: "IPTV – LifeHub AI" },
      {
        name: "description",
        content:
          "Användarlista för IPTV-panelen: skapa M3U-konton, se status, utgångsdatum och anteckningar.",
      },
      { property: "og:title", content: "IPTV – LifeHub AI" },
      {
        property: "og:description",
        content: "Hantera alla IPTV-användare, förnyelser och utgångsdatum på ett ställe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IptvPage,
});

function IptvPage() {
  return (
    <AppShell title="IPTV" subtitle="Användare, förnyelser och utgångsdatum">
      <IptvUserList />
    </AppShell>
  );
}
