import { ItemView, WorkspaceLeaf } from "obsidian";
import type AppleCalendarPlugin from "./main";
import { BridgeEvent, BridgeReminder } from "./types";
import { fetchEvents, fetchReminders, completeReminder } from "./bridge";
import {
  createOrOpenEventNote,
  syncNoteWithEvent,
  buildEventNoteIndex,
  noteKey,
  eventDateString,
  type EventNoteIndex,
} from "./note-manager";
import {
  formatDateForDisplay,
  formatDateForCli,
  addDays,
  startOfDay,
} from "./date-utils";
import {
  AgendaCallbacks,
  renderHeader,
  renderAgendaList,
  renderEmptyState,
  renderLoading,
  renderError,
  type AgendaItem,
} from "./agenda-renderer";

export const VIEW_TYPE_AGENDA = "apple-eventkit-agenda";

export class AgendaView extends ItemView {
  plugin: AppleCalendarPlugin;
  currentDate: Date = startOfDay(new Date());
  events: BridgeEvent[] = [];
  private noteIndex: EventNoteIndex = new Map();
  reminders: BridgeReminder[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: AppleCalendarPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_AGENDA;
  }

  getDisplayText(): string {
    return "Apple EventKit";
  }

  getIcon(): string {
    return "calendar-days";
  }

  private refreshTimer: number | null = null;

  /** The day the view was showing when it last rendered, to detect a rollover. */
  private renderedForToday = true;

