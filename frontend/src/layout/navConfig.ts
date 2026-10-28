import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  Grid2X2,
  Inbox,
  Layers3,
  Settings,
} from "lucide-react";
import type { WorkspaceRoute } from "../routing/hashRoute";

export interface NavItem {
  route: WorkspaceRoute;
  label: string;
  icon?: LucideIcon;
}

export const sectionNav: NavItem[] = [
  { route: "overview", label: "Overview" },
  { route: "activity", label: "Activity" },
  { route: "manage", label: "Manage" },
  { route: "automations", label: "Automations" },
  { route: "account", label: "Account" },
  { route: "insights", label: "Insights" },
];

export const railNav: NavItem[] = [
  { route: "overview", label: "Overview", icon: Grid2X2 },
  { route: "schedule", label: "Schedule", icon: CalendarDays },
  { route: "inbox", label: "Inbox", icon: Inbox },
  { route: "tasks", label: "Tasks", icon: CheckSquare },
  { route: "moon", label: "Moon", icon: Bot },
  { route: "marketplace", label: "Marketplace", icon: Layers3 },
  { route: "settings", label: "Settings", icon: Settings },
];
