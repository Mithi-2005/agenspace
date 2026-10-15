import { describe, expect, it } from "vitest";
import { SessionTaskService } from "../services/taskService";

describe("session task service", () => {
  it("creates, completes, edits and removes session tasks", () => {
    const service = new SessionTaskService();
    const created = service.create({ title: " Confirm brief ", description: " notes ", priority: "high" });
    expect(created.title).toBe("Confirm brief");
    expect(created.status).toBe("open");
    expect(service.list()).toHaveLength(1);

    service.update(created.id, { status: "completed", title: "Confirm the brief" });
    const completed = service.list()[0];
    expect(completed.completed_at).toBeTruthy();
    expect(completed.status).toBe("completed");
    expect(completed.title).toBe("Confirm the brief");

    expect(service.remove(created.id)).toBe(true);
    expect(service.list()).toHaveLength(0);
  });

  it("does not claim a backend identifier contract beyond a local id", () => {
    const service = new SessionTaskService();
    const task = service.create({ title: "Local only" });
    expect(task.id).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(task, "serverId")).toBe(false);
  });
});
