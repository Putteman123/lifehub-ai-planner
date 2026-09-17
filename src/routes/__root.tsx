import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { IntroSplash } from "@/components/IntroSplash";
import { Toaster } from "@/components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

const APPLE_SPLASH: Array<{ w: number; h: number; r: number; file: string }> = [
  { w: 430, h: 932, r: 3, file: "apple-splash-1290x2796.png" },
  { w: 393, h: 852, r: 3, file: "apple-splash-1179x2556.png" },
  { w: 390, h: 844, r: 3, file: "apple-splash-1170x2532.png" },
  { w: 414, h: 896, r: 3, file: "apple-splash-1242x2688.png" },
  { w: 375, h: 812, r: 3, file: "apple-splash-1125x2436.png" },
  { w: 414, h: 736, r: 3, file: "apple-splash-1242x2208.png" },
  { w: 414, h: 896, r: 2, file: "apple-splash-828x1792.png" },
  { w: 375, h: 667, r: 2, file: "apple-splash-750x1334.png" },
  { w: 1024, h: 1366, r: 2, file: "apple-splash-2048x2732.png" },
  { w: 834, h: 1194, r: 2, file: "apple-splash-1668x2388.png" },
  { w: 810, h: 1080, r: 2, file: "apple-splash-1620x2160.png" },
];

const appleSplashLinks = APPLE_SPLASH.flatMap(({ w, h, r, file }) => [
  {
    rel: "apple-touch-startup-image",
    href: `/${file}`,
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
  },
  {
    rel: "apple-touch-startup-image",
    href: `/${file}`,
    media: `(device-width: ${h}px) and (device-height: ${w}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
  },
]);

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover",
      },

      { title: "LifeHub AI" },
      { name: "description", content: "Din personliga AI-assistent för arbete, familj och privatliv" },
      { name: "author", content: "LifeHub" },
      { name: "theme-color", content: "#F6F3EC" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "LifeHub" },
      { name: "application-name", content: "LifeHub" },
      { property: "og:title", content: "LifeHub AI" },
      { property: "og:description", content: "Din personliga AI-assistent för arbete, familj och privatliv" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Figtree:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png", sizes: "64x64" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-167.png", sizes: "167x167" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-152.png", sizes: "152x152" },
      { rel: "manifest", href: "/manifest.json" },
      ...appleSplashLinks,
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => unsub?.();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <IntroSplash />
      <Toaster />
    </QueryClientProvider>
  );
}
