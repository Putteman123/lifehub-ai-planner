import { createFileRoute, Outlet } from "@tanstack/react-router";

import { CareFooter, CareHeader } from "@/components/care/CareChrome";

export const Route = createFileRoute("/vard")({
  component: CareLayout,
});

function CareLayout() {
  return (
    <div className="care-theme min-h-screen font-sans antialiased">
      <CareHeader />
      <main>
        <Outlet />
      </main>
      <CareFooter />
    </div>
  );
}
