import type { CSSProperties, ReactNode } from "react";
import type { WorkspaceRoute } from "../../routing/hashRoute";

function Block({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`as-skeleton-block ${className}`} />;
}

function Header({ action = false }: { action?: boolean }) {
  return <header className="as-skeleton-header" aria-hidden="true"><div><Block className="as-skeleton-title"/><Block className="as-skeleton-copy"/></div>{action && <Block className="as-skeleton-action"/>}</header>;
}

function Card({ className = "", children }: { className?: string; children?: ReactNode }) {
  return <section aria-hidden="true" className={`as-skeleton-card ${className}`}>{children}</section>;
}

function Stats({ count = 4 }: { count?: number }) {
  return <div className="as-stat-grid as-four as-skeleton-stats">{Array.from({ length: count }, (_, index) => <Card key={index} className="as-skeleton-stat"><Block className="as-skeleton-label"/><Block className="as-skeleton-value"/><Block className="as-skeleton-detail"/></Card>)}</div>;
}

function Table({ columns = 5, rows = 5 }: { columns?: number; rows?: number }) {
  return <div className="as-skeleton-table" aria-hidden="true" style={{ "--skeleton-columns": columns } as CSSProperties}><div className="as-skeleton-table-row as-skeleton-table-heading">{Array.from({ length: columns }, (_, index) => <Block key={index}/>)}</div>{Array.from({ length: rows }, (_, row) => <div className="as-skeleton-table-row" key={row}>{Array.from({ length: columns }, (_, column) => <Block key={column}/>)}</div>)}</div>;
}

function List({ count = 4 }: { count?: number }) {
  return <div className="as-skeleton-list" aria-hidden="true">{Array.from({ length: count }, (_, index) => <div key={index}><Block className="as-skeleton-icon"/><span><Block className="as-skeleton-line-long"/><Block className="as-skeleton-line-short"/></span><Block className="as-skeleton-time"/></div>)}</div>;
}

