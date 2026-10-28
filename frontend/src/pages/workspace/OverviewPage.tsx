import { Plus, Sparkles } from "lucide-react";
import {
  Button,
  Card,
  CountUp,
  PageHeader,
  ProgressBar,
  SampleDataBadge,
  StatCard,
  Tag,
  BarChart,
} from "../../components/ui/workspaceUi";
import { useAuth } from "../../context/useAuth";
import { useTasks } from "../../context/useTasks";
import { useDashboardSummary } from "../../features/workspace/hooks/useDashboardSummary";
import { navigateTo } from "../../routing/hashRoute";
import { ActivityList } from "./ActivityList";
import { greeting, moon, taskDue } from "./pageHelpers";
import { WorkspacePageSkeleton } from "../../components/workspace/WorkspacePageSkeleton";

export default function OverviewPage() {
  const { user } = useAuth();
  const { tasks, openComposer, isLoading: tasksLoading } = useTasks();
  const { summary, isLoading: summaryLoading } = useDashboardSummary();
  if (tasksLoading || summaryLoading) return <WorkspacePageSkeleton route="overview"/>;
  const open = tasks.filter((task) => task.status === "open");
  const dueToday = summary?.tasks_due_today ?? 0;
  const eventsToday =
    summary?.upcoming_events.filter(
      (event) =>
        new Date(event.starts_at).toDateString() === new Date().toDateString(),
    ).length ?? 0;
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.display_name ?? "there"}`}
        description={`${moon} has a calm view of what needs your attention next.`}
        sample
        actions={
          <Button onClick={() => openComposer()}>
            <Plus size={15} /> Add task
          </Button>
        }
      />
      <div className="as-grid as-overview-grid">
        <Card className="as-focus-card" reveal={0}>
          <div className="as-card-top">
            <span>Focus</span>
            <Tag tone="hot">{dueToday} due today</Tag>
          </div>
          <strong className="as-hero-number">
            <CountUp value={open.length} /> tasks left
          </strong>
          <p>Start with the project review before your afternoon opens up.</p>
          <div className="as-button-row">
            <Button onClick={() => openComposer()}>Add task</Button>
            <Button variant="soft" onClick={() => navigateTo("moon")}>
              Ask {moon}
            </Button>
          </div>
          <div className="as-inset-list">
            {open.slice(0, 3).map((task) => (
              <span key={task.id}>
                {task.title}
                <small>{taskDue(task)}</small>
              </span>
            ))}
          </div>
        </Card>
        <div className="as-stat-grid">
          <StatCard
            label="Due today"
            value={<CountUp value={dueToday} />}
            detail="From your saved tasks"
            hot
            reveal={1}
          />
          <StatCard
            label="Overdue"
            value={<CountUp value={summary?.tasks_overdue ?? 0} />}
            detail="From your saved tasks"
            reveal={2}
          />
          <StatCard
            label="Events today"
            value={<CountUp value={eventsToday} />}
            detail="From your saved calendar"
            reveal={3}
          />
          <StatCard
            label="Important emails"
            value={<CountUp value={3} />}
            detail="Preview only"
            reveal={4}
          />
        </div>
        <Card className="as-chart-card" reveal={5}>
          <div className="as-card-top">
            <div>
              <strong>Weekly completion</strong>
              <p>Completed versus planned</p>
            </div>
            <SampleDataBadge />
          </div>
          <BarChart values={[36, 48, 62, 82, 54, 69, 46]} />
          <div className="as-chart-days">
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>Today</span>
            <span>F</span>
            <span>S</span>
            <span>S</span>
          </div>
        </Card>
        <Card reveal={6}>
          <div className="as-card-top">
            <div>
              <strong>Focus time</strong>
              <p>Two hours protected today</p>
            </div>
            <strong>65%</strong>
          </div>
          <ProgressBar value={65} label="Focus time progress" />
          <p className="as-card-foot">1 h 18 min of 2 h</p>
        </Card>
        <Card className="as-wide-card" reveal={7}>
          <div className="as-card-top">
            <div>
              <strong>Recent activity</strong>
              <p>Small next actions from your workspace</p>
            </div>
            <SampleDataBadge />
          </div>
          <ActivityList limit={4} />
          <div className="as-moon-suggestion">
            <Sparkles size={15} />
            <span>
              <b>From {moon}</b> Turn the project review into a 45 minute focus
              block.
            </span>
            <Button variant="soft">Turn into task</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
