import { useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  SampleDataBadge,
  Switch,
  Tag,
} from "../../components/ui/workspaceUi";
import { workspaceData } from "../../data/workspace";
import { IntegrationCard } from "../../features/workspace/IntegrationCard";
import { moon } from "./pageHelpers";

export function ManagePage() {
  const [flags, setFlags] = useState([true, false, true, false]);
  const labels = [
    "Read email summaries",
    "Create tasks from emails",
    "Calendar sync",
    `${moon} access`,
  ];
  return (
    <>
      <PageHeader
        title="Manage"
        description="Control which services and workspace capabilities are available."
        sample
      />
      <div className="as-integration-grid">
        {workspaceData.integrations.slice(0, 3).map((item) => (
          <IntegrationCard key={item.id} integration={item} />
        ))}
      </div>
      <Card className="as-controls">
        <div className="as-card-top">
          <div>
            <strong>Connection controls</strong>
            <p>These are local preview controls.</p>
          </div>
          <SampleDataBadge />
        </div>
        {labels.map((label, index) => (
          <div className="as-control" key={label}>
            <span>{label}</span>
            <Switch
              label={label}
              checked={flags[index]}
              onChange={(value) =>
                setFlags((values) =>
                  values.map((flag, position) =>
                    position === index ? value : flag,
                  ),
                )
              }
            />
          </div>
        ))}
        <label className="as-range-label">
          Daily briefing time{" "}
          <input type="range" min="7" max="20" defaultValue="9" />
          <span>09:00</span>
        </label>
      </Card>
    </>
  );
}

export function MarketplacePage() {
  return (
    <>
      <PageHeader
        title="Marketplace"
        description="Choose the services you want to make available in AgenSpace."
        sample
      />
      <div className="as-market-grid">
        {workspaceData.integrations.map((item) => (
          <IntegrationCard key={item.id} integration={item} />
        ))}
      </div>
    </>
  );
}

export function SchedulePage() {
  return (
    <>
      <PageHeader
        title="Schedule"
        description="Protect the blocks that matter and see upcoming deadlines."
        sample
      />
      <Card>
        <div className="as-week">
          {[
            "Mon 12",
            "Tue 13",
            "Wed 14",
            "Thu 15",
            "Fri 16",
            "Sat 17",
            "Sun 18",
          ].map((day, index) => (
            <button className={index === 3 ? "is-active" : ""} key={day}>
              {day}
            </button>
          ))}
        </div>
        <EmptyState
          title="No calendar connected"
          description="Connect Google Calendar to bring your agenda and deadlines here."
          action={<Button>Connect calendar</Button>}
        />
      </Card>
      <Card className="schedule-deadlines">
        <strong>Upcoming deadlines</strong>
        <div className="as-deadlines">
          {workspaceData.tasks.slice(0, 3).map((task) => (
            <span key={task.id}>
              {task.title}
              <Tag>{task.due}</Tag>
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}

export function InboxPage() {
  return (
    <>
      <PageHeader
        title="Inbox"
        description="Review important messages without leaving your workspace."
      />
      <EmptyState
        title="Gmail is not connected"
        description="Grant read-only access to surface important messages and extract task
            candidates. AgenSpace will never send email for you."
        action={<Button>Connect Gmail</Button>}
      />

    </>
  );
}
