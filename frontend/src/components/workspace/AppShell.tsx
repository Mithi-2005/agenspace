import {
  Bell,
  ChevronDown,
  CircleHelp,
  Info,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { brandConfig } from "../../config/brand";
import { useAuth } from "../../context/useAuth";
import { getInitials } from "../../lib/format";
import { railNav, sectionNav } from "../../layout/navConfig";
import { navigateTo, type WorkspaceRoute } from "../../routing/hashRoute";
import { useTheme } from "../../theme/useTheme";
import { SampleDataBadge } from "../ui/workspaceUi";

interface AppShellProps {
  route: WorkspaceRoute;
  children: React.ReactNode;
}
const assistantLabel = () => brandConfig.assistantName;
const slideDuration = (distance: number) =>
  Math.min(900, Math.max(360, 280 + distance * 1.1));

function useDismiss(
  open: boolean,
  onClose: () => void,
  ref: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target))
        onClose();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", pointer);
    };
  }, [open, onClose, ref]);
}

export function BrandCapsule() {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <button
      className="as-capsule as-brand"
      type="button"
      onClick={() => navigateTo("overview")}
      aria-label={`${brandConfig.appName} overview`}
    >
      <span className="as-brand-mark">
        {brandConfig.logoUrl && !imageFailed ? (
          <img
            src={brandConfig.logoUrl}
            alt=""
            onError={() => setImageFailed(true)}
          />
        ) : (
          brandConfig.appName.slice(0, 1)
        )}
      </span>
      <span>{brandConfig.appName}</span>
    </button>
  );
}
export function SectionNav({
  route,
  className = "",
  onNavigate,
}: {
  route: WorkspaceRoute;
  className?: string;
  onNavigate?: () => void;
}) {
  const topRoute =
    route === "settings"
      ? "account"
      : sectionNav.some((item) => item.route === route)
      ? route
      : null;
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    duration: number;
  } | null>(null);
  const previousIndicator = useRef<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const updateIndicator = () => {
      const active = nav.querySelector<HTMLButtonElement>("button.is-active");
      if (!active) {
        setIndicator(null);
        return;
      }
      const next = { left: active.offsetLeft, width: active.offsetWidth };
      const distance = previousIndicator.current
        ? Math.abs(next.left - previousIndicator.current.left)
        : 0;
      previousIndicator.current = next;
      setIndicator({ ...next, duration: slideDuration(distance) });
    };

    updateIndicator();
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateIndicator);
    observer?.observe(nav);
    window.addEventListener("resize", updateIndicator);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [topRoute]);

  return (
    <nav
      ref={navRef}
      className={`as-capsule as-section-nav ${indicator ? "has-selection-indicator" : ""} ${className}`}
      aria-label="Workspace sections"
    >
      {indicator && (
        <span
          aria-hidden="true"
          className="as-section-nav-indicator"
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
            transitionDuration: `${indicator.duration}ms, ${indicator.duration}ms`,
          }}
        />
      )}
      {sectionNav.map((item) => (
        <button
          type="button"
          key={item.route}
          className={topRoute === item.route ? "is-active" : ""}
          aria-current={topRoute === item.route ? "page" : undefined}
          onClick={() => {
            navigateTo(item.route);
            onNavigate?.();
          }}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function FloatingPopover({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`as-popover ${className}`} role="dialog">
      {children}
    </div>
  );
}
export function UtilityCapsule() {
  const [open, setOpen] = useState<
    "search" | "notifications" | "alerts" | null
  >(null);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(!!open, () => setOpen(null), ref);
  return (
    <div
      ref={ref}
      className="as-capsule as-utility"
      aria-label="Workspace utilities"
    >
      <button
        type="button"
        aria-label="Search workspace"
        aria-expanded={open === "search"}
        onClick={() => setOpen("search")}
      >
        <Search size={19} />
      </button>
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open === "notifications"}
        onClick={() => setOpen("notifications")}
      >
        <Bell size={19} />
        <i className="as-unread" />
      </button>
      <button
        type="button"
        aria-label="Alerts"
        aria-expanded={open === "alerts"}
        onClick={() => setOpen("alerts")}
      >
        <Info size={19} />
      </button>
      {open === "search" && <CommandPalette onClose={() => setOpen(null)} />}{" "}
      {open === "notifications" && (
        <FloatingPopover>
          <SampleDataBadge />
          <strong>Notifications</strong>
          <p>Your sample briefing is ready.</p>
        </FloatingPopover>
      )}{" "}
      {open === "alerts" && (
        <FloatingPopover>
          <SampleDataBadge />
          <strong>Alerts</strong>
          <p>Two tasks are due today.</p>
        </FloatingPopover>
      )}
    </div>
  );
}
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <FloatingPopover className="as-command">
      <label htmlFor="workspace-search">Search workspace</label>
      <input
        id="workspace-search"
        ref={inputRef}
        placeholder="Try “today’s tasks”"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      />
      <small>Press Esc to close · Cmd/Ctrl K opens this palette</small>
    </FloatingPopover>
  );
}
export function ProfileCapsule() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const initials = getInitials(user?.display_name);
  return (
    <div className="as-profile-wrap" ref={ref}>
      <button
        type="button"
        className="as-capsule as-profile"
        aria-expanded={open}
        aria-label="Open profile menu"
        onClick={() => setOpen(!open)}
      >
        <span className="as-avatar">{initials}</span>
        <span className="as-profile-copy">
          <b>{user?.display_name}</b>
          <small>{user?.email}</small>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <UserMenu
          onClose={() => setOpen(false)}
          onSignOut={() => void logout()}
        />
      )}
    </div>
  );
}
export function UserMenu({
  onClose,
  onSignOut,
}: {
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <FloatingPopover className="as-user-menu">
      <button
        onClick={() => {
          navigateTo("account");
          onClose();
        }}
      >
        <UserRound size={15} /> Account
      </button>
      <button
        onClick={() => {
          navigateTo("settings");
          onClose();
        }}
      >
        <Settings size={15} /> Settings
      </button>
      <button onClick={onSignOut}>
        <LogOut size={15} /> Sign out
      </button>
    </FloatingPopover>
  );
}
export function AppearanceCapsule() {
  const { preference, setPreference } = useTheme();
  return (
    <div
      className="as-capsule as-rail-capsule as-appearance"
      aria-label="Appearance"
    >
      <button
        type="button"
        className={preference === "light" ? "is-active" : ""}
        aria-label="Use light appearance"
        data-tooltip="Light theme"
        onClick={() => setPreference("light")}
      >
        <Sun size={16} />
      </button>
      <button
        type="button"
        className={preference === "dark" ? "is-active" : ""}
        aria-label="Use dark appearance"
        data-tooltip="Dark theme"
        onClick={() => setPreference("dark")}
      >
        <Moon size={16} />
      </button>
    </div>
  );
}
export function RailButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`as-rail-button ${active ? "is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      data-tooltip={label === "Moon" ? assistantLabel() : label}
      onClick={onClick}
    >
      <Icon size={17} />
    </button>
  );
}
export function MainRail({ route }: { route: WorkspaceRoute }) {
  const activeRoute = route === "account" ? "settings" : route;
  const activeIndex = railNav.findIndex((item) => item.route === activeRoute);
  const [indicator, setIndicator] = useState<{
    index: number;
    duration: number;
  } | null>(activeIndex >= 0 ? { index: activeIndex, duration: 0 } : null);
  const previousIndex = useRef<number | null>(activeIndex >= 0 ? activeIndex : null);

  useEffect(() => {
    if (activeIndex >= 0) {
      const distance =
        previousIndex.current !== null
          ? Math.abs(activeIndex - previousIndex.current) * 42
          : 0;
      previousIndex.current = activeIndex;
      setIndicator({ index: activeIndex, duration: slideDuration(distance) });
    } else {
      previousIndex.current = null;
      setIndicator(null);
    }
  }, [activeIndex]);

  return (
    <nav
      className={`as-capsule as-rail-capsule as-main-rail ${indicator ? "has-selection-indicator" : ""}`}
      aria-label="Main navigation"
    >
      {indicator && (
        <span
          aria-hidden="true"
          className="as-rail-selection-indicator"
          style={{
            transform: `translateY(${indicator.index * 42}px)`,
            transitionDuration: `${indicator.duration}ms`,
          }}
        />
      )}
      {railNav.map((item) => (
        <RailButton
          key={item.route}
          active={activeRoute === item.route}
          label={item.label}
          icon={item.icon!}
          onClick={() => navigateTo(item.route)}
        />
      ))}
    </nav>
  );
}
export function MobileRail({ route }: { route: WorkspaceRoute }) {
  const activeRoute = route === "account" ? "settings" : route;
  return (
    <nav className="as-capsule as-mobile-rail" aria-label="Mobile navigation">
      {railNav.map((item) => (
        <RailButton
          key={item.route}
          active={activeRoute === item.route}
          label={item.label}
          icon={item.icon!}
          onClick={() => navigateTo(item.route)}
        />
      ))}
    </nav>
  );
}
export function BottomUtilityCapsule() {
  const [help, setHelp] = useState(false);
  const { logout } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(help, () => setHelp(false), ref);
  return (
    <div ref={ref} className="as-capsule as-rail-capsule as-bottom-utility">
      <button
        type="button"
        aria-label="Help"
        data-tooltip="Help"
        onClick={() => setHelp(!help)}
      >
        <CircleHelp size={17} />
      </button>
      <button
        type="button"
        aria-label="Sign out"
        data-tooltip="Sign out"
        onClick={() => void logout()}
      >
        <LogOut size={17} />
      </button>
      {help && (
        <FloatingPopover className="as-help">
          <strong>Help</strong>
          <p>⌘/Ctrl K opens search.</p>
          <a href="#docs">Documentation</a>
        </FloatingPopover>
      )}
    </div>
  );
}

export const AppShell: React.FC<AppShellProps> = ({ route, children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document
          .querySelector<HTMLButtonElement>('[aria-label="Search workspace"]')
          ?.click();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [route]);
  return (
    <div className="agenspace-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <div className={`as-frame ${mobileMenuOpen ? "has-mobile-menu" : ""}`}>
        <header className="as-topbar">
          <BrandCapsule />
          <button
            type="button"
            className="as-mobile-menu"
            aria-label={
              mobileMenuOpen ? "Close sections menu" : "Open sections menu"
            }
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <SectionNav
            route={route}
            className={mobileMenuOpen ? "is-mobile-open" : ""}
            onNavigate={() => setMobileMenuOpen(false)}
          />
          <UtilityCapsule />
          <ProfileCapsule />
        </header>
        <div className="as-body">
          <aside className="as-left-rail">
            <div className="as-left-sticky">
              <AppearanceCapsule />
              <div className="as-rail-middle">
                <MainRail route={route} />
              </div>
              <BottomUtilityCapsule />
            </div>
          </aside>
          <main id="workspace-main" className="as-main">
            <div key={route} className="as-route-content">
              {children}
            </div>
          </main>
        </div>
        <MobileRail route={route} />
      </div>
    </div>
  );
};