function Integrations({ count = 3, marketplace = false }: { count?: number; marketplace?: boolean }) {
  return <div className={marketplace ? "as-market-grid" : "as-integration-grid"}>{Array.from({ length: count }, (_, index) => <Card key={index} className="as-skeleton-integration"><div className="as-skeleton-card-top"><Block className="as-skeleton-app-icon"/><Block className="as-skeleton-tag"/></div><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-copy"/><Block className="as-skeleton-button"/></Card>)}</div>;
}

function OverviewSkeleton() {
  return <><Header action/><div className="as-grid as-overview-grid as-skeleton-overview"><Card className="as-focus-card as-skeleton-focus"><div className="as-skeleton-card-top"><Block className="as-skeleton-line-short"/><Block className="as-skeleton-tag"/></div><Block className="as-skeleton-hero"/><Block className="as-skeleton-copy"/><div className="as-skeleton-buttons"><Block className="as-skeleton-button"/><Block className="as-skeleton-button"/></div><div className="as-skeleton-inset">{Array.from({ length: 3 }, (_, index) => <Block key={index}/>)}</div></Card><Stats/><Card className="as-chart-card as-skeleton-chart"><Block className="as-skeleton-line-medium"/><div className="as-skeleton-bars">{Array.from({ length: 7 }, (_, index) => <Block key={index}/>)}</div></Card><Card className="as-skeleton-progress"><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-progress-bar"/><Block className="as-skeleton-detail"/></Card><Card className="as-wide-card"><Block className="as-skeleton-line-medium"/><List/><Block className="as-skeleton-suggestion"/></Card></div></>;
}

function ActivitySkeleton() { return <><Header/><Stats/><Card className="as-wide-card as-skeleton-table-card"><Block className="as-skeleton-tabs"/><Table columns={3}/></Card><Card><Block className="as-skeleton-line-medium"/><List/></Card></>; }
function TasksSkeleton() { return <><Header/><Stats/><Card className="as-wide-card as-skeleton-table-card"><Block className="as-skeleton-tabs"/><Table columns={6}/></Card><div className="as-goal-grid"><Card><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-copy"/><Block className="as-skeleton-button"/></Card>{Array.from({ length: 2 }, (_, index) => <Card key={index} className="as-skeleton-goal"><Block className="as-skeleton-ring"/><span><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-detail"/></span></Card>)}</div></>; }
function ManageSkeleton() { return <><Header/><Integrations/><Card className="as-controls as-skeleton-controls"><Block className="as-skeleton-line-medium"/>{Array.from({ length: 4 }, (_, index) => <div key={index}><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-switch"/></div>)}<Block className="as-skeleton-range"/></Card></>; }
function MarketplaceSkeleton() { return <><Header/><Integrations count={4} marketplace/></>; }
function ScheduleSkeleton() { return <><Header/><Card><div className="as-skeleton-week">{Array.from({ length: 7 }, (_, index) => <Block key={index}/>)}</div><div className="as-skeleton-empty"><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-copy"/><Block className="as-skeleton-button"/></div></Card><Card><Block className="as-skeleton-line-medium"/><List count={3}/></Card></>; }
function InboxSkeleton() { return <><Header/><Card className="as-skeleton-connect"><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-copy"/><Block className="as-skeleton-button"/></Card><Card><Block className="as-skeleton-line-medium"/><List count={3}/></Card></>; }
function AutomationsSkeleton() { return <><Header action/><Stats/><div className="as-workflow-grid">{Array.from({ length: 3 }, (_, index) => <Card key={index} className="as-skeleton-workflow"><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-copy"/><div><Block className="as-skeleton-tag"/><Block className="as-skeleton-switch"/></div></Card>)}</div></>; }
function InsightsSkeleton() { return <><Header/><div className="as-grid as-insights"><Card className="as-skeleton-chart"><Block className="as-skeleton-line-medium"/><div className="as-skeleton-bars">{Array.from({ length: 7 }, (_, index) => <Block key={index}/>)}</div></Card><Card><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-progress-bar"/><Block className="as-skeleton-detail"/></Card><Card className="as-wide-card"><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-summary"/><Block className="as-skeleton-tag"/></Card></div></>; }
function MoonSkeleton() { return <><Header/><Card className="as-chat as-skeleton-chat"><Block className="as-skeleton-chat-message"/><Block className="as-skeleton-chat-message is-wide"/><div className="as-skeleton-chips"><Block/><Block/><Block/></div><Block className="as-skeleton-input"/></Card></>; }
function SettingsSkeleton() { return <><Header/><div className="as-skeleton-settings">{Array.from({ length: 3 }, (_, index) => <Card key={index}><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-copy"/>{index < 2 && <Block className="as-skeleton-switch"/>}</Card>)}</div></>; }
function AccountSkeleton() { return <><Header/><div className="as-skeleton-identity"><Block className="as-skeleton-avatar"/><span><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-copy"/></span></div><div className="as-skeleton-account-grid">{Array.from({ length: 4 }, (_, index) => <Card key={index}><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-copy"/>{index < 2 && <><Block className="as-skeleton-input"/><Block className="as-skeleton-input"/><Block className="as-skeleton-button"/></>}</Card>)}</div></>; }
function NotFoundSkeleton() { return <><Header/><Card className="as-skeleton-empty"><Block className="as-skeleton-line-medium"/><Block className="as-skeleton-copy"/><Block className="as-skeleton-button"/></Card></>; }

/** A route-shaped placeholder that preserves each page's layout while it loads. */
export function WorkspacePageSkeleton({ route }: { route: WorkspaceRoute }) {
  const skeletons: Record<WorkspaceRoute, ReactNode> = {
    overview: <OverviewSkeleton/>, activity: <ActivitySkeleton/>, manage: <ManageSkeleton/>, automations: <AutomationsSkeleton/>, account: <AccountSkeleton/>, insights: <InsightsSkeleton/>, schedule: <ScheduleSkeleton/>, inbox: <InboxSkeleton/>, tasks: <TasksSkeleton/>, moon: <MoonSkeleton/>, marketplace: <MarketplaceSkeleton/>, settings: <SettingsSkeleton/>, "not-found": <NotFoundSkeleton/>,
  };
  return <div className="as-page-skeleton" role="status" aria-label="Loading page">{skeletons[route]}</div>;
}
