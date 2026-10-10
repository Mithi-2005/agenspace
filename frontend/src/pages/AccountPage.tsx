import React, { useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Clock, Key, LogOut, Shield, ShieldAlert, User as UserIcon } from "lucide-react";
import { brandConfig } from "../config/brand";
import { useAuth } from "../context/useAuth";
import { ApiRequestError } from "../api/client";

interface AccountPageProps {
  onBackToDashboard: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ onBackToDashboard }) => {
  const { user, updateProfile, changePassword, logoutAll, logout } = useAuth();

  // Profile update state
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Session revocation state
  const [isRevokingSessions, setIsRevokingSessions] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const trimmed = displayName.trim();
    if (!trimmed) {
      setProfileError("Display name cannot be empty.");
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile(trimmed);
      setProfileSuccess("Profile updated successfully.");
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setProfileError(err.detail);
      } else {
        setProfileError("Failed to update profile.");
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (!currentPassword) {
      setPwError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }

    setIsChangingPw(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess("Password changed successfully. You will be redirected to log in.");
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setPwError(err.detail);
      } else {
        setPwError("Failed to update password.");
      }
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleLogoutAll = async () => {
    if (confirm("Are you sure you want to log out of all active devices?")) {
      setIsRevokingSessions(true);
      try {
        await logoutAll();
      } catch {
        alert("Failed to revoke all sessions.");
      } finally {
        setIsRevokingSessions(false);
      }
    }
  };

  if (!user) {
    return null;
  }

  const initials = user.display_name
    ? user.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="account-container">
      <header className="account-topbar">
        <div className="account-topbar-left">
          <button
            type="button"
            className="back-btn"
            onClick={onBackToDashboard}
            aria-label="Back to workspace"
          >
            <ArrowLeft size={16} />
            <span>Workspace</span>
          </button>
          <i>/</i>
          <span>Account Settings</span>
        </div>
        <div className="account-topbar-right">
          <button type="button" className="account-logout-btn" onClick={logout}>
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <main className="account-content">
        <section className="account-hero">
          <div className="account-avatar">{initials}</div>
          <div className="account-meta">
            <h1>{user.display_name}</h1>
            <p className="account-email">{user.email}</p>
            <div className="account-badges">
              <span className={`status-pill ${user.is_active ? "active-pill" : "disabled-pill"}`}>
                <b /> {user.is_active ? "Active account" : "Disabled"}
              </span>
              <span className="status-pill neutral-pill">
                {user.is_verified ? (
                  <>
                    <CheckCircle2 size={12} /> Verified
                  </>
                ) : (
                  <>
                    <Clock size={12} /> Pending email verification
                  </>
                )}
              </span>
            </div>
          </div>
        </section>

        <div className="account-grid">
          {/* Profile Card */}
          <article className="account-card">
            <div className="card-header">
              <UserIcon size={18} className="card-icon" />
              <div>
                <h2>Profile details</h2>
                <p>Manage your public display name.</p>
              </div>
            </div>

            {profileSuccess && (
              <div className="auth-success-alert">
                <Check size={16} />
                <span>{profileSuccess}</span>
              </div>
            )}
            {profileError && (
              <div className="auth-error-alert">
                <ShieldAlert size={16} />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="account-form">
              <div className="form-group">
                <label htmlFor="acc-email">Email address</label>
                <input id="acc-email" type="email" value={user.email} disabled />
                <small className="form-hint">Email address cannot be changed in this release.</small>
              </div>

              <div className="form-group">
                <label htmlFor="acc-name">Display name</label>
                <input
                  id="acc-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  disabled={isUpdatingProfile}
                />
              </div>

              <button
                type="submit"
                className="save-btn"
                disabled={isUpdatingProfile || displayName.trim() === user.display_name}
              >
                {isUpdatingProfile ? "Saving..." : "Save changes"}
              </button>
            </form>
          </article>

          {/* Password Security Card */}
          <article className="account-card">
            <div className="card-header">
              <Key size={18} className="card-icon" />
              <div>
                <h2>Password security</h2>
                <p>Update your password to keep your account safe.</p>
              </div>
            </div>

            {pwSuccess && (
              <div className="auth-success-alert">
                <Check size={16} />
                <span>{pwSuccess}</span>
              </div>
            )}
            {pwError && (
              <div className="auth-error-alert">
                <ShieldAlert size={16} />
                <span>{pwError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="account-form">
              <div className="form-group">
                <label htmlFor="cur-pw">Current password</label>
                <input
                  id="cur-pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isChangingPw}
                />
              </div>

              <div className="form-group">
                <label htmlFor="new-pw">New password</label>
                <input
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  disabled={isChangingPw}
                />
              </div>

              <div className="form-group">
                <label htmlFor="conf-pw">Confirm new password</label>
                <input
                  id="conf-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  disabled={isChangingPw}
                />
              </div>

              <p className="session-warning-note">
                <Shield size={14} />
                Changing your password automatically invalidates active refresh sessions on all other devices.
              </p>

              <button type="submit" className="save-btn" disabled={isChangingPw}>
                {isChangingPw ? "Updating password..." : "Update password"}
              </button>
            </form>
          </article>

          {/* Session Management */}
          <article className="account-card full-width-card">
            <div className="card-header">
              <Shield size={18} className="card-icon" />
              <div>
                <h2>Active sessions & devices</h2>
                <p>Manage session rotation and sign out of remote browsers.</p>
              </div>
            </div>
            <div className="session-card-body">
              <p>
                {brandConfig.appName} enforces opaque refresh token rotation and token-family reuse detection. If you suspect any unauthorized access, revoke all sessions below.
              </p>
              <button
                type="button"
                className="revoke-all-btn"
                onClick={handleLogoutAll}
                disabled={isRevokingSessions}
              >
                {isRevokingSessions ? "Revoking sessions..." : "Log out all devices"}
              </button>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
};
