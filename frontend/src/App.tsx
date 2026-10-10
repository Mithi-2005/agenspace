import React, { useEffect, useState } from "react";
import BrandLogo from "./components/BrandLogo";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/useAuth";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AccountPage } from "./pages/AccountPage";
import { brandConfig } from "./config/brand";

type PublicRoute = "login" | "register";
type AuthenticatedRoute = "dashboard" | "account";

const AuthenticatedApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [publicRoute, setPublicRoute] = useState<PublicRoute>("login");
  const [authRoute, setAuthRoute] = useState<AuthenticatedRoute>("dashboard");

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#register") {
        setPublicRoute("register");
      } else if (hash === "#login") {
        setPublicRoute("login");
      } else if (hash === "#account") {
        setAuthRoute("account");
      } else {
        setAuthRoute("dashboard");
      }
    };

    window.addEventListener("hashchange", handleHash);
    handleHash();
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-card">
          <BrandLogo />
          <div className="spinner" />
          <p>Connecting to {brandConfig.appName}...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (publicRoute === "register") {
      return (
        <RegisterPage
          onNavigateToLogin={() => {
            window.location.hash = "#login";
            setPublicRoute("login");
          }}
        />
      );
    }
    return (
      <LoginPage
        onNavigateToRegister={() => {
          window.location.hash = "#register";
          setPublicRoute("register");
        }}
      />
    );
  }

  if (authRoute === "account") {
    return (
      <AccountPage
        onBackToDashboard={() => {
          window.location.hash = "#overview";
          setAuthRoute("dashboard");
        }}
      />
    );
  }

  return (
    <DashboardPage
      onNavigateToAccount={() => {
        window.location.hash = "#account";
        setAuthRoute("account");
      }}
    />
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
