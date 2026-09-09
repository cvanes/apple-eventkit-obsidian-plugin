import { App, SuggestModal } from "obsidian";
import { BridgeEvent, BridgeReminder } from "./types";
import { formatTime, dueDay } from "./date-utils";

interface Description {
  title: string;
  detail: string;
}

/** Fuzzy-by-title picker shared by the event and reminder commands. */
class ItemPickerModal<T> extends SuggestModal<T> {
  constructor(
    app: App,
    private items: T[],
    private describe: (item: T) => Description,
    private onSelect: (item: T) => void,
    placeholder: string
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getSuggestions(query: string): T[] {
    const lower = query.toLowerCase();
    return this.items.filter((item) =>
      this.describe(item).title.toLowerCase().includes(lower)
    );
  }

  renderSuggestion(item: T, el: HTMLElement): void {
    const { title, detail } = this.describe(item);
    el.createEl("strong", { text: title });
    el.appendText(detail);
  }

  onChooseSuggestion(item: T): void {
    this.onSelect(item);
  }
}

export function pickEvent(
  app: App,
  events: BridgeEvent[],
  onSelect: (event: BridgeEvent) => void,
  placeholder = "Pick an event..."
): void {
  new ItemPickerModal(app, events, describeEvent, onSelect, placeholder).open();
}

export function pickReminder(
  app: App,
  reminders: BridgeReminder[],
  onSelect: (reminder: BridgeReminder) => void,
  placeholder = "Pick a reminder..."
): void {
  new ItemPickerModal(app, reminders, describeReminder, onSelect, placeholder).open();
}

function describeEvent(event: BridgeEvent): Description {
  const when = event.isAllDay
    ? `${dayLabel(event.startDate)}, All day`
    : `${dayLabel(event.startDate)} ${formatTime(event.startDate)}`;
  return { title: event.title, detail: ` @ ${when} (${event.calendarTitle})` };
}

function describeReminder(reminder: BridgeReminder): Description {
  const when = reminder.dueDate ? ` @ ${dayLabel(reminder.dueDate)}` : "";
  return { title: reminder.title, detail: `${when} (${reminder.listTitle})` };
}

function dayLabel(isoString: string): string {
  const day = dueDay(isoString) as string;
  const target = new Date(day + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return target.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
