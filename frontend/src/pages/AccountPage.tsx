import { Check, LogOut, ShieldAlert } from "lucide-react";
import React, { useState } from "react";
import { ThemeControl } from "../components/ThemeControl";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { TextField } from "../components/ui/TextField";
import { ApiRequestError } from "../api/client";
import { useAuth } from "../context/useAuth";
import { useToast } from "../context/ToastContext";
import { getInitials } from "../lib/format";
import { formatDateTime } from "../lib/format";

export const AccountPage: React.FC = () => {
  const toast = useToast();
  const { user, updateProfile, changePassword, logoutAll, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [confirmLogoutAllOpen, setConfirmLogoutAllOpen] = useState(false);
  const [isRevokingSessions, setIsRevokingSessions] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  if (!user) return null;

  const handleUpdateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
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
      setProfileSuccess("Display name saved.");
      toast.success("Display name updated.");
    } catch (err: unknown) {
      const msg = err instanceof ApiRequestError ? err.detail : "Failed to update profile.";
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (!currentPassword) {
      setPwError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    setIsChangingPw(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess("Password changed. You will need to sign in again.");
      toast.success("Password changed successfully.");
    } catch (err: unknown) {
      const msg = err instanceof ApiRequestError ? err.detail : "Failed to update password.";
      setPwError(msg);
      toast.error(msg);
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleConfirmRevokeSessions = async () => {
    setRevokeError(null);
    setIsRevokingSessions(true);
    try {
      await logoutAll();
      toast.success("Signed out of all active sessions.");
      setConfirmLogoutAllOpen(false);
    } catch {
      setRevokeError("Could not revoke all sessions.");
      toast.error("Could not revoke all sessions.");
    } finally {
      setIsRevokingSessions(false);
    }
  };

  return (
    <div className="page-account">
      <header className="page-kicker account-kicker">
        <span className="avatar-mark lg">{getInitials(user.display_name)}</span>
        <div>
          <p className="date-line">{user.email}</p>
          <h1>Account</h1>
          <p className="account-flags">
            <span>{user.is_active ? "Active" : "Disabled"}</span>
            <span>
              {user.is_verified ? "Email verified" : "Email verification is not required in this release"}
            </span>
            {user.last_login_at ? <span>Last sign-in {formatDateTime(user.last_login_at)}</span> : null}
          </p>
        </div>
      </header>

      <div className="settings-stack">
        <section className="panel" aria-labelledby="profile-heading">
          <header className="panel-head">
            <div>
              <h2 id="profile-heading">Profile</h2>
              <p>Visible name in the workspace header.</p>
            </div>
          </header>
          {profileSuccess ? (
            <div className="banner banner-success" role="status">
              <Check size={16} />
              {profileSuccess}
            </div>
          ) : null}
          {profileError ? (
            <div className="banner banner-error" role="alert">
              <ShieldAlert size={16} />
              {profileError}
            </div>
          ) : null}
          <form onSubmit={handleUpdateProfile} className="settings-form">
            <TextField label="Email" value={user.email} disabled hint="Email cannot be changed in this release." />
            <TextField
              label="Display name"
              id="acc-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={isUpdatingProfile}
            />
            <Button
              type="submit"
              variant="lime"
              loading={isUpdatingProfile}
              disabled={displayName.trim() === user.display_name}
            >
              {isUpdatingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </section>

        <section className="panel" aria-labelledby="security-heading">
          <header className="panel-head">
            <div>
              <h2 id="security-heading">Account security</h2>
              <p>Password changes revoke other refresh sessions. Multi-factor authentication is not offered yet.</p>
            </div>
          </header>
          {pwSuccess ? (
            <div className="banner banner-success" role="status">
              <Check size={16} />
              {pwSuccess}
            </div>
          ) : null}
          {pwError ? (
            <div className="banner banner-error" role="alert">
              <ShieldAlert size={16} />
              {pwError}
            </div>
          ) : null}
          <form onSubmit={handleChangePassword} className="settings-form">
            <TextField
              label="Current password"
              id="cur-pw"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={isChangingPw}
            />
            <TextField
              label="New password"
              id="new-pw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={isChangingPw}
              hint="At least 8 characters."
            />
            <TextField
              label="Confirm new password"
              id="conf-pw"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={isChangingPw}
            />
            <Button type="submit" variant="lime" loading={isChangingPw}>
              {isChangingPw ? "Updating password…" : "Update password"}
            </Button>
          </form>
        </section>

        <section className="panel" aria-labelledby="appearance-heading">
          <header className="panel-head">
            <div>
              <h2 id="appearance-heading">Appearance</h2>
              <p>Stored in this browser. There is no server preferences API yet.</p>
            </div>
          </header>
          <ThemeControl />
        </section>

        <section className="panel" aria-labelledby="sessions-heading">
          <header className="panel-head">
            <div>
              <h2 id="sessions-heading">Sessions</h2>
              <p>Sign out of this browser, or revoke every refresh session for the account.</p>
            </div>
          </header>
          {revokeError ? (
            <div className="banner banner-error" role="alert">
              <ShieldAlert size={16} />
              {revokeError}
            </div>
          ) : null}
          <div className="session-actions">
            <Button variant="secondary" onClick={() => void logout()}>
              <LogOut size={15} />
              Sign out
            </Button>
            <Button
              variant="danger"
              loading={isRevokingSessions}
              onClick={() => setConfirmLogoutAllOpen(true)}
            >
              {isRevokingSessions ? "Revoking…" : "Log out all devices"}
            </Button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmLogoutAllOpen}
        title="Sign out everywhere?"
        description="This will revoke every active session for this account across all browsers and devices. You will need to sign in again."
        confirmLabel="Sign out all devices"
        variant="danger"
        isLoading={isRevokingSessions}
        onConfirm={handleConfirmRevokeSessions}
        onClose={() => setConfirmLogoutAllOpen(false)}
      />
    </div>
  );
};
