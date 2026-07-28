import { BridgeEvent, BridgeReminder } from "./types";
import { formatTime } from "./date-utils";

export interface AgendaCallbacks {
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onReload: () => void;
  onDatePick: (date: string) => void;
  onEventClick: (event: BridgeEvent) => void;
  /** Open the reminder in Reminders.app. */
  onReminderClick: (reminder: BridgeReminder) => void;
  /** Open the note the reminder was created from, if it has one. */
  onReminderOpenNote: (reminder: BridgeReminder) => void;
}

export function renderHeader(
  container: HTMLElement,
  dateLabel: string,
  callbacks: AgendaCallbacks
): void {
  const header = container.createDiv({ cls: "apple-eventkit-header" });

  const nav = header.createDiv({ cls: "apple-eventkit-nav" });
  nav.createEl("button", { text: "\u25C0", cls: "apple-eventkit-nav-btn" })
    .addEventListener("click", callbacks.onPrevDay);

  const dateEl = nav.createEl("span", {
    text: dateLabel,
    cls: "apple-eventkit-date-label",
  });
  dateEl.addEventListener("click", () => {
    const input = header.querySelector(
      ".apple-eventkit-date-input"
    ) as HTMLInputElement | null;
    if (input) (input as any).showPicker();
  });

  nav.createEl("button", { text: "\u25B6", cls: "apple-eventkit-nav-btn" })
    .addEventListener("click", callbacks.onNextDay);

  const actions = header.createDiv({ cls: "apple-eventkit-actions" });
  actions
    .createEl("button", { text: "Today", cls: "apple-eventkit-btn" })
    .addEventListener("click", callbacks.onToday);
  actions
    .createEl("button", { text: "\u21BB Reload", cls: "apple-eventkit-btn" })
    .addEventListener("click", callbacks.onReload);

  const dateInput = header.createEl("input", {
    cls: "apple-eventkit-date-input",
    type: "date",
  });
  dateInput.addEventListener("change", () => {
    if (dateInput.value) callbacks.onDatePick(dateInput.value);
  });
}

/**
 * A single row in the agenda: either a calendar event or a reminder due that day.
 * Apple Calendar interleaves the two rather than separating them, so we do the
 * same -- all-day items first, then everything else in time order.
 */
export type AgendaItem =
  | { kind: "event"; event: BridgeEvent }
  | { kind: "reminder"; reminder: BridgeReminder };

/** All-day reminders carry a date-only `dueDate`, timed ones a full ISO string. */
function reminderIsAllDay(reminder: BridgeReminder): boolean {
  return reminder.isAllDay || !(reminder.dueDate ?? "").includes("T");
}

function itemIsAllDay(item: AgendaItem): boolean {
  return item.kind === "event"
    ? item.event.isAllDay
    : reminderIsAllDay(item.reminder);
}

/** Sort key within the timed group: the event start, or the reminder due time. */
function itemTime(item: AgendaItem): number {
  const iso =
    item.kind === "event" ? item.event.startDate : item.reminder.dueDate ?? "";
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
}

export function sortAgendaItems(items: AgendaItem[]): AgendaItem[] {
  const allDay = items.filter(itemIsAllDay);
  const timed = items
    .filter((i) => !itemIsAllDay(i))
    .sort((a, b) => itemTime(a) - itemTime(b));
  return [...allDay, ...timed];
}

export function renderAgendaList(
  container: HTMLElement,
  items: AgendaItem[],
  noteEventIds: Set<string>,
  callbacks: AgendaCallbacks
): void {
  const list = container.createDiv({ cls: "apple-eventkit-events" });
  for (const item of sortAgendaItems(items)) {
    if (item.kind === "event") {
      renderEventRow(list, item.event, noteEventIds.has(item.event.id), callbacks);
    } else {
      renderReminderRow(list, item.reminder, callbacks);
    }
  }
}

function isPastEvent(event: BridgeEvent): boolean {
  return new Date(event.endDate) < new Date();
}

function renderEventRow(
  container: HTMLElement,
  event: BridgeEvent,
  hasNote: boolean,
  callbacks: AgendaCallbacks
): void {
  const cls = isPastEvent(event)
    ? "apple-eventkit-event-row apple-eventkit-past"
    : "apple-eventkit-event-row";
  const row = container.createDiv({ cls });
  row.addEventListener("click", () => callbacks.onEventClick(event));

  const dot = row.createEl("span", { cls: "apple-eventkit-dot" });
  dot.style.backgroundColor = event.calendarColor;

  const info = row.createDiv({ cls: "apple-eventkit-event-info" });
  const timeStr = event.isAllDay
    ? "All day"
    : `${formatTime(event.startDate)} - ${formatTime(event.endDate)}`;
  info.createEl("span", { text: timeStr, cls: "apple-eventkit-event-time" });

  const titleCls = hasNote
    ? "apple-eventkit-event-title apple-eventkit-linked"
    : "apple-eventkit-event-title";
  info.createEl("span", { text: event.title, cls: titleCls });
}

/**
 * Reminders render in the same shape as events -- a coloured dot from their list,
 * a time and a title -- plus a checkbox to complete them in place.
 */
function renderReminderRow(
  container: HTMLElement,
  reminder: BridgeReminder,
  callbacks: AgendaCallbacks
): void {
  const allDay = reminderIsAllDay(reminder);
  const overdue =
    !allDay && !!reminder.dueDate && new Date(reminder.dueDate) < new Date();
  const row = container.createDiv({
    cls: overdue
      ? "apple-eventkit-event-row apple-eventkit-reminder-row apple-eventkit-past"
      : "apple-eventkit-event-row apple-eventkit-reminder-row",
  });

  row.addEventListener("click", () => callbacks.onReminderClick(reminder));

  const dot = row.createEl("span", { cls: "apple-eventkit-dot" });
  dot.style.backgroundColor = reminder.listColor;

  const info = row.createDiv({ cls: "apple-eventkit-event-info" });
  const timeStr = allDay
    ? `All day \u00B7 ${reminder.listTitle}`
    : `${formatTime(reminder.dueDate as string)} \u00B7 ${reminder.listTitle}`;
  info.createEl("span", { text: timeStr, cls: "apple-eventkit-event-time" });
  info.createEl("span", {
    text: reminder.title,
    cls: "apple-eventkit-event-title",
  });

  // Reminders created from a note carry an obsidian:// link back to it.
  if (reminder.url) {
    const link = row.createEl("span", {
      text: "\u2197",
      cls: "apple-eventkit-reminder-link",
      attr: { "aria-label": "Open source note" },
    });
    link.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onReminderOpenNote(reminder);
    });
  }
}

export function renderEmptyState(container: HTMLElement): void {
  container.createDiv({
    text: "Nothing scheduled for this day.",
    cls: "apple-eventkit-empty",
  });
}

export function renderLoading(container: HTMLElement): void {
  container.createDiv({
    text: "Loading events...",
    cls: "apple-eventkit-loading",
  });
}

export function renderError(container: HTMLElement, message: string): void {
  container.createDiv({
    text: message,
    cls: "apple-eventkit-error",
  });
}
