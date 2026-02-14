import { App, FuzzySuggestModal } from "obsidian";
import { BridgeEvent } from "./types";
import { formatTime } from "./date-utils";

export class EventPickerModal extends FuzzySuggestModal<BridgeEvent> {
  events: BridgeEvent[];
  onSelect: (event: BridgeEvent) => void;

  constructor(
    app: App,
    events: BridgeEvent[],
    onSelect: (event: BridgeEvent) => void
  ) {
    super(app);
    this.events = events;
    this.onSelect = onSelect;
    this.setPlaceholder("Pick an event to create a note for...");
  }

  getItems(): BridgeEvent[] {
    return this.events;
  }

  getItemText(event: BridgeEvent): string {
    const time = event.isAllDay
      ? "All day"
      : `${formatTime(event.startDate)} - ${formatTime(event.endDate)}`;
    return `${event.title} — ${time} — ${event.calendarTitle}`;
  }

  onChooseItem(event: BridgeEvent): void {
    this.onSelect(event);
  }
}
