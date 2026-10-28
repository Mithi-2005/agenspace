export type Priority = "High" | "Medium" | "Low";
export type TaskStatus = "Open" | "Done" | "Overdue";
export interface WorkspaceTask {
  id: string;
  title: string;
  list: string;
  priority: Priority;
  due: string;
  status: TaskStatus;
}
export interface ActivityItem {
  id: string;
  type: "Task" | "Email" | "Event" | "Automation";
  title: string;
  detail: string;
  time: string;
}
export interface Integration {
  id: string;
  name: string;
  description: string;
  status: "Available" | "Not connected" | "Coming soon";
  permissions: string[];
}
export interface WorkspaceData {
  tasks: WorkspaceTask[];
  activity: ActivityItem[];
  integrations: Integration[];
}

export const workspaceData: WorkspaceData = {
  tasks: [
    {
      id: "t1",
      title: "Prepare project review",
      list: "Work",
      priority: "High",
      due: "Today, 10:30",
      status: "Open",
    },
    {
      id: "t2",
      title: "Reply to design feedback",
      list: "Work",
      priority: "High",
      due: "Today, 14:00",
      status: "Open",
    },
    {
      id: "t3",
      title: "Book focus time",
      list: "Personal",
      priority: "Medium",
      due: "Tomorrow",
      status: "Open",
    },
    {
      id: "t4",
      title: "Review weekly goals",
      list: "Planning",
      priority: "Low",
      due: "Friday",
      status: "Done",
    },
  ],
  activity: [
    {
      id: "a1",
      type: "Task",
      title: "Project review is due this morning",
      detail: "Moon found it in your plan",
      time: "8 min ago",
    },
    {
      id: "a2",
      type: "Email",
      title: "Three important emails need a reply",
      detail: "Preview only until Gmail is connected",
      time: "25 min ago",
    },
    {
      id: "a3",
      type: "Event",
      title: "Design sync starts at 15:00",
      detail: "Calendar preview",
      time: "1 hr ago",
    },
    {
      id: "a4",
      type: "Automation",
      title: "Daily briefing is ready",
      detail: "Sample workspace activity",
      time: "Today",
    },
  ],
  integrations: [
    {
      id: "gmail",
      name: "Gmail",
      description: "Spot follow-ups and important messages.",
      status: "Not connected",
      permissions: [
        "Read email summaries",
        "Extract task candidates",
        "Never send email",
      ],
    },
    {
      id: "calendar",
      name: "Google Calendar",
      description: "See your day and protect focus time.",
      status: "Not connected",
      permissions: [
        "Read calendar events",
        "Create focus blocks",
        "Sync selected calendars",
      ],
    },
    {
      id: "classroom",
      name: "Google Classroom",
      description: "Bring assignments into one place.",
      status: "Available",
      permissions: [
        "Read assignments",
        "Read due dates",
        "Create task suggestions",
      ],
    },
    {
      id: "plugins",
      name: "Developer plugins",
      description: "Extend your workspace with custom tools.",
      status: "Coming soon",
      permissions: ["Coming soon"],
    },
  ],
};
