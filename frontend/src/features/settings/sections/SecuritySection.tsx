import { useState } from "react";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Switch } from "../../../components/ui/workspaceUi";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../context/ToastContext";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { OutlinePillButton } from "../components/OutlinePillButton";
import { SettingRow } from "../components/SettingRow";
import { TextAction } from "../components/TextAction";

export function SecuritySection() {
  const { user, logoutAll } = useAuth();
  const toast = useToast();

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const handleConfirmLogoutAll = async () => {
    setIsLoggingOutAll(true);
    try {
      await logoutAll();
      toast.success("Signed out of all active sessions.");
      setLogoutAllOpen(false);
    } catch {
      toast.error("Could not revoke all sessions.");
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  return (
    <div className="as-settings-section" aria-labelledby="section-security-heading">
      <header className="as-settings-section-head">
        <h2 id="section-security-heading" className="as-settings-section-title">
          Security
        </h2>
        <p className="as-settings-section-description">
          Manage your password, authentication sessions, and sign-in credentials.
        </p>
      </header>

      <div className="as-settings-rows">
        {/* Email Address with disabled Edit */}
        <SettingRow
          id="row-sec-email"
          title="Email address"
          description="Email used for account recovery and critical security alerts."
          value={user?.email || "—"}
          status={user?.is_verified ? "Verified" : "Unverified"}
          statusTone={user?.is_verified ? "success" : "danger"}
          comingSoon
          control={
            <OutlinePillButton disabled aria-disabled="true">
              Edit
            </OutlinePillButton>
          }
        />

        {/* Password */}
        <SettingRow
          id="row-sec-password"
          title="Password"
          description="Change your account password. All other active sessions will be terminated."
          control={
            <OutlinePillButton
              id="btn-change-password-trigger"
              onClick={() => setPasswordModalOpen(true)}
            >
              Change password
            </OutlinePillButton>
          }
        />

        {/* Sessions */}
        <SettingRow
          id="row-sec-sessions"
          title="Active sessions"
          description="Sign out of all active sessions across all browsers and devices."
          control={
            <OutlinePillButton
              danger
              onClick={() => setLogoutAllOpen(true)}
            >
              Sign out of all devices
            </OutlinePillButton>
          }
        />

        {/* 2-step verification (Coming soon) */}
        <SettingRow
          id="row-sec-2fa"
          title="2-step verification"
          description="Add an extra layer of security using an authenticator app. Not available in this release."
          comingSoon
          control={
            <Switch
              label="2-step verification"
              checked={false}
              onChange={() => {}}
              disabled
            />
          }
        />

        {/* Deactivate account (Coming soon) */}
        <SettingRow
          id="row-sec-deactivate"
          title="Deactivate account"
          description="Temporarily disable your workspace access without losing data. Contact support to restore."
          comingSoon
          control={
            <TextAction disabled muted aria-disabled="true">
              Deactivate
            </TextAction>
          }
        />
      </div>

      {/* Accessible Change Password Modal */}
      <ChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />

      {/* Confirmation Dialog for Revoking All Sessions */}
      <ConfirmDialog
        open={logoutAllOpen}
        title="Sign out everywhere?"
        description="This will revoke every active session for this account across all browsers and devices. You will need to sign in again."
        confirmLabel="Sign out all devices"
        variant="danger"
        isLoading={isLoggingOutAll}
        onConfirm={handleConfirmLogoutAll}
        onClose={() => setLogoutAllOpen(false)}
      />
    </div>
  );
}
