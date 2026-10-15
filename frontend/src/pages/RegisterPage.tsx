import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert, User as UserIcon } from "lucide-react";
import React, { useState } from "react";
import BrandLogo from "../components/BrandLogo";
import { ThemeControl } from "../components/ThemeControl";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { ApiRequestError } from "../api/client";
import { useAuth } from "../context/useAuth";
import { navigateTo } from "../routing/hashRoute";

interface RegisterPageProps {
  onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigateToLogin }) => {
  const { register, login } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const nextErrors: Record<string, string> = {};
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) nextErrors.name = "Add the name that should appear in the workspace.";
    if (!trimmedEmail) nextErrors.email = "Enter an email address.";
    if (password.length < 8) nextErrors.password = "Use at least 8 characters.";
    if (password !== confirmPassword) nextErrors.confirm = "The passwords do not match.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await register(trimmedEmail, trimmedName, password);
      await login(trimmedEmail, password);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setError(err.detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Registration failed. Check the information and try again.");
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
          <p className="eyebrow">New workspace</p>
          <h1>Open a Kosway account.</h1>
          <p>
            Accounts are active after registration. Email delivery for verification is not configured
            in this environment, so the workspace does not wait on an inbox.
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
            <h2>Create account</h2>
            <p>The same identity service used for sign-in. No social providers in this release.</p>
          </header>

          {error ? (
            <div className="banner banner-error" role="alert">
              <ShieldAlert size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <TextField
              label="Display name"
              id="reg-name"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              error={fieldErrors.name}
              disabled={isSubmitting}
              leading={<UserIcon size={15} strokeWidth={1.75} />}
            />
            <TextField
              label="Email"
              id="reg-email"
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
              id="reg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password}
              hint="At least 8 characters."
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
            <TextField
              label="Confirm password"
              id="reg-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              error={fieldErrors.confirm}
              disabled={isSubmitting}
              leading={<Lock size={15} strokeWidth={1.75} />}
            />
            <Button type="submit" variant="lime" loading={isSubmitting} className="auth-submit">
              {isSubmitting ? "Creating account…" : "Create account"}
              {!isSubmitting ? <ArrowRight size={16} /> : null}
            </Button>
          </form>

          <p className="auth-switch">
            Already registered?{" "}
            <button type="button" className="text-link" onClick={onNavigateToLogin}>
              Sign in
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};
