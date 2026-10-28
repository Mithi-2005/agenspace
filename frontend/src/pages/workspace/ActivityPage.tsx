import { useState } from "react";
import {
  Card,
  DataTable,
  PageHeader,
  SampleDataBadge,
  StatCard,
  Tabs,
  Tag,
} from "../../components/ui/workspaceUi";
import { ActivityList } from "./ActivityList";
import { activityRows } from "./pageHelpers";

export default function ActivityPage() {
  const [tab, setTab] = useState("All");
  const rows =
    tab === "All"
      ? activityRows
      : activityRows.filter((row) => row.type === tab.slice(0, -1));
  return (
    <>
      <PageHeader
        title="Activity"
        description="A clear record of what changed across your workspace."
        sample
      />
      <div className="as-stat-grid as-four">
        <StatCard label="Tasks completed" value="12" detail="This week" />
        <StatCard label="Emails reviewed" value="18" detail="Preview" />
        <StatCard label="Events attended" value="6" detail="This week" />
        <StatCard label="Automations" value="4" detail="Ran successfully" />
      </div>
      <Card className="as-wide-card">
        <Tabs
          tabs={["All", "Tasks", "Emails", "Events", "Automations"]}
          active={tab}
          onChange={setTab}
        />
        <DataTable label="Workspace activity">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Type</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <b>{row.title}</b>
                  <small>{row.detail}</small>
                </td>
                <td>
                  <Tag>{row.type}</Tag>
                </td>
                <td>{row.time}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
      <Card>
        <div className="as-card-top">
          <strong>Live feed</strong>
          <SampleDataBadge />
        </div>
        <ActivityList />
      </Card>
    </>
  );
}
