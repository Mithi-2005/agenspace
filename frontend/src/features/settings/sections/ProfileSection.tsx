import { useAuth } from "../../../context/useAuth";
import { getInitials } from "../../../lib/format";
import { InlineEditRow } from "../components/InlineEditRow";
import { SettingRow } from "../components/SettingRow";

export function ProfileSection() {
  const { user } = useAuth();

  return (
    <div className="as-settings-section" aria-labelledby="section-profile-heading">
      <header className="as-settings-section-head">
        <h2 id="section-profile-heading" className="as-settings-section-title">
          Profile
        </h2>
        <p className="as-settings-section-description">
          Manage your public identity and account email.
        </p>
      </header>

      <div className="as-settings-rows">
        {/* Avatar Initials Preview */}
        <SettingRow
          id="row-avatar"
          title="Avatar"
          description="Your initials are displayed in the workspace header. Photo upload is not available yet."
          control={
            <div className="as-profile-avatar-preview">
              <span className="as-avatar as-avatar-large" aria-label="Avatar initials preview">
                {getInitials(user?.display_name || user?.email || "U")}
              </span>
            </div>
          }
        />

        {/* Display Name with Inline Edit */}
        <InlineEditRow
          id="row-display-name"
          title="Display name"
          description="Visible name in the workspace header and notifications."
        />

        {/* Email Read-only */}
        <SettingRow
          id="row-email"
          title="Email address"
          description="Verification emails are not available yet."
          value={user?.email || "—"}
          status={user?.is_verified ? "Verified" : "Unverified"}
          statusTone={user?.is_verified ? "success" : "danger"}
        />
      </div>
    </div>
  );
}
