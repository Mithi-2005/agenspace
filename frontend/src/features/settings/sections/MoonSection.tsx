import { brandConfig } from "../../../config/brand";
import { Switch } from "../../../components/ui/workspaceUi";
import { SettingRow } from "../components/SettingRow";
import { usePreference } from "../hooks/usePreference";

export function MoonSection() {
  const assistantName = brandConfig.assistantName;
  const [briefing, setBriefing] = usePreference(
    "agenspace-pref-moon-briefing",
    true
  );

  return (
    <div className="as-settings-section" aria-labelledby="section-moon-heading">
      <header className="as-settings-section-head">
        <h2 id="section-moon-heading" className="as-settings-section-title">
          {assistantName}
        </h2>
        <p className="as-settings-section-description">
          Configure how {assistantName} interacts with your workspace and assists your workflow.
        </p>
      </header>

      <div className="as-settings-rows">
        {/* Assistant Name Read-Only */}
        <SettingRow
          id="row-moon-name"
          title="Assistant name"
          description="The AI companion configured for your workspace."
          value={assistantName}
        />

        {/* Show briefing on Overview */}
        <SettingRow
          id="row-moon-briefing"
          title={`Show ${assistantName} briefing on Overview`}
          description="Display an automated summary briefing of tasks, events, and focus items on the Overview page."
          control={
            <Switch
              label={`Show ${assistantName} briefing on Overview`}
              checked={briefing}
              onChange={setBriefing}
            />
          }
        />

        {/* Access to tasks and events (Coming soon) */}
        <SettingRow
          id="row-moon-access"
          title={`${assistantName} access to tasks and events`}
          description="Grant permission for the assistant to schedule events and prioritize tasks automatically."
          comingSoon
          control={
            <a
              href="#manage"
              className="as-setting-manage-link"
              aria-disabled="true"
              onClick={(e) => e.preventDefault()}
            >
              Manage apps
            </a>
          }
        />
      </div>
    </div>
  );
}
