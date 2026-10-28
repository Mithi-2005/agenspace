import { OutlinePillButton } from "../components/OutlinePillButton";
import { SettingRow } from "../components/SettingRow";

export function DataPrivacySection() {
  return (
    <div className="as-settings-section" aria-labelledby="section-data-heading">
      <header className="as-settings-section-head">
        <h2 id="section-data-heading" className="as-settings-section-title">
          Data and privacy
        </h2>
        <p className="as-settings-section-description">
          Review how your data is managed, stored, and exported.
        </p>
      </header>

      <div className="as-settings-rows">
        {/* Export Data (Coming soon) */}
        <SettingRow
          id="row-data-export"
          title="Export my data"
          description="Download a complete JSON archive of your personal tasks, events, and account profile."
          comingSoon
          control={
            <OutlinePillButton disabled aria-disabled="true">
              Export data
            </OutlinePillButton>
          }
        />

        {/* Data Storage Policy / Note */}
        <div className="as-privacy-card">
          <h3 className="as-privacy-card-title">Where is your data stored?</h3>
          <p className="as-privacy-card-text">
            <strong>Server storage:</strong> Your account profile, authentication credentials, and active refresh sessions are securely maintained on the server with encrypted credentials and password hashing.
          </p>
          <p className="as-privacy-card-text">
            <strong>Local browser storage:</strong> Interface preferences (such as theme choice, notification alerts, briefing settings, and motion preferences) are stored strictly within this browser instance and are never transmitted to external services.
          </p>
        </div>
      </div>
    </div>
  );
}
