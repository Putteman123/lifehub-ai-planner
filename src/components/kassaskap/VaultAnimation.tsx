import { cn } from "@/lib/utils";

export type VaultState = "stangd" | "oppnar" | "oppen" | "fel";

/**
 * Animerat kassaskåp i ren CSS (samma formspråk som Lexentia).
 * Dörren svänger upp när skåpet låses upp, ratten snurrar och lampan blir grön.
 */
export function VaultAnimation({
  state,
  size = 200,
  className,
}: {
  state: VaultState;
  size?: number;
  className?: string;
}) {
  const open = state === "oppen" || state === "oppnar";

  return (
    <div
      className={cn("relative mx-auto select-none", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <style>{`
        @keyframes kv-dial-spin { from { transform: rotate(0deg); } to { transform: rotate(400deg); } }
        @keyframes kv-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-7px); }
          40% { transform: translateX(7px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes kv-shine { 0%, 60% { opacity: 0; } 75% { opacity: 1; } 100% { opacity: 0; } }
        .kv-spin .kv-dial { animation: kv-dial-spin 1.1s cubic-bezier(.4,0,.2,1) 1 forwards; }
        .kv-error { animation: kv-shake 0.4s ease-in-out 1; }
        .kv-open .kv-shine { animation: kv-shine 1.2s ease-out 1 forwards; }
        .kv-door { transition: transform 900ms cubic-bezier(.5,.05,.2,1); }
        @media (prefers-reduced-motion: reduce) {
          .kv-spin .kv-dial, .kv-error, .kv-open .kv-shine { animation: none !important; }
          .kv-door { transition: none; }
        }
      `}</style>

      <div
        className={cn(
          "relative h-full w-full",
          state === "oppnar" && "kv-spin",
          state === "fel" && "kv-error",
          open && "kv-open",
        )}
      >
        {/* Skåpets stomme */}
        <div className="absolute inset-[6%] rounded-[10%] bg-gradient-to-br from-[oklch(0.34_0.02_265)] to-[oklch(0.22_0.02_265)] shadow-[inset_0_4px_12px_oklch(0_0_0/0.4),0_20px_40px_-20px_oklch(0_0_0/0.45)]">
          {/* Skåpets inre */}
          <div className="absolute inset-[8%] overflow-hidden rounded-[6%] bg-gradient-to-br from-[oklch(0.18_0.02_265)] to-[oklch(0.11_0.02_265)] shadow-[inset_0_2px_10px_oklch(0_0_0/0.65)]">
            <div className="absolute inset-x-[12%] top-[22%] h-[8%] rounded bg-[oklch(0.3_0.02_265)]" />
            <div className="absolute inset-x-[12%] top-[42%] h-[8%] rounded bg-[oklch(0.27_0.02_265)]" />
            <div className="absolute inset-x-[12%] top-[62%] h-[8%] rounded bg-[oklch(0.24_0.02_265)]" />
          </div>

          {/* Gångjärn */}
          <div className="absolute left-[2%] top-[18%] h-[10%] w-[4%] rounded-sm bg-[oklch(0.5_0.01_265)]" />
          <div className="absolute bottom-[18%] left-[2%] h-[10%] w-[4%] rounded-sm bg-[oklch(0.5_0.01_265)]" />

          {/* Dörren */}
          <div
            className="kv-door absolute inset-[6%] rounded-[6%] bg-gradient-to-br from-[oklch(0.4_0.02_265)] to-[oklch(0.26_0.02_265)] shadow-[inset_0_2px_6px_oklch(1_0_0/0.08),0_10px_20px_-12px_oklch(0_0_0/0.6)]"
            style={{
              transformOrigin: "left center",
              backfaceVisibility: "hidden",
              transform: open
                ? "perspective(700px) rotateY(-102deg)"
                : "perspective(700px) rotateY(0deg)",
            }}
          >
            <div className="absolute inset-[8%] rounded-[6%] border border-[oklch(1_0_0/0.07)]" />

            {/* Ratt */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative grid size-[27%] min-h-[52px] min-w-[52px] place-items-center rounded-full bg-gradient-to-br from-[oklch(0.8_0.05_80)] to-[oklch(0.6_0.07_75)] shadow-[0_4px_10px_oklch(0_0_0/0.5),inset_0_2px_3px_oklch(1_0_0/0.4)]">
                <div className="kv-dial absolute inset-0 grid place-items-center">
                  <div className="h-[80%] w-[6px] rounded-full bg-[oklch(0.35_0.03_75)]" />
                  <div className="absolute h-[6px] w-[80%] rounded-full bg-[oklch(0.35_0.03_75)]" />
                </div>
                <div className="absolute size-[14px] rounded-full bg-[oklch(0.25_0.02_75)] shadow-[inset_0_2px_2px_oklch(0_0_0/0.6)]" />
              </div>
            </div>

            {/* Lampa */}
            <div className="absolute right-[12%] top-[12%] flex items-center gap-1.5">
              <span
                className="size-2 rounded-full transition-all"
                style={{
                  background:
                    state === "fel"
                      ? "oklch(0.62 0.22 25)"
                      : open
                        ? "oklch(0.72 0.18 150)"
                        : "oklch(0.55 0.02 265)",
                  boxShadow:
                    state === "fel"
                      ? "0 0 10px oklch(0.62 0.22 25 / 0.8)"
                      : open
                        ? "0 0 12px oklch(0.72 0.18 150 / 0.75)"
                        : "none",
                }}
              />
              <span className="text-[8px] font-semibold uppercase tracking-widest text-[oklch(0.72_0.02_265)]">
                {state === "fel" ? "Fel" : open ? "Öppet" : "Låst"}
              </span>
            </div>

            {/* Skenglans */}
            <div
              className="kv-shine pointer-events-none absolute inset-0 rounded-[6%] opacity-0"
              style={{
                background:
                  "linear-gradient(120deg, transparent 30%, oklch(1 0 0 / 0.2) 50%, transparent 70%)",
              }}
            />
          </div>
        </div>

        {/* Skugga */}
        <div className="absolute bottom-[2%] left-[14%] right-[14%] h-[3%] rounded-full bg-[oklch(0_0_0/0.28)] blur-sm" />
      </div>
    </div>
  );
}
