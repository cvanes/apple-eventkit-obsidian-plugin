import { BridgeEvent } from "./types";
import { formatTime } from "./date-utils";

export interface AgendaCallbacks {
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onReload: () => void;
  onDatePick: (date: string) => void;
  onEventClick: (event: BridgeEvent) => void;
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

export function renderEventList(
  container: HTMLElement,
  events: BridgeEvent[],
  noteEventIds: Set<string>,
  callbacks: AgendaCallbacks
): void {
  const list = container.createDiv({ cls: "apple-eventkit-events" });
  const sorted = [...events].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  for (const event of sorted) {
    renderEventRow(list, event, noteEventIds.has(event.id), callbacks);
  }
}

function renderEventRow(
  container: HTMLElement,
  event: BridgeEvent,
  hasNote: boolean,
  callbacks: AgendaCallbacks
): void {
  const row = container.createDiv({ cls: "apple-eventkit-event-row" });
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

export function renderEmptyState(container: HTMLElement): void {
  container.createDiv({
    text: "No events for this day.",
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
