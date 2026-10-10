import React from "react";
import {
  ArrowUpRight,
  CalendarClock,
  Layers3,
  LogOut,
  Plus,
  ShieldCheck,
  User as UserIcon,
  Workflow,
} from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import { brandConfig } from "../config/brand";
import { useAuth } from "../context/useAuth";

const items = [
  {
    icon: Workflow,
    title: "Automations",
    desc: "Build repeatable workflows from triggers, conditions, and approved actions.",
    status: "Foundation in progress",
  },
  {
    icon: CalendarClock,
    title: "Schedules",
    desc: "Run useful workflows on a schedule and inspect every execution.",
    status: "Planned",
  },
  {
    icon: ShieldCheck,
    title: "Connected accounts",
    desc: "Connect services through official authorization flows with clear permissions.",
    status: "Planned",
  },
];

interface DashboardPageProps {
  onNavigateToAccount: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToAccount }) => {
  const { user, logout } = useAuth();

  const initials = user?.display_name
    ? user.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label={`${brandConfig.appName} home`}>
          <BrandLogo />
        </a>

        <p className="nav-label">WORKSPACE</p>
        <a className="nav-item active" href="#overview">
          <Layers3 size={17} /> Overview
        </a>
        <a className="nav-item" href="#automations">
          <Workflow size={17} /> Automations
        </a>
        <a className="nav-item" href="#runs">
          <CalendarClock size={17} /> Runs
        </a>

        <p className="nav-label">SETTINGS</p>
        <button
          type="button"
          className="nav-item nav-btn-item"
          onClick={onNavigateToAccount}
        >
          <UserIcon size={17} /> Account
        </button>

        <div className="sidebar-bottom">
          <div className="user-profile-widget">
            <div className="widget-avatar">{initials}</div>
            <div className="widget-details">
              <span className="widget-name">{user?.display_name}</span>
              <span className="widget-email">{user?.email}</span>
            </div>
            <button
              type="button"
              className="widget-logout-btn"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>

          <div className="secure-note">
            <ShieldCheck size={17} />
            <span>
              {brandConfig.assistantName}, your AI assistant, will help you manage workflows. Coming soon.
            </span>
          </div>
          <small>EARLY FOUNDATION · 0.1.0</small>
        </div>
      </aside>

      <section className="main-panel" id="overview">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span>Workspace <i>/</i> Overview</span>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="account-pill-btn"
              onClick={onNavigateToAccount}
            >
              <span className="user-badge-avatar">{initials}</span>
              <span>{user?.display_name}</span>
            </button>
            <span className="status-pill">
              <b /> Active session
            </span>
          </div>
        </header>

        <div className="content">
          <p className="eyebrow">YOUR PERSONAL AUTOMATION WORKSPACE</p>
          <div className="hero">
            <div>
              <h1>
                Make busywork
                <br />
                <em>work for you.</em>
              </h1>
              <p className="hero-copy">
                {brandConfig.appName} brings recurring digital work into one calm, reliable workspace. Start with useful automations and stay in control of what they can do.
              </p>
              <p className="assistant-note">
                <span className="assistant-spark">✦</span> Meet {brandConfig.assistantName} — your AI assistant, coming soon.
              </p>
            </div>
            <div className="orb" aria-hidden="true">
              <div className="orb-ring ring-a" />
              <div className="orb-ring ring-b" />
              <span>
                <Layers3 size={29} />
              </span>
              <b className="node n-a">
                <Workflow size={16} />
              </b>
              <b className="node n-b">
                <CalendarClock size={16} />
              </b>
              <b className="node n-c">
                <ShieldCheck size={16} />
              </b>
            </div>
          </div>

          <div className="section-heading" id="automations">
            <div>
              <h2>Your workspace</h2>
              <p>The core building blocks, coming online step by step.</p>
            </div>
            <button disabled>
              <Plus size={16} /> New automation
            </button>
          </div>

          <div className="cards">
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <article className="cap-card" key={item.title}>
                  <span className={`cap-icon c-${index}`}>
                    <Icon size={20} />
                  </span>
                  <div className="cap-body">
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                  <span className="cap-status">{item.status}</span>
                  <ArrowUpRight size={17} className="arrow" />
                </article>
              );
            })}
          </div>

          <div className="bottom-grid">
            <article className="build-card">
              <p className="eyebrow">FOUNDATION STATUS</p>
              <h3>Start with a solid foundation.</h3>
              <p>
                Authentication, user isolation, durable workflow state, and safe execution come before advanced AI features.
              </p>
              <div className="track">
                <span />
              </div>
              <small>Milestone 1 of 5 · Identity & Security Active</small>
            </article>

            <article className="build-card principle" id="runs">
              <p className="eyebrow">01 / PRINCIPLE</p>
              <h3>You stay in control.</h3>
              <p>
                Automations will use explicit permissions, transparent run history, and approval gates for consequential actions.
              </p>
              <hr />
              <small>SAFE BY DESIGN, NOT AS AN AFTERTHOUGHT</small>
            </article>
          </div>

          <footer>
            <span>{brandConfig.appName.toUpperCase()}</span>
            <span>Useful automation. Clear control.</span>
          </footer>
        </div>
      </section>
    </main>
  );
};
