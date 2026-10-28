import React, { lazy, Suspense, useEffect } from "react";
import BrandLogo from "./components/BrandLogo";
import { AppShell } from "./components/workspace/AppShell";
import { WorkspacePageSkeleton } from "./components/workspace/WorkspacePageSkeleton";
import { AuthProvider } from "./context/AuthContext";
import { TaskProvider } from "./context/TaskProvider";
import { ToastProvider } from "./context/ToastContext";
import { useAuth } from "./context/useAuth";
import { brandConfig } from "./config/brand";
import { AccountPage } from "./pages/AccountPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import {
  isWorkspaceRoute,
  navigateTo,
  type WorkspaceRoute,
} from "./routing/hashRoute";
import { useHashRoute } from "./routing/useHashRoute";
import { ThemeProvider } from "./theme/ThemeProvider";

const Overview = lazy(() => import("./pages/workspace/OverviewPage"));
const Activity = lazy(() => import("./pages/workspace/ActivityPage"));
const Tasks = lazy(() => import("./pages/workspace/TasksPage"));
const Manage = lazy(async () => ({
  default: (await import("./pages/workspace/IntegrationPages")).ManagePage,
}));
const Marketplace = lazy(async () => ({
  default: (await import("./pages/workspace/IntegrationPages")).MarketplacePage,
}));
const Schedule = lazy(async () => ({
  default: (await import("./pages/workspace/IntegrationPages")).SchedulePage,
}));
const Inbox = lazy(async () => ({
  default: (await import("./pages/workspace/IntegrationPages")).InboxPage,
}));
const Automations = lazy(async () => ({
  default: (await import("./pages/workspace/PlanningPages")).AutomationsPage,
}));
const Insights = lazy(async () => ({
  default: (await import("./pages/workspace/PlanningPages")).InsightsPage,
}));
const Moon = lazy(async () => ({
  default: (await import("./pages/workspace/PlanningPages")).MoonPage,
}));
const Settings = lazy(async () => ({
  default: (await import("./pages/workspace/PlanningPages")).SettingsPage,
}));
const NotFound = lazy(async () => ({
  default: (await import("./pages/workspace/PlanningPages")).NotFoundPage,
}));

const labels: Record<WorkspaceRoute, string> = {
  overview: "Overview",
  activity: "Activity",
  manage: "Manage",
  automations: "Automations",
  account: "Account",
  insights: "Insights",
  schedule: "Schedule",
  inbox: "Inbox",
  tasks: "Tasks",
  moon: brandConfig.assistantName,
  marketplace: "Marketplace",
  settings: "Settings",
  "not-found": "Not found",
};
function Workspace() {
  const route = useHashRoute();
  const workspaceRoute: WorkspaceRoute = isWorkspaceRoute(route)
    ? route
    : "overview";
  useEffect(() => {
    document.title = `${labels[workspaceRoute]} · ${brandConfig.appName}`;
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute("content", "noindex, nofollow");
  }, [workspaceRoute]);
  const pages: Record<WorkspaceRoute, React.ReactNode> = {
    overview: <Overview />,
    activity: <Activity />,
    manage: <Manage />,
    automations: <Automations />,
    account: <AccountPage />,
    insights: <Insights />,
    schedule: <Schedule />,
    inbox: <Inbox />,
    tasks: <Tasks />,
    moon: <Moon />,
    marketplace: <Marketplace />,
    settings: <Settings />,
    "not-found": <NotFound />,
  };
  return (
    <AppShell route={workspaceRoute}>
      <Suspense fallback={<WorkspacePageSkeleton route={workspaceRoute} />}>
        {pages[workspaceRoute]}
      </Suspense>
    </AppShell>
  );
}
function Root() {
  const { isAuthenticated, isLoading } = useAuth();
  const route = useHashRoute();
  useEffect(() => {
    if (!isAuthenticated)
      document.title =
        route === "landing"
          ? brandConfig.appName
          : `Sign in · ${brandConfig.appName}`;
  }, [route, isAuthenticated]);
  useEffect(() => {
    if (isAuthenticated && !isWorkspaceRoute(route)) navigateTo("overview");
  }, [isAuthenticated, route]);
  if (isLoading)
    return (
      <div className="boot-screen">
        <BrandLogo />
        <div className="spinner" aria-hidden="true" />
        <p>Opening {brandConfig.appName}…</p>
      </div>
    );
  if (!isAuthenticated) {
    if (route === "register")
      return <RegisterPage onNavigateToLogin={() => navigateTo("login")} />;
    if (route === "login" || isWorkspaceRoute(route))
      return <LoginPage onNavigateToRegister={() => navigateTo("register")} />;
    return <LandingPage />;
  }
  if (!isWorkspaceRoute(route)) return null;
  return (
    <TaskProvider>
      <Workspace />
    </TaskProvider>
  );
}
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
