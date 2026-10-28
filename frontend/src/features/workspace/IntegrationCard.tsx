import type { Integration } from "../../data/workspace";
import { Button, Card, Tag } from "../../components/ui/workspaceUi";
import { Blocks, CalendarDays, GraduationCap, Mail, type LucideIcon } from "lucide-react";

interface IntegrationCardProps {
  integration: Integration;
  onConnect?: (integration: Integration) => void;
}

function IntegrationIcon({ id }: { id: Integration["id"] }) {
  const icons: Record<string, LucideIcon> = {
    gmail: Mail,
    calendar: CalendarDays,
    classroom: GraduationCap,
    plugins: Blocks,
  };
  const Icon = icons[id];
  return <span className={`as-integration-icon is-${id}`} aria-hidden="true"><Icon size={21}/></span>;
}

/** Shared, non-flipping integration presentation for Manage and Marketplace. */
export function IntegrationCard({ integration, onConnect }: IntegrationCardProps) {
  const tone = integration.status === "Available" ? "success" : integration.status === "Coming soon" ? "neutral" : "danger";
  return <Card className="as-integration-card"><div className="as-integration-card-top"><IntegrationIcon id={integration.id}/><Tag tone={tone}>{integration.status}</Tag></div><div><strong>{integration.name}</strong><p>{integration.description}</p></div>{integration.status === "Coming soon" ? <Button disabled>Coming soon</Button> : <Button variant="soft" onClick={() => onConnect?.(integration)}>Connect</Button>}</Card>;
}
