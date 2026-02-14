import { ItemView, WorkspaceLeaf } from "obsidian";
import type AppleCalendarPlugin from "./main";
import { BridgeEvent } from "./types";
import { fetchEvents } from "./bridge";
import { createOrOpenEventNote } from "./note-manager";
import {
  formatDateForDisplay,
  formatDateForCli,
  addDays,
  startOfDay,
} from "./date-utils";
import {
  AgendaCallbacks,
  renderHeader,
  renderEventList,
  renderEmptyState,
  renderLoading,
  renderError,
} from "./agenda-renderer";

export const VIEW_TYPE_AGENDA = "apple-eventkit-agenda";

export class AgendaView extends ItemView {
  plugin: AppleCalendarPlugin;
  currentDate: Date = startOfDay(new Date());
  events: BridgeEvent[] = [];

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
    return "calendar";
  }

  private refreshTimer: number | null = null;

  async onOpen(): Promise<void> {
    await this.refresh();
    this.refreshTimer = window.setInterval(() => this.refresh(), 5 * 60_000);
    this.register(() => {
      if (this.refreshTimer) window.clearInterval(this.refreshTimer);
    });
  }

  async refresh(): Promise<void> {
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

    if (this.events.length === 0) {
      renderEmptyState(container);
      return;
    }

    const noteEventIds = this.findLinkedEventIds();
    renderEventList(container, this.events, noteEventIds, callbacks);
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
    return events;
  }

  private getEnabledCalendarIds(): string[] {
    return this.plugin.settings.calendarToggles
      .filter((t) => t.enabled)
      .map((t) => t.id);
  }

  findLinkedEventIds(): Set<string> {
    const ids = new Set<string>();
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const eventId = cache?.frontmatter?.["event-id"];
      if (eventId) ids.add(eventId);
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
    };
  }

  private async navigateDay(offset: number): Promise<void> {
    this.currentDate = addDays(this.currentDate, offset);
    await this.refresh();
  }

  private async goToToday(): Promise<void> {
    this.currentDate = startOfDay(new Date());
    await this.refresh();
  }

  private async goToDate(dateStr: string): Promise<void> {
    this.currentDate = startOfDay(new Date(dateStr + "T00:00:00"));
    await this.refresh();
  }

  private async handleEventClick(event: BridgeEvent): Promise<void> {
    await createOrOpenEventNote(this.app, event, this.plugin.settings);
    await this.refresh();
  }
}
