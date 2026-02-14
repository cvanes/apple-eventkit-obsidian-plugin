import { App, SuggestModal } from "obsidian";
import { BridgeEvent } from "./types";
import { formatTime } from "./date-utils";

export class EventPickerModal extends SuggestModal<BridgeEvent> {
  events: BridgeEvent[];
  onSelect: (event: BridgeEvent) => void;

  constructor(
    app: App,
    events: BridgeEvent[],
    onSelect: (event: BridgeEvent) => void,
    placeholder = "Pick an event..."
  ) {
    super(app);
    this.events = events;
    this.onSelect = onSelect;
    this.setPlaceholder(placeholder);
  }

  getSuggestions(query: string): BridgeEvent[] {
    const lower = query.toLowerCase();
    return this.events.filter((e) =>
      e.title.toLowerCase().includes(lower)
    );
  }

  renderSuggestion(event: BridgeEvent, el: HTMLElement): void {
    const title = el.createEl("strong", { text: event.title });
    const detail = ` @ ${formatRelativeDate(event)} (${event.calendarTitle})`;
    title.insertAdjacentText("afterend", detail);
  }

  onChooseSuggestion(event: BridgeEvent): void {
    this.onSelect(event);
  }
}

function formatRelativeDate(event: BridgeEvent): string {
  if (event.isAllDay) return `${dayLabel(event.startDate)}, All day`;
  return `${dayLabel(event.startDate)} ${formatTime(event.startDate)}`;
}

function dayLabel(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = stripTime(now);
  const target = stripTime(date);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
