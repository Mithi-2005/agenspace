import type { ConnectionCatalog, ConnectionProvider } from "../types/connections";

export const CONNECTION_PROVIDERS: ConnectionProvider[] = [
  {
    id: "gmail",
    name: "Gmail",
    description:
      "Authorize Gmail so Kosway can later surface messages that may contain events or follow-ups. Nothing is scanned until an official connection exists.",
    category: "mail",
    status: "not_implemented",
    enables: ["Suggested follow-ups", "Detected events from mail"],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description:
      "A future calendar connection for upcoming commitments you have already accepted in Google Calendar.",
    category: "calendar",
    status: "not_implemented",
    enables: ["Upcoming events", "Agenda for the day"],
  },
  {
    id: "outlook-calendar",
    name: "Outlook Calendar",
    description:
      "A future calendar connection for Outlook-hosted events, kept separate from mail until you grant access.",
    category: "calendar",
    status: "not_implemented",
    enables: ["Upcoming events", "Agenda for the day"],
  },
];

export function getConnectionCatalog(): ConnectionCatalog {
  return {
    providers: CONNECTION_PROVIDERS,
    implementedCount: CONNECTION_PROVIDERS.filter((provider) => provider.status !== "not_implemented")
      .length,
  };
}
