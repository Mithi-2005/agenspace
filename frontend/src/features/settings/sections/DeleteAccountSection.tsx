import { OutlinePillButton } from "../components/OutlinePillButton";
import { SettingRow } from "../components/SettingRow";

export function DeleteAccountSection() {
  return (
    <div className="as-settings-section" aria-labelledby="section-delete-heading">
      <header className="as-settings-section-head">
        <h2 id="section-delete-heading" className="as-settings-section-title is-danger">
          Delete account
        </h2>
        <p className="as-settings-section-description">
          Permanently delete your account, workspace data, and all associated personal information.
        </p>
      </header>

      <div className="as-settings-rows">
        <SettingRow
          id="row-delete-account"
          title="Delete account permanently"
          description="Once deleted, your account and all workspace data cannot be recovered. Self-serve deletion is coming soon."
          danger
          comingSoon
          control={
            <OutlinePillButton danger disabled aria-disabled="true">
              Delete account
            </OutlinePillButton>
          }
        />
      </div>
    </div>
  );
}
