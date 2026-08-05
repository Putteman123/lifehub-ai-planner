import { auth, defineMcp } from "@lovable.dev/mcp-js";

import addShoppingItems from "./tools/add-shopping-items";
import completeTodo from "./tools/complete-todo";
import createEvent from "./tools/create-event";
import createReminder from "./tools/create-reminder";
import createTodo from "./tools/create-todo";
import listEvents from "./tools/list-events";
import listPlaces from "./tools/list-places";
import listShoppingItems from "./tools/list-shopping-items";
import listTodos from "./tools/list-todos";
import listVisits from "./tools/list-visits";

// OAuth-utfärdaren måste vara den direkta Supabase-värden, inte publiceringsproxyn.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "lifeflow-ai",
  title: "LifeFlow AI",
  version: "0.1.0",
  instructions:
    "Verktyg för LifeHub AI: kalender, Att göra, påminnelser, inköpslista och platslogg. " +
    "Alla anrop sker som den inloggade användaren. Tider anges i ISO 8601. Svara på svenska.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listEvents,
    createEvent,
    listTodos,
    createTodo,
    completeTodo,
    createReminder,
    listShoppingItems,
    addShoppingItems,
    listPlaces,
    listVisits,
  ],
});
