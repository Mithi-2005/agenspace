import { brandConfig } from "../../config/brand";
import type { SettingsSection } from "./hooks/useSettingsSection";

export interface SettingsNavProps {
  activeSection: SettingsSection | "not-found";
  onSelectSection: (section: SettingsSection) => void;
}

interface NavItemDef {
  id: SettingsSection;
  label: string;
  danger?: boolean;
}

export function SettingsNav({
  activeSection,
  onSelectSection,
}: SettingsNavProps) {
  const mainItems: NavItemDef[] = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "notifications", label: "Notifications" },
    { id: "moon", label: brandConfig.assistantName },
    { id: "appearance", label: "Appearance" },
    { id: "apps", label: "Connected apps" },
    { id: "data", label: "Data and privacy" },
  ];

  const dangerItems: NavItemDef[] = [
    { id: "delete", label: "Delete account", danger: true },
  ];

  const renderItem = (item: NavItemDef) => {
    const isActive = activeSection === item.id;
    return (
      <a
        key={item.id}
        href={`#settings?s=${item.id}`}
        className={`as-settings-nav-item ${isActive ? "is-active" : ""} ${
          item.danger ? "is-danger" : ""
        }`}
        aria-current={isActive ? "page" : undefined}
        onClick={(e) => {
          e.preventDefault();
          onSelectSection(item.id);
        }}
      >
        {item.label}
      </a>
    );
  };

  return (
    <nav className="as-settings-nav" aria-label="Settings sections">
      <div className="as-settings-nav-group as-settings-nav-main">
        {mainItems.map(renderItem)}
      </div>
      <div className="as-settings-nav-gap" aria-hidden="true" />
      <div className="as-settings-nav-group as-settings-nav-danger">
        {dangerItems.map(renderItem)}
      </div>
    </nav>
  );
}
