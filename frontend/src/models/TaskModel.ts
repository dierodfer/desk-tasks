import type { Task } from "../wailsjs/go/main/App";
import type { Locale, Translator } from "../i18";

const PRIORITY_ORDER: Readonly<Record<string, number>> = Object.freeze({
    high: 0,
    medium: 1,
    low: 2,
  });

export class TaskModel {
  constructor(public readonly value: Task) {}

  get isPending(): boolean {
    return this.value.status === "pending";
  }

  get isCompleted(): boolean {
    return this.value.status === "completed";
  }

  get isOnHold(): boolean {
    return this.value.status === "on_hold";
  }

  static sortByPriorityAndOrder(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      return pa !== pb ? pa - pb : a.order - b.order;
    });
  }

  static sortOnHold(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      const aHasDate = a.holdUntil.trim().length > 0;
      const bHasDate = b.holdUntil.trim().length > 0;
      if (aHasDate && bHasDate) {
        const ad = new Date(a.holdUntil).getTime();
        const bd = new Date(b.holdUntil).getTime();
        if (Number.isFinite(ad) && Number.isFinite(bd) && ad !== bd) {
          return ad - bd;
        }
      }
      if (aHasDate !== bHasDate) {
        return aHasDate ? -1 : 1;
      }
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      return pa !== pb ? pa - pb : a.order - b.order;
    });
  }

  static formatHoldNote(task: Task, locale: Locale, t: Translator): string {
    if (task.holdUntil.trim().length === 0) {
      return t("holdIndefiniteBadge");
    }

    const date = new Date(task.holdUntil);
    if (Number.isNaN(date.getTime())) {
      return t("holdIndefiniteBadge");
    }

    const localeTag = locale === "es" ? "es-ES" : "en-US";
    const formatter = new Intl.DateTimeFormat(localeTag, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    return t("holdUntilLabel", { date: formatter.format(date) });
  }
}