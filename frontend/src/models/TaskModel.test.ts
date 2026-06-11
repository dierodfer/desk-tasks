import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "../wailsjs/go/main/App";
import { TaskModel } from "./TaskModel.ts";
import { createTranslator } from "../i18/index.ts";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 0,
    name: "task",
    status: "pending",
    priority: "low",
    contact: "",
    order: 0,
    holdUntil: "",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("TaskModel.sortByPriorityAndOrder", () => {
  test("orders by priority first, then by insertion order", () => {
    const tasks = [
      makeTask({ id: 1, priority: "low", order: 1 }),
      makeTask({ id: 2, priority: "high", order: 2 }),
      makeTask({ id: 3, priority: "medium", order: 0 }),
      makeTask({ id: 4, priority: "high", order: 1 }),
    ];

    const sorted = TaskModel.sortByPriorityAndOrder(tasks).map((t) => t.id);

    assert.deepEqual(sorted, [4, 2, 3, 1]);
  });

  test("does not mutate the input array", () => {
    const tasks = [
      makeTask({ id: 1, priority: "low", order: 0 }),
      makeTask({ id: 2, priority: "high", order: 1 }),
    ];
    const original = [...tasks];

    TaskModel.sortByPriorityAndOrder(tasks);

    assert.deepEqual(tasks, original);
  });
});

describe("TaskModel.sortOnHold", () => {
  test("tasks with a hold date come before indefinite holds, ordered by date", () => {
    const tasks = [
      makeTask({ id: 1, holdUntil: "" }),
      makeTask({ id: 2, holdUntil: "2024-06-02T00:00:00Z" }),
      makeTask({ id: 3, holdUntil: "2024-06-01T00:00:00Z" }),
    ];

    const sorted = TaskModel.sortOnHold(tasks).map((t) => t.id);

    assert.deepEqual(sorted, [3, 2, 1]);
  });

  test("falls back to priority and order when dates are absent", () => {
    const tasks = [
      makeTask({ id: 1, priority: "low", order: 0, holdUntil: "" }),
      makeTask({ id: 2, priority: "high", order: 1, holdUntil: "" }),
    ];

    const sorted = TaskModel.sortOnHold(tasks).map((t) => t.id);

    assert.deepEqual(sorted, [2, 1]);
  });
});

describe("TaskModel.formatHoldNote", () => {
  test("returns the indefinite badge when holdUntil is empty", () => {
    const task = makeTask({ holdUntil: "" });
    const t = createTranslator("en");

    assert.equal(TaskModel.formatHoldNote(task, "en", t), "Indefinite");
  });

  test("returns the indefinite badge when holdUntil cannot be parsed", () => {
    const task = makeTask({ holdUntil: "not-a-date" });
    const t = createTranslator("en");

    assert.equal(TaskModel.formatHoldNote(task, "en", t), "Indefinite");
  });

  test("formats a valid holdUntil date using the locale", () => {
    const task = makeTask({ holdUntil: "2024-06-15T08:30:00Z" });
    const t = createTranslator("en");

    const note = TaskModel.formatHoldNote(task, "en", t);

    assert.match(note, /^Until /);
  });
});
