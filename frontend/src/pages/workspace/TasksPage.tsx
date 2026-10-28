import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  ProgressRing,
  SampleDataBadge,
  StatCard,
  Tabs,
  Tag,
} from "../../components/ui/workspaceUi";
import { useTasks } from "../../context/useTasks";
import { useDashboardSummary } from "../../features/workspace/hooks/useDashboardSummary";
import type { Task } from "../../types/tasks";
import { moon, taskDue } from "./pageHelpers";
import { WorkspacePageSkeleton } from "../../components/workspace/WorkspacePageSkeleton";

export default function TasksPage() {
  const { tasks, createTask, completeTask, reopenTask, isLoading } = useTasks();
  const { summary, isLoading: summaryLoading } = useDashboardSummary();
  const [tab, setTab] = useState("All");
  const [newTitle, setNewTitle] = useState("");
  const visible = useMemo(
    () =>
      tasks.filter(
        (task) =>
          tab === "All" ||
          (tab === "Done"
            ? task.status === "completed"
            : tab === "Today"
              ? task.due_at?.slice(0, 10) ===
                new Date().toISOString().slice(0, 10)
              : task.status !== "completed"),
      ),
    [tasks, tab],
  );
  if (isLoading || summaryLoading) return <WorkspacePageSkeleton route="tasks"/>;
  const add = async () => {
    if (!newTitle.trim()) return;
    await createTask({
      title: newTitle.trim(),
      priority: "medium",
      due_at: new Date().toISOString(),
    });
    setNewTitle("");
  };
  const complete = async (task: Task) => {
    if (task.status === "completed") await reopenTask(task.id);
    else await completeTask(task.id);
  };
  return (
    <>
      <PageHeader
        title="Tasks"
        description="Move the work that matters forward, one clear next step at a time."
      />
      <div className="as-stat-grid as-four">
        <StatCard
          label="Open"
          value={tasks.filter((t) => t.status === "open").length.toString()}
          detail="Saved to your account"
        />
        <StatCard
          label="Due today"
          value={(summary?.tasks_due_today ?? 0).toString()}
          detail="Need attention"
          hot
        />
        <StatCard
          label="Upcoming"
          value={tasks
            .filter(
              (task) =>
                task.status === "open" &&
                task.due_at &&
                new Date(task.due_at) > new Date(),
            )
            .length.toString()}
          detail="Scheduled ahead"
        />
        <StatCard
          label="Done"
          value={tasks
            .filter((t) => t.status === "completed")
            .length.toString()}
          detail="Completed"
        />
      </div>
      <Card className="as-wide-card">
        <Tabs
          tabs={["All", "Today", "Upcoming", "Done"]}
          active={tab}
          onChange={setTab}
        />
        <DataTable label="Tasks">
          <thead>
            <tr>
              <th>Done</th>
              <th>Title</th>
              <th>List</th>
              <th>Priority</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((task) => (
              <tr key={task.id}>
                <td>
                  <input
                    aria-label={`Complete ${task.title}`}
                    type="checkbox"
                    checked={task.status === "completed"}
                    onChange={() => void complete(task)}
                  />
                </td>
                <td>
                  <b>{task.title}</b>
                </td>
                <td>{task.description ? "Personal" : "Inbox"}</td>
                <td>
                  <Tag tone={task.priority === "high" ? "hot" : "neutral"}>
                    {task.priority}
                  </Tag>
                </td>
                <td>{taskDue(task)}</td>
                <td>{task.status === "completed" ? "Done" : "Open"}</td>
              </tr>
            ))}
            <tr className="as-add-row">
              <td />
              <td colSpan={5}>
                <input
                  value={newTitle}
                  disabled={isLoading}
                  onChange={(event) => setNewTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void add();
                  }}
                  placeholder="Add a task to your account"
                />
                <button onClick={() => void add()} aria-label="Add task">
                  <Plus size={15} />
                </button>
              </td>
            </tr>
          </tbody>
        </DataTable>
      </Card>
      <div className="as-goal-grid">
        <Card>
          <div className="as-card-top">
            <strong>Suggested by {moon}</strong>
            <SampleDataBadge />
          </div>
          <p>Reserve a 45 minute block for the project review.</p>
          <Button variant="soft">Add task</Button>
        </Card>
        {["Deep work", "Weekly goals"].map((goal, index) => (
          <Card key={goal}>
            <div className="as-goal">
              <ProgressRing label={goal} value={index ? 70 : 58} />
              <div>
                <strong>{goal}</strong>
                <p>
                  {index ? "7 of 10 planned tasks" : "2 h 18 min this week"}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
