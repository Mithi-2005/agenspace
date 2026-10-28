import { Switch } from "../../../components/ui/workspaceUi";
import { SettingRow } from "../components/SettingRow";
import { usePreference } from "../hooks/usePreference";

export function NotificationsSection() {
  const [notifications, setNotifications] = usePreference(
    "agenspace-pref-notifications",
    true
  );
  const [deadlines, setDeadlines] = usePreference(
    "agenspace-pref-deadline-reminders",
    true
  );
  const [briefingAlert, setBriefingAlert] = usePreference(
    "agenspace-pref-briefing-reminder",
    true
  );

  return (
    <div className="as-settings-section" aria-labelledby="section-notifications-heading">
      <header className="as-settings-section-head">
        <h2 id="section-notifications-heading" className="as-settings-section-title">
          Notifications
        </h2>
        <p className="as-settings-section-description">
          Local alert and reminder preferences. These settings are stored in this browser only.
        </p>
      </header>

      <div className="as-settings-rows">
        {/* Local reminders toggle */}
        <SettingRow
          id="row-pref-notifications"
          title="Enable notifications"
          description="Show local reminders and task updates in this browser."
          control={
            <Switch
              label="Enable notifications"
              checked={notifications}
              onChange={setNotifications}
            />
          }
        />

        {/* Deadline reminders */}
        <SettingRow
          id="row-pref-deadlines"
          title="Deadline reminders"
          description="Alert when scheduled tasks or calendar items are approaching their due time."
          control={
            <Switch
              label="Deadline reminders"
              checked={deadlines}
              onChange={setDeadlines}
            />
          }
        />

        {/* Daily briefing reminder */}
        <SettingRow
          id="row-pref-briefing"
          title="Daily briefing reminder"
          description="Receive a morning notification when your daily workspace briefing is generated."
          control={
            <Switch
              label="Daily briefing reminder"
              checked={briefingAlert}
              onChange={setBriefingAlert}
            />
          }
        />
      </div>
    </div>
  );
}
