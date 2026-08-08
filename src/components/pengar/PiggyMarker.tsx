import { PiggyBank } from "lucide-react";

import { kr } from "@/lib/finance";

/**
 * Liten spargris som visar dagsresultatet: grön med plus när du sparat,
 * röd med minus när du spenderat mer än dagsbudgeten.
 */
export function PiggyMarker({
  amount,
  size = "sm",
}: {
  amount: number | null;
  size?: "sm" | "md";
}) {
  if (amount === null || !Number.isFinite(amount)) return null;
  const rounded = Math.round(amount);
  const positive = rounded >= 0;
  const label = `${positive ? "+" : "−"}${kr(Math.abs(rounded)).replace("−", "")}`;

  return (
    <span
      title={positive ? "Sparat den här dagen" : "Över dagsbudgeten"}
      className={`inline-flex items-center gap-1 rounded-full font-medium tabular-nums ${
        size === "md" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]"
      } ${
        positive
          ? "bg-cat-ledig/15 text-cat-ledig"
          : "bg-destructive/12 text-destructive"
      }`}
    >
      <PiggyBank className={size === "md" ? "size-4" : "size-3"} />
      {label}
    </span>
  );
}
