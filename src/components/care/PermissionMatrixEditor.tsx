import { Checkbox } from "@/components/ui/checkbox";
import {
  CARE_MODULES,
  MATRIX_ROLES,
  MATRIX_ROLE_LABELS,
  PERMISSION_TEMPLATES,
  lockReason,
  lockedCell,
  type PermissionMatrix,
} from "@/lib/care";

type Props = {
  matrix: PermissionMatrix;
  onChange: (next: PermissionMatrix) => void;
  disabled?: boolean;
};

/** Kryssrutematris: vad varje roll får se och ändra, modul för modul. */
export function PermissionMatrixEditor({ matrix, onChange, disabled }: Props) {
  const setCell = (role: string, module: string, patch: { can_view?: boolean; can_edit?: boolean }) => {
    if (lockedCell(role, module)) return;
    const current = matrix[role]?.[module] ?? { can_view: false, can_edit: false };
    const next = { ...current, ...patch };
    if (next.can_edit) next.can_view = true;
    if (!next.can_view) next.can_edit = false;
    onChange({ ...matrix, [role]: { ...(matrix[role] ?? {}), [module]: next } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs text-muted-foreground">Börja från mall:</span>
        {PERMISSION_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={disabled}
            title={t.hint}
            onClick={() => onChange(structuredClone(t.matrix))}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/70">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="bg-secondary/60">
              <th className="p-3 text-left font-medium">Modul</th>
              {MATRIX_ROLES.map((r) => (
                <th key={r} className="p-3 text-center font-medium">
                  {MATRIX_ROLE_LABELS[r]}
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    se / ändra
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CARE_MODULES.map((m) => (
              <tr key={m.key} className="border-t border-border/60">
                <td className="p-3 align-top">
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.hint}</span>
                </td>
                {MATRIX_ROLES.map((role) => {
                  const cell = matrix[role]?.[m.key] ?? { can_view: false, can_edit: false };
                  const locked = lockedCell(role, m.key) !== null;
                  const reason = lockReason(role, m.key);
                  return (
                    <td key={role} className="p-3 text-center" title={reason ?? undefined}>
                      <div className="flex items-center justify-center gap-3">
                        <Checkbox
                          aria-label={`${MATRIX_ROLE_LABELS[role]} ser ${m.label}`}
                          checked={cell.can_view}
                          disabled={disabled || locked}
                          onCheckedChange={(v) => setCell(role, m.key, { can_view: v === true })}
                        />
                        <Checkbox
                          aria-label={`${MATRIX_ROLE_LABELS[role]} ändrar ${m.label}`}
                          checked={cell.can_edit}
                          disabled={disabled || locked || !cell.can_view}
                          onCheckedChange={(v) => setCell(role, m.key, { can_edit: v === true })}
                        />
                      </div>
                      {locked ? (
                        <span className="mt-1 block text-[10px] text-muted-foreground">låst</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Ekonomi är alltid stängd för vårdföretag och personal, brukaren ser alltid sina egna
        uppgifter, och anhörig ser bara det brukaren gett samtycke till.
      </p>
    </div>
  );
}

export function matrixToRows(matrix: PermissionMatrix) {
  const rows: { role: string; module: string; can_view: boolean; can_edit: boolean }[] = [];
  for (const role of MATRIX_ROLES) {
    for (const m of CARE_MODULES) {
      const cell = matrix[role]?.[m.key];
      if (cell?.can_view || cell?.can_edit) {
        rows.push({ role, module: m.key, can_view: cell.can_view, can_edit: cell.can_edit });
      }
    }
  }
  return rows;
}

export function rowsToMatrix(
  rows: { role: string; module: string; can_view: boolean; can_edit: boolean }[],
  base: PermissionMatrix,
): PermissionMatrix {
  const next = structuredClone(base);
  for (const r of rows) {
    if (!next[r.role]) next[r.role] = {};
    next[r.role]![r.module] = { can_view: r.can_view, can_edit: r.can_edit };
  }
  return next;
}
