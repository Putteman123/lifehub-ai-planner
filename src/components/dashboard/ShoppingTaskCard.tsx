import { Link } from "@tanstack/react-router";
import { ListTodo, ShoppingCart } from "lucide-react";

import { SectionCard } from "@/components/SectionCard";
import { useActiveList, useShoppingItems } from "@/lib/shopping";
import { useTodos } from "@/lib/db";
import { sortTodos, dueLabel } from "@/lib/todos";

/** Antal ostreckade varor i den aktiva listan. */
function useOpenShopping() {
  const listQ = useActiveList();
  const itemsQ = useShoppingItems(listQ.data?.id);
  const items = itemsQ.data ?? [];
  return {
    open: items.filter((i) => !i.is_checked),
    total: items.length,
  };
}

/** Klickbart kort på startsidan som öppnar inköpslistan. */
export function ShoppingTaskCard() {
  const { open, total } = useOpenShopping();
  if (total === 0) return null;

  return (
    <SectionCard
      title="Handla"
      icon={ShoppingCart}
      accent="text-nav-handla"
      tint="bg-nav-handla/12"
      count={open.length}
      className="transition-shadow hover:shadow-lg"
    >
      <Link to="/handla" className="block">
        <p className="text-sm text-muted-foreground">
          {open.length ? `${open.length} varor kvar att handla` : "Allt är nedplockat"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {open.slice(0, 6).map((item) => (
            <span
              key={item.id}
              className="rounded-full bg-nav-handla/10 px-3 py-1 text-sm font-medium text-nav-handla"
            >
              {item.name}
            </span>
          ))}
          {open.length > 6 ? (
            <span className="rounded-full bg-surface px-3 py-1 text-sm text-muted-foreground">
              +{open.length - 6}
            </span>
          ) : null}
        </div>
        <span className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-nav-handla">
          Öppna listan →
        </span>
      </Link>
    </SectionCard>
  );
}

/** Uppgifter, med den aktiva inköpslistan som en rad utan datum. */
export function TodoListCard() {
  const todosQ = useTodos();
  const todos = sortTodos((todosQ.data ?? []).filter((t) => !t.is_done)).slice(0, 5);
  const { open, total } = useOpenShopping();
  const shoppingRow = total > 0;

  return (
    <SectionCard
      title="Att göra"
      icon={ListTodo}
      accent="text-nav-attgora"
      tint="bg-nav-attgora/12"
      count={todos.length + (shoppingRow ? 1 : 0)}
      collapsible
    >
      <ul className="space-y-2">
        {shoppingRow ? (
          <li>
            <Link
              to="/handla"
              className="flex min-h-11 items-center gap-3 rounded-xl bg-nav-handla/8 px-3 py-2.5 transition-colors hover:bg-nav-handla/15"
            >
              <ShoppingCart className="size-4 shrink-0 text-nav-handla" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">Handla</span>
              <span className="shrink-0 text-xs text-muted-foreground">{open.length} varor</span>
            </Link>
          </li>
        ) : null}
        {todos.length === 0 && !shoppingRow ? (
          <li className="text-sm text-muted-foreground">Inga uppgifter just nu.</li>
        ) : null}
        {todos.map((t) => (
          <li key={t.id}>
            <Link
              to="/attgora"
              className="flex min-h-11 items-center gap-3 rounded-xl bg-surface px-3 py-2.5 transition-colors hover:bg-accent"
            >
              <span className="size-2 shrink-0 rounded-full bg-nav-attgora" />
              <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
              {t.due_date ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {dueLabel(t.due_date)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
