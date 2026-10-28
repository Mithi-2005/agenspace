import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sectionNav } from "../layout/navConfig";
import { Grid2X2 } from "lucide-react";
import { MainRail, RailButton, SectionNav } from "../components/workspace/AppShell";
import { AuthContext } from "../context/authContextDef";
import { TaskContext } from "../context/taskContextDef";
import { ActivityPage, AutomationsPage, InboxPage, InsightsPage, ManagePage, MarketplacePage, MoonPage, OverviewPage, SchedulePage, TasksPage } from "../pages/WorkspacePages";
import { CountUp, EmptyState, SampleDataBadge, Switch, Tabs } from "../components/ui/workspaceUi";

describe("workspace UI primitives", () => {
  it("keeps the editable top navigation configuration in one rendered list", () => {
    render(<nav>{sectionNav.map((item) => <button key={item.route} aria-current={item.route === "overview" ? "page" : undefined}>{item.label}</button>)}</nav>);
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("button")).toHaveLength(sectionNav.length);
  });
  it("marks the current item in both navigation capsules", () => {
    render(<><SectionNav route="overview"/><RailButton label="Overview" icon={Grid2X2} active onClick={() => undefined}/></>);
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(2);
  });
  it("does not activate rail overview when navigating to a top-nav section", () => {
    const { container } = render(<MainRail route="activity" />);
    expect(container.querySelector(".as-rail-selection-indicator")).toBeNull();
    expect(screen.getByRole("button", { name: "Overview" })).not.toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });
  it("activates rail overview only when on overview route", () => {
    const { container } = render(<MainRail route="overview" />);
    expect(container.querySelector(".as-rail-selection-indicator")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });
  it("does not activate top nav sections when on rail-only routes", () => {
    render(<SectionNav route="schedule" />);
    expect(document.querySelectorAll('.as-section-nav button.is-active')).toHaveLength(0);
  });
  it("renders sample data only with its badge", () => { render(<div><SampleDataBadge/><span>Preview task</span></div>); expect(screen.getByText("Sample data")).toBeVisible(); expect(screen.getByText("Preview task")).toBeVisible(); });
  it("labels every rendered sample-backed workspace screen", () => {
    const auth = { user: { id: "test", email: "test@example.com", display_name: "Test", timezone: null, is_active: true, is_verified: true, last_login_at: null, created_at: "2026-01-01", updated_at: "2026-01-01" }, token: null, status: "authenticated" as const, isLoading: false, isAuthenticated: true, login: vi.fn(), register: vi.fn(), logout: vi.fn(), logoutAll: vi.fn(), updateProfile: vi.fn(), changePassword: vi.fn(), refreshSession: vi.fn() };
    const tasks = { tasks: [], isLoading: false, error: null, view: "today" as const, setView: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), completeTask: vi.fn(), reopenTask: vi.fn(), removeTask: vi.fn(), refreshTasks: vi.fn(), composerOpen: false, openComposer: vi.fn(), closeComposer: vi.fn(), composerInitial: null };
    render(<AuthContext.Provider value={auth}><TaskContext.Provider value={tasks}><OverviewPage/><ActivityPage/><ManagePage/><AutomationsPage/><InsightsPage/><SchedulePage/><InboxPage/><TasksPage/><MoonPage/><MarketplacePage/></TaskContext.Provider></AuthContext.Provider>);
    expect(screen.getAllByText("Sample data").length).toBeGreaterThanOrEqual(10);
  });
  it("changes tab filters", () => { const change = vi.fn(); render(<Tabs tabs={["All", "Done"]} active="All" onChange={change}/>); fireEvent.click(screen.getByRole("tab", { name: "Done" })); expect(change).toHaveBeenCalledWith("Done"); });
  it("toggles a switch with keyboard activation", () => { const change = vi.fn(); render(<Switch label="Calendar sync" checked={false} onChange={change}/>); fireEvent.keyDown(screen.getByRole("switch"), { key: "Enter" }); fireEvent.click(screen.getByRole("switch")); expect(change).toHaveBeenCalledWith(true); });
  it("exposes the final CountUp value to assistive technology", () => { render(<CountUp value={1240}/>); expect(screen.getByLabelText("1,240")).toBeInTheDocument(); });
  it("renders a named empty state", () => { render(<EmptyState title="No calendar connected" description="Connect a calendar."/>); expect(screen.getByText("No calendar connected")).toBeVisible(); });
});
