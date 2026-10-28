export type PublicRoute = "landing" | "login" | "register";
export type WorkspaceRoute =
  | "overview" | "activity" | "manage" | "automations" | "account" | "insights"
  | "schedule" | "inbox" | "tasks" | "moon" | "marketplace" | "settings" | "not-found";
type LegacyWorkspaceRoute = "dashboard" | "events" | "connections" | "plugins";
export type AppRoute = PublicRoute | WorkspaceRoute | LegacyWorkspaceRoute;

const PUBLIC_ROUTES: PublicRoute[] = ["landing", "login", "register"];
const WORKSPACE_ROUTES: WorkspaceRoute[] = [
  "overview", "activity", "manage", "automations", "account", "insights", "schedule", "inbox", "tasks", "moon", "marketplace", "settings", "not-found",
];

export function parseHashRoute(hash: string): AppRoute {
  const value = hash.replace(/^#/, "").split("?")[0].toLowerCase();
  if (value === "" || value === "landing" || value === "home") return "landing";
  if (value === "login" || value === "register") return value;
  if (value === "settings" || value.startsWith("settings/")) return "settings";
  const aliases: Record<string, WorkspaceRoute> = {
    dashboard: "overview", overview: "overview", activity: "activity", manage: "manage", automations: "automations",
    account: "account", insights: "insights", schedule: "schedule", events: "schedule", calendar: "schedule",
    inbox: "inbox", connections: "manage", tasks: "tasks", myday: "tasks", moon: "moon",
    marketplace: "marketplace", plugins: "marketplace", integrations: "marketplace",
  };
  return aliases[value] ?? "not-found";
}

export function isPublicRoute(route: AppRoute): route is PublicRoute { return PUBLIC_ROUTES.includes(route as PublicRoute); }
export function isWorkspaceRoute(route: AppRoute): route is WorkspaceRoute { return WORKSPACE_ROUTES.includes(route as WorkspaceRoute); }
export function routeToHash(route: AppRoute): string { return route === "landing" ? "#" : `#${route}`; }
export function navigateTo(route: AppRoute): void {
  const next = routeToHash(route);
  if (window.location.hash === next || (route === "landing" && window.location.hash === "")) {
    window.dispatchEvent(new HashChangeEvent("hashchange")); return;
  }
  window.location.hash = next === "#" ? "" : next;
}
