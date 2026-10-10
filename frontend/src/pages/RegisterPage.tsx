import React, { useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldAlert, User as UserIcon } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import { brandConfig } from "../config/brand";
import { useAuth } from "../context/useAuth";
import { ApiRequestError } from "../api/client";

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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Please provide a display name.");
      return;
    }
    if (!trimmedEmail) {
      setError("Please provide a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(trimmedEmail, trimmedName, password);
      // Automatically log the user in after registration
      await login(trimmedEmail, password);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setError(err.detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Registration failed. Please check your information.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-brand-center">
            <BrandLogo />
          </div>
          <h1>Create your {brandConfig.appName} account</h1>
          <p className="auth-subtext">
            Start automating repetitive tasks with {brandConfig.appName} and your AI assistant {brandConfig.assistantName}.
          </p>
        </header>

        {error && (
          <div className="auth-error-alert" role="alert">
            <ShieldAlert size={18} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <div className="verification-info-banner">
          <CheckCircle2 size={16} />
          <span>Notice: Direct email delivery is pending provider setup; newly registered accounts are active immediately.</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="reg-name">Display name</label>
            <div className="input-wrap">
              <UserIcon size={16} className="input-icon" />
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Morgan"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email address</label>
            <div className="input-wrap">
              <Mail size={16} className="input-icon" />
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm password</label>
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input
                id="reg-confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-primary-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span>Creating account...</span>
            ) : (
              <>
                <span>Create account</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <footer className="auth-footer">
          <p>
            Already have an account?{" "}
            <button
              type="button"
              className="auth-link-btn"
              onClick={onNavigateToLogin}
            >
              Sign in
            </button>
          </p>
        </footer>
      </div>
    </div>
  );
};
