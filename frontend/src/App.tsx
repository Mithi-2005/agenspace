import React from "react";
import BrandLogo from "./components/BrandLogo";
import { AppShell } from "./components/workspace/AppShell";
import { AuthProvider } from "./context/AuthContext";
import { TaskProvider } from "./context/TaskProvider";
import { ToastProvider } from "./context/ToastContext";
import { useAuth } from "./context/useAuth";
import { brandConfig } from "./config/brand";
import { EventsPage } from "./pages/EventsPage";
import { AccountPage } from "./pages/AccountPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { PluginsPage } from "./pages/PluginsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { TasksPage } from "./pages/TasksPage";
import { isWorkspaceRoute, navigateTo } from "./routing/hashRoute";
import { useHashRoute } from "./routing/useHashRoute";
import { ThemeProvider } from "./theme/ThemeProvider";

const Workspace: React.FC = () => {
  const route = useHashRoute();
  const workspaceRoute = isWorkspaceRoute(route) ? route : "dashboard";

  let page: React.ReactNode = <DashboardPage />;
  if (workspaceRoute === "tasks") page = <TasksPage />;
  else if (workspaceRoute === "events") page = <EventsPage />;
  else if (workspaceRoute === "connections") page = <ConnectionsPage />;
  else if (workspaceRoute === "plugins") page = <PluginsPage />;
  else if (workspaceRoute === "account") page = <AccountPage />;

  return <AppShell route={workspaceRoute}>{page}</AppShell>;
};

const Root: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const route = useHashRoute();

  if (isLoading) {
    return (
      <div className="boot-screen">
        <BrandLogo />
        <div className="spinner" aria-hidden="true" />
        <p>Opening {brandConfig.appName}…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (route === "login") {
      return (
        <LoginPage
          onNavigateToRegister={() => {
            navigateTo("register");
          }}
        />
      );
    }
    if (route === "register") {
      return (
        <RegisterPage
          onNavigateToLogin={() => {
            navigateTo("login");
          }}
        />
      );
    }
    if (isWorkspaceRoute(route)) {
      return (
        <LoginPage
          onNavigateToRegister={() => {
            navigateTo("register");
          }}
        />
      );
    }
    return <LandingPage />;
  }

  return (
    <TaskProvider>
      <Workspace />
    </TaskProvider>
  );
};

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
