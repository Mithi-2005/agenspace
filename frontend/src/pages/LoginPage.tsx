import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert } from "lucide-react";
import React, { useState } from "react";
import BrandLogo from "../components/BrandLogo";
import { ThemeControl } from "../components/ThemeControl";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { ApiRequestError } from "../api/client";
import { brandConfig } from "../config/brand";
import { useAuth } from "../context/useAuth";
import { navigateTo } from "../routing/hashRoute";

interface LoginPageProps {
  onNavigateToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const nextErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) nextErrors.email = "Enter the email on your account.";
    if (!password) nextErrors.password = "Enter your password.";
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setIsSubmitting(true);
    try {
      await login(trimmedEmail, password);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setError(err.detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to log in. Check your network connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-brand-panel">
        <button type="button" className="brand-btn" onClick={() => navigateTo("landing")}>
          <BrandLogo size={30} />
        </button>
        <div className="auth-brand-copy">
          <p className="eyebrow">Workspace access</p>
          <h1>Return to your desk.</h1>
          <p>
            {brandConfig.appName} keeps the session in memory and the refresh token in an HttpOnly
            cookie. Sign in to open Dashboard, Tasks, Connections, and Account.
          </p>
        </div>
        <div className="auth-mini-scene" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-toolbar">
          <ThemeControl compact />
        </div>
        <div className="auth-card">
          <header className="auth-header">
            <h2>Sign in</h2>
            <p>Use the email and password for your {brandConfig.appName} account.</p>
          </header>

          {error ? (
            <div className="banner banner-error" role="alert">
              <ShieldAlert size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <TextField
              label="Email"
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors.email}
              disabled={isSubmitting}
              leading={<Mail size={15} strokeWidth={1.75} />}
            />
            <TextField
              label="Password"
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password}
              disabled={isSubmitting}
              leading={<Lock size={15} strokeWidth={1.75} />}
              trailing={
                <button
                  type="button"
                  className="icon-btn field-trailing-btn"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
            <Button type="submit" variant="lime" loading={isSubmitting} className="auth-submit">
              {isSubmitting ? "Signing in…" : "Sign in"}
              {!isSubmitting ? <ArrowRight size={16} /> : null}
            </Button>
          </form>

          <p className="auth-switch">
            No account yet?{" "}
            <button type="button" className="text-link" onClick={onNavigateToRegister}>
              Create one
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};