  async onOpen(): Promise<void> {
    await this.refresh();
    this.refreshTimer = window.setInterval(() => this.refresh(), 5 * 60_000);
    this.register(() => {
      if (this.refreshTimer) window.clearInterval(this.refreshTimer);
    });

    // A five-minute timer alone leaves the view stale: it does not fire while the
    // machine is asleep, so reopening the laptop can show yesterday's agenda for
    // several minutes. Refresh whenever the window regains attention.
    this.registerDomEvent(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") void this.refresh();
    });
    this.registerDomEvent(window, "focus", () => void this.refresh());
  }

  /**
   * Roll the view onto the new day when midnight passes.
   *
   * Only applies when the view was already showing today: if the user has
   * navigated to another date deliberately, leave them there.
   */
  private advanceIfDayChanged(): void {
    if (!this.renderedForToday) return;
    const today = startOfDay(new Date());
    if (today.getTime() !== this.currentDate.getTime()) {
      this.currentDate = today;
    }
  }

  async refresh(): Promise<void> {
    this.advanceIfDayChanged();
    this.renderedForToday =
      this.currentDate.getTime() === startOfDay(new Date()).getTime();

    const container = this.contentEl;
    container.empty();

    const callbacks = this.createCallbacks();
    renderHeader(
      container,
      formatDateForDisplay(this.currentDate),
      callbacks
    );

    renderLoading(container);

    try {
      this.events = await this.loadEvents();
      this.reminders = await this.loadReminders();
      this.noteIndex = buildEventNoteIndex(this.app);
      await this.syncLinkedNotes();
      this.renderContent(container, callbacks);
    } catch (e) {
      container.querySelector(".apple-eventkit-loading")?.remove();
      renderError(container, `Failed to load events: ${e}`);
    }
  }

  private renderContent(
    container: HTMLElement,
    callbacks: AgendaCallbacks
  ): void {
    container.querySelector(".apple-eventkit-loading")?.remove();

    if (this.events.length === 0 && this.reminders.length === 0) {
      renderEmptyState(container);
      return;
    }

    const items: AgendaItem[] = [
      ...this.events.map((event) => ({ kind: "event" as const, event })),
      ...this.reminders.map((reminder) => ({ kind: "reminder" as const, reminder })),
    ];
    renderAgendaList(container, items, this.findLinkedEventIds(), callbacks);
  }

  /**
   * Reminders due on the selected day. Returns nothing when the setting is off,
   * so the extra CLI call only happens for users who asked for it.
   */
  private async loadReminders(): Promise<BridgeReminder[]> {
    if (!this.plugin.settings.showRemindersInAgenda) return [];
    const lists = this.plugin.settings.agendaReminderLists;
    const day = formatDateForCli(this.currentDate);
    const nextDay = formatDateForCli(addDays(this.currentDate, 1));
    try {
      const requested = lists.length > 0 ? lists : [undefined];
      const batches = await Promise.all(
        requested.map((list) =>
          fetchReminders(this.plugin.resolveBridgePath(), {
            list,
            incompleteOnly: true,
            dueBefore: `${nextDay}T00:00:00Z`,
          })
        )
      );
      // dueBefore is an upper bound only, so drop anything before the day itself.
      return batches.flat().filter((r) => (r.dueDate ?? "") >= day);
    } catch (e) {
      // A reminders failure should not blank out the agenda.
      console.error("Failed to load reminders", e);
      return [];
    }
  }

  private async loadEvents(): Promise<BridgeEvent[]> {
    const dateStr = formatDateForCli(this.currentDate);
    const enabledIds = this.getEnabledCalendarIds();
    const events = await fetchEvents(
      this.plugin.resolveBridgePath(),
      dateStr,
      dateStr,
      enabledIds.length > 0 ? enabledIds : undefined
    );
    if (this.plugin.settings.hideAllDayInAgenda) {
      return events.filter((e) => !e.isAllDay);
    }
    return events;
  }

  private getEnabledCalendarIds(): string[] {
    return this.plugin.settings.calendarToggles
      .filter((t) => t.enabled)
      .map((t) => t.id);
  }

  private async syncLinkedNotes(): Promise<void> {
    for (const event of this.events) {
      await syncNoteWithEvent(this.app, event, this.noteIndex);
    }
  }

  /** Event ids that already have a note, for the current day's events only. */
  findLinkedEventIds(): Set<string> {
    const ids = new Set<string>();
    for (const event of this.events) {
      const hasNote =
        this.noteIndex.has(noteKey(event.id, eventDateString(event))) ||
        this.noteIndex.has(event.id);
      if (hasNote) ids.add(event.id);
    }
    return ids;
  }

  private createCallbacks(): AgendaCallbacks {
    return {
      onPrevDay: () => this.navigateDay(-1),
      onNextDay: () => this.navigateDay(1),
      onToday: () => this.goToToday(),
      onReload: () => this.refresh(),
      onDatePick: (date) => this.goToDate(date),
      onEventClick: (event) => this.handleEventClick(event),
      onReminderToggle: (reminder) => this.handleReminderToggle(reminder),
      onReminderOpen: (reminder) => this.handleReminderOpen(reminder),
    };
  }

  private async navigateDay(offset: number): Promise<void> {
    this.currentDate = addDays(this.currentDate, offset);
    this.renderedForToday = false;
    await this.refresh();
  }

  async showToday(): Promise<void> {
    this.currentDate = startOfDay(new Date());
    await this.refresh();
  }

  private async goToToday(): Promise<void> {
    await this.showToday();
  }

  private async goToDate(dateStr: string): Promise<void> {
    this.currentDate = startOfDay(new Date(dateStr + "T00:00:00"));
    this.renderedForToday = false;
    await this.refresh();
  }

  private async handleReminderToggle(reminder: BridgeReminder): Promise<void> {
    try {
      await completeReminder(this.plugin.resolveBridgePath(), reminder.id);
      await this.refresh();
    } catch (e) {
      renderError(this.contentEl, `Failed to complete reminder: ${e}`);
    }
  }

  private handleReminderOpen(reminder: BridgeReminder): void {
    if (reminder.url) window.open(reminder.url);
  }

  private async handleEventClick(event: BridgeEvent): Promise<void> {
    await createOrOpenEventNote(this.app, event, this.plugin.settings, this.noteIndex);
    await this.refresh();
  }
}
