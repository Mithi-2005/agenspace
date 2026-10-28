import type { ReactNode } from "react";
import { PageHeader } from "../../components/ui/workspaceUi";

export interface SettingsLayoutProps {
  nav: ReactNode;
  children: ReactNode;
}

export function SettingsLayout({ nav, children }: SettingsLayoutProps) {
  return (
    <div className="as-settings-page">
      <PageHeader
        title="Settings"
        description="Manage your account preferences, profile, security, and workspace settings."
      />

      <section className="as-card as-settings-card" aria-label="Settings configuration">
        <aside className="as-settings-left-pane">
          {nav}
        </aside>

        <div className="as-settings-divider" aria-hidden="true" />

        <main className="as-settings-right-pane">
          {children}
        </main>
      </section>
    </div>
  );
}
