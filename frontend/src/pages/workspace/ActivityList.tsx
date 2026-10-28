import { Check, Clock3, Mail } from "lucide-react";
import { activityRows } from "./pageHelpers";

export function ActivityList({ limit }: { limit?: number }) {
  return (
    <div className="as-activity-list">
      {activityRows.slice(0, limit).map((item) => (
        <article key={item.id}>
          <span className="as-activity-icon">
            {item.type === "Email" ? (
              <Mail size={15} />
            ) : item.type === "Task" ? (
              <Check size={15} />
            ) : (
              <Clock3 size={15} />
            )}
          </span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </div>
          <small>{item.time}</small>
        </article>
      ))}
    </div>
  );
}
