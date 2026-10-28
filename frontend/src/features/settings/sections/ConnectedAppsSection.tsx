import { Tag } from "../../../components/ui/workspaceUi";
import { SettingRow } from "../components/SettingRow";

interface AppItem {
  name: string;
  description: string;
  status: string;
  tone: "neutral" | "hot" | "success" | "danger";
}

const APPS: AppItem[] = [
  {
    name: "Gmail",
    description: "Sync unread emails and draft message suggestions into your inbox.",
    status: "Not connected",
    tone: "neutral",
  },
  {
    name: "Google Classroom",
    description: "Import course assignments, announcements, and student tasks.",
    status: "Not connected",
    tone: "neutral",
  },
  {
    name: "Google Calendar",
    description: "Synchronize scheduled events, focus sessions, and deadlines.",
    status: "Not connected",
    tone: "neutral",
  },
];

export function ConnectedAppsSection() {
  return (
    <div className="as-settings-section" aria-labelledby="section-apps-heading">
      <header className="as-settings-section-head">
        <h2 id="section-apps-heading" className="as-settings-section-title">
          Connected apps
        </h2>
        <p className="as-settings-section-description">
          External services and data sources integrated with your workspace.
        </p>
      </header>

      <div className="as-settings-rows">
        {APPS.map((app) => (
          <SettingRow
            key={app.name}
            title={app.name}
            description={app.description}
            control={
              <div className="as-app-control-block">
                <Tag tone={app.tone}>{app.status}</Tag>
                <a
                  href="#manage"
                  className="as-setting-manage-link"
                  aria-label={`Manage ${app.name} in Manage integrations`}
                >
                  Manage
                </a>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}
