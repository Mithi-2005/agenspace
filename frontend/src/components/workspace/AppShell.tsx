import {
  Blocks,
  CalendarClock,
  CalendarDays,
  LayoutGrid,
  Link2,
  LogOut,
  Menu,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { brandConfig } from "../../config/brand";
import { useAuth } from "../../context/useAuth";
import { useTasks } from "../../context/useTasks";
import { getInitials } from "../../lib/format";
import { navigateTo } from "../../routing/hashRoute";
import type { WorkspaceRoute } from "../../routing/hashRoute";
import { ThemeControl } from "../ThemeControl";
import BrandLogo from "../BrandLogo";
import { TaskComposer } from "../tasks/TaskComposer";

const NAV: { id: WorkspaceRoute; label: string; icon: typeof LayoutGrid }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "tasks", label: "Tasks", icon: CalendarDays },
  { id: "events", label: "Events", icon: CalendarClock },
  { id: "connections", label: "Connections", icon: Link2 },
  { id: "plugins", label: "Plugins", icon: Blocks },
  { id: "account", label: "Account", icon: UserRound },
];

interface AppShellProps {
  route: WorkspaceRoute;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ route, children }) => {
  const { user, logout } = useAuth();
  const { openComposer } = useTasks();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = getInitials(user?.display_name);

  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <button
            type="button"
            className="icon-btn nav-menu-btn"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <button
            type="button"
            className="brand-btn"
            onClick={() => navigateTo("dashboard")}
            aria-label={`${brandConfig.appName} dashboard`}
          >
            <BrandLogo size={26} />
          </button>

          <nav className={`workspace-nav ${menuOpen ? "is-open" : ""}`} aria-label="Primary">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = route === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`workspace-nav-item ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    navigateTo(item.id);
                    setMenuOpen(false);
                  }}
                >
                  <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="workspace-tools">
            <p className="workspace-identity">
              <span className="workspace-identity-label">Workspace</span>
              <span className="workspace-identity-name">{user?.display_name}</span>
            </p>
            <ThemeControl compact />
            <button
              type="button"
              className="btn btn-lime btn-sm header-add"
              onClick={() => openComposer()}
            >
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              Add task
            </button>
            <button
              type="button"
              className="account-chip"
              onClick={() => navigateTo("account")}
              aria-label="Open account settings"
            >
              <span className="avatar-mark">{initials}</span>
              <span className="account-chip-name">{user?.display_name}</span>
            </button>
            <button type="button" className="icon-btn" onClick={() => void logout()} aria-label="Sign out">
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      <main id="workspace-main" className="workspace-main">
        <div key={route} className="workspace-page">
          {children}
        </div>
      </main>
      <TaskComposer />
    </div>
  );
};
