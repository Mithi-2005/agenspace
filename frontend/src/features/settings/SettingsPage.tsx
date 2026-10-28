import { EmptyState } from "../../components/ui/workspaceUi";
import { OutlinePillButton } from "./components/OutlinePillButton";
import { useSettingsSection, type SettingsSection } from "./hooks/useSettingsSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { ConnectedAppsSection } from "./sections/ConnectedAppsSection";
import { DataPrivacySection } from "./sections/DataPrivacySection";
import { DeleteAccountSection } from "./sections/DeleteAccountSection";
import { MoonSection } from "./sections/MoonSection";
import { NotificationsSection } from "./sections/NotificationsSection";
import { ProfileSection } from "./sections/ProfileSection";
import { SecuritySection } from "./sections/SecuritySection";
import { SettingsLayout } from "./SettingsLayout";
import { SettingsNav } from "./SettingsNav";
import "./settings.css";

export function SettingsPage() {
  const { section, navigateToSection } = useSettingsSection();

  const renderSectionContent = (s: SettingsSection | "not-found") => {
    switch (s) {
      case "profile":
        return <ProfileSection />;
      case "security":
        return <SecuritySection />;
      case "notifications":
        return <NotificationsSection />;
      case "moon":
        return <MoonSection />;
      case "appearance":
        return <AppearanceSection />;
      case "apps":
        return <ConnectedAppsSection />;
      case "data":
        return <DataPrivacySection />;
      case "delete":
        return <DeleteAccountSection />;
      case "not-found":
      default:
        return (
          <div className="as-settings-404">
            <EmptyState
              title="Page not found"
              description="That workspace view is not available."
              action={
                <OutlinePillButton onClick={() => navigateToSection("profile")}>
                  Return to Profile
                </OutlinePillButton>
              }
            />
          </div>
        );
    }
  };

  return (
    <SettingsLayout
      nav={
        <SettingsNav
          activeSection={section}
          onSelectSection={navigateToSection}
        />
      }
    >
      <div key={section} className="as-settings-content-fade">
        {renderSectionContent(section)}
      </div>
    </SettingsLayout>
  );
}

export default SettingsPage;
