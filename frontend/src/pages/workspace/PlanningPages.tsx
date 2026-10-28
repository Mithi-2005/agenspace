import { ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  BarChart,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  SampleDataBadge,
  StatCard,
  Switch,
  Tag,
} from "../../components/ui/workspaceUi";
import { navigateTo } from "../../routing/hashRoute";
import { moon } from "./pageHelpers";

export function AutomationsPage() {
  const [enabled, setEnabled] = useState([true, false, true]);
  return (
    <>
      <PageHeader
        title="Automations"
        description="Preview the routine work AgenSpace can coordinate."
        sample
        actions={<Button disabled>Coming soon</Button>}
      />
      <div className="as-stat-grid as-four">
        <StatCard label="Active" value="2" detail="Sample workflows" />
        <StatCard label="Runs today" value="5" detail="Preview" />
        <StatCard label="Time saved" value="35m" detail="This week" />
        <StatCard label="Needs review" value="0" detail="All clear" />
      </div>
      <div className="as-workflow-grid">
        {[
          "Morning briefing",
          "Important email follow-up",
          "Friday weekly review",
        ].map((name, index) => (
          <Card key={name}>
            <strong>{name}</strong>
            <p>
              {index === 0
                ? "Prepare a short plan for your day."
                : "A preview workflow awaiting real integrations."}
            </p>
            <div className="as-card-top">
              <Tag>Sample</Tag>
              <Switch
                label={`Enable ${name}`}
                checked={enabled[index]}
                onChange={(value) =>
                  setEnabled((items) =>
                    items.map((item, pos) => (pos === index ? value : item)),
                  )
                }
              />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
export function InsightsPage() {
  return (
    <>
      <PageHeader
        title="Insights"
        description={`Patterns from your preview workspace and ${moon} summaries.`}
        sample
      />
      <div className="as-grid as-insights">
        <Card>
          <strong>Weekly completion</strong>
          <BarChart values={[25, 52, 45, 76, 66, 54, 42]} />
        </Card>
        <Card>
          <div className="as-card-top">
            <strong>Focus-time trend</strong>
            <span>6 h 20 m</span>
          </div>
          <ProgressBar value={72} label="Weekly focus-time trend" />
          <p className="as-card-foot">Up 18% from last week</p>
        </Card>
        <Card className="as-wide-card">
          <strong>From {moon}</strong>
          <p className="as-summary">
            Your strongest focus window is between 09:00 and 11:00. Move one
            high priority task there tomorrow.
          </p>
          <Tag tone="hot">Example summary</Tag>
        </Card>
      </div>
    </>
  );
}
export function MoonPage() {
  const prompts = ["Summarise my day", "What is overdue?", "Plan tomorrow"];
  return (
    <>
      <PageHeader
        title={moon}
        description={`${moon} can help you decide what deserves your attention.`}
        sample
      />
      <Card className="as-chat">
        <div className="as-example">
          <SampleDataBadge />
          <p>
            <b>You</b> Summarise my day
          </p>
          <p>
            <b>{moon} · Example</b> Start with the project review, then reply to
            design feedback. Your calendar preview shows a design sync at 15:00.
          </p>
        </div>
        <div className="as-prompt-chips">
          {prompts.map((prompt) => (
            <button key={prompt}>{prompt}</button>
          ))}
        </div>
        <label className="as-disabled-input">
          <input disabled placeholder={`${moon} is coming soon`} />
          <Button disabled>Send</Button>
        </label>
        <small>
          Example conversation only. No live assistant endpoint is configured.
        </small>
      </Card>
    </>
  );
}
export { SettingsPage } from "../../features/settings/SettingsPage";
export function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="That workspace view is not available."
      />
      <Card>
        <EmptyState
          title="Nothing here yet"
          description="Return to your overview to keep working."
          action={
            <Button onClick={() => navigateTo("overview")}>
              Go to overview <ChevronRight size={15} />
            </Button>
          }
        />
      </Card>
    </>
  );
}
