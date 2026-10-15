export type PublicRoute = "landing" | "login" | "register";
export type WorkspaceRoute = "dashboard" | "tasks" | "events" | "connections" | "plugins" | "account";
export type AppRoute = PublicRoute | WorkspaceRoute;

const PUBLIC_ROUTES: PublicRoute[] = ["landing", "login", "register"];
const WORKSPACE_ROUTES: WorkspaceRoute[] = ["dashboard", "tasks", "events", "connections", "plugins", "account"];

export function parseHashRoute(hash: string): AppRoute {
  const value = hash.replace(/^#/, "").split("?")[0].toLowerCase();

  if (value === "login") return "login";
  if (value === "register") return "register";
  if (value === "tasks" || value === "myday") return "tasks";
  if (value === "events" || value === "calendar") return "events";
  if (value === "connections") return "connections";
  if (value === "plugins" || value === "marketplace" || value === "integrations") return "plugins";
  if (value === "account") return "account";
  if (value === "dashboard" || value === "overview") return "dashboard";
  if (value === "landing" || value === "home" || value === "") return "landing";
  return "landing";
}

export function isPublicRoute(route: AppRoute): route is PublicRoute {
  return PUBLIC_ROUTES.includes(route as PublicRoute);
}

export function isWorkspaceRoute(route: AppRoute): route is WorkspaceRoute {
  return WORKSPACE_ROUTES.includes(route as WorkspaceRoute);
}

export function routeToHash(route: AppRoute): string {
  if (route === "landing") return "#";
  return `#${route}`;
}

export function navigateTo(route: AppRoute): void {
  const next = routeToHash(route);
  if (window.location.hash === next || (route === "landing" && window.location.hash === "")) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = next === "#" ? "" : next;
}
