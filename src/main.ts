import { Editor, Notice, Plugin, TFile } from "obsidian";
import { chmodSync } from "fs";
import { join } from "path";
import { BridgeEvent, BridgeReminder, DEFAULT_SETTINGS, PluginSettings } from "./types";
import { AppleCalendarSettingTab } from "./settings";
import { AgendaView, VIEW_TYPE_AGENDA } from "./agenda-view";
import { confirmUnlink } from "./confirm-modal";
import { fetchEvents, fetchReminder, fetchReminders } from "./bridge";
import { formatDateForCli, addDays, startOfDay } from "./date-utils";
import {
  createOrOpenEventNote,
  createOrOpenReminderNote,
  linkNoteToEvent,
  linkNoteToReminder,
  unlinkNoteFromEvent,
  unlinkNoteFromReminder,
} from "./note-manager";
import { calendarLinkOf, reminderIdOf } from "./note-index";
import { openDateInCalendar, openReminderInApp } from "./open-in-app";
import { pickEvent, pickReminder } from "./picker-modal";
import { CreateReminderModal } from "./create-reminder-modal";

export default class AppleCalendarPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  async onload() {
    if (process.platform !== "darwin") {
      new Notice("Apple EventKit requires macOS.");
      return;
    }

    await this.loadSettings();

    this.registerView(VIEW_TYPE_AGENDA, (leaf) => new AgendaView(leaf, this));
    this.addSettingTab(new AppleCalendarSettingTab(this.app, this));
    this.registerCommands();

    this.addRibbonIcon("calendar-days", "Apple EventKit", () => {
      this.activateAgendaView();
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        if (!editor.getSelection().trim()) return;
        menu.addItem((item) =>
          item
            .setTitle("Create reminder")
            .setIcon("bell")
            .onClick(() => this.createReminderFromSelection(editor))
        );
      })
    );

    this.app.workspace.onLayoutReady(() => this.activateAgendaView());
  }

  private registerCommands(): void {
    this.addCommand({
      id: "open-agenda-view",
      name: "Open agenda view",
      callback: () => this.activateAgendaView(),
    });

    this.addCommand({
      id: "view-today",
      name: "View today",
      callback: () => this.activateAgendaViewToday(),
    });

    this.addCommand({
      id: "reload-calendars",
      name: "Reload calendars",
      callback: () => this.reloadCalendars(),
    });

    this.registerEventCommands();
    this.registerReminderCommands();
  }

  private registerEventCommands(): void {
    this.addCommand({
      id: "create-note-for-event",
      name: "Create/Open note for calendar event",
      callback: () => this.pickEventAndCreateNote(),
    });

    this.addCommand({
      id: "link-note-to-event",
      name: "Link note to calendar event",
      checkCallback: this.withActiveFile((file) => this.pickEventAndLinkNote(file)),
    });

    this.addCommand({
      id: "unlink-note-from-event",
      name: "Unlink note from calendar event",
      checkCallback: this.withLinkedFile(
        (file) => calendarLinkOf(this.app, file) !== null,
        async (file) => {
          if (!(await confirmUnlink(this.app, file))) return;
          await unlinkNoteFromEvent(this.app, file);
          new Notice("Unlinked from calendar event.");
        }
      ),
    });

    this.addCommand({
      id: "open-event-in-calendar",
      name: "Open calendar event in Calendar",
      checkCallback: this.withLinkedFile(
        (file) => calendarLinkOf(this.app, file) !== null,
        (file) => openDateInCalendar(calendarLinkOf(this.app, file)!.date)
      ),
    });
  }

  private registerReminderCommands(): void {
    this.addCommand({
      id: "create-note-for-reminder",
      name: "Create/Open note for reminder",
      callback: () => this.pickReminderAndCreateNote(),
    });

    this.addCommand({
      id: "link-note-to-reminder",
      name: "Link note to reminder",
      checkCallback: this.withActiveFile((file) => this.pickReminderAndLinkNote(file)),
    });

    this.addCommand({
      id: "unlink-note-from-reminder",
      name: "Unlink note from reminder",
      checkCallback: this.withLinkedFile(
        (file) => reminderIdOf(this.app, file) !== null,
        async (file) => {
          if (!(await confirmUnlink(this.app, file))) return;
          await unlinkNoteFromReminder(this.app, file, this.resolveBridgePath());
          new Notice("Unlinked from reminder.");
        }
      ),
    });

    this.addCommand({
      id: "open-reminder-in-reminders",
      name: "Open reminder in Reminders",
      checkCallback: this.withLinkedFile(
        (file) => reminderIdOf(this.app, file) !== null,
        (file) => this.openLinkedReminder(file)
      ),
    });

    this.addCommand({
      id: "create-reminder-from-selection",
      name: "Create reminder from selection",
      editorCallback: (editor: Editor) => {
        this.createReminderFromSelection(editor);
      },
    });
  }

  /** A checkCallback that is available whenever a note is active. */
  private withActiveFile(action: (file: TFile) => void) {
    return this.withLinkedFile(() => true, action);
  }

  /** A checkCallback that is available when the active note satisfies `isLinked`. */
  private withLinkedFile(isLinked: (file: TFile) => boolean, action: (file: TFile) => void) {
    return (checking: boolean): boolean => {
      const file = this.app.workspace.getActiveFile();
      if (!file || !isLinked(file)) return false;
      if (!checking) action(file);
      return true;
    };
  }

  // MARK: - Calendar events

  private async fetchUpcomingEvents(): Promise<BridgeEvent[]> {
    const now = new Date();
    const today = startOfDay(now);
    const from = formatDateForCli(today);
    const to = formatDateForCli(addDays(today, 30));
    const allEvents = await fetchEvents(this.resolveBridgePath(), from, to);
    return allEvents
      .filter((e) => new Date(e.endDate) >= now)
      .filter((e) => !this.settings.hideAllDayInModals || !e.isAllDay)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  private async pickEventAndCreateNote(): Promise<void> {
    await this.withEvents((events) =>
      pickEvent(this.app, events, (event) => {
        createOrOpenEventNote(this.app, event, this.settings);
      })
    );
  }

  private async pickEventAndLinkNote(file: TFile): Promise<void> {
    await this.withEvents((events) =>
      pickEvent(this.app, events, async (event) => {
        await linkNoteToEvent(this.app, file, event);
        new Notice(`Linked to: ${event.title}`);
      }, "Pick an event to link to this note...")
    );
  }

  private async withEvents(action: (events: BridgeEvent[]) => void): Promise<void> {
    try {
      action(await this.fetchUpcomingEvents());
    } catch (e) {
      new Notice(`Failed to load events: ${e}`);
    }
  }

  // MARK: - Reminders

  private fetchOpenReminders(): Promise<BridgeReminder[]> {
    return fetchReminders(this.resolveBridgePath(), { incompleteOnly: true });
  }

  private async pickReminderAndCreateNote(): Promise<void> {
    await this.withReminders((reminders) =>
      pickReminder(this.app, reminders, (reminder) => {
        this.tryReminderAction("Failed to create reminder note", () =>
          createOrOpenReminderNote(this.app, reminder, this.resolveBridgePath())
        );
      })
    );
  }

  private async pickReminderAndLinkNote(file: TFile): Promise<void> {
    await this.withReminders((reminders) =>
      pickReminder(this.app, reminders, (reminder) => {
        this.tryReminderAction("Failed to link reminder", async () => {
          await linkNoteToReminder(this.app, file, reminder, this.resolveBridgePath());
          new Notice(`Linked to: ${reminder.title}`);
        });
      }, "Pick a reminder to link to this note...")
    );
  }

  private async withReminders(action: (reminders: BridgeReminder[]) => void): Promise<void> {
    try {
      action(await this.fetchOpenReminders());
    } catch (e) {
      new Notice(`Failed to load reminders: ${e}`);
    }
  }

  private async tryReminderAction(failureMessage: string, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (e) {
      new Notice(`${failureMessage}: ${e}`);
    }
  }

  /** Reminders.app needs the external id, which the note does not hold, so look it up. */
  private async openLinkedReminder(file: TFile): Promise<void> {
    const id = reminderIdOf(this.app, file);
    if (!id) return;
    await this.tryReminderAction("Failed to open reminder", async () => {
      openReminderInApp(await fetchReminder(this.resolveBridgePath(), id));
    });
  }

  private createReminderFromSelection(editor: Editor): void {
    const selection = editor.getSelection().trim();
    if (!selection) {
      new Notice("Select some text first to create a reminder.");
      return;
    }

    new CreateReminderModal(
      this.app,
      selection,
      this.settings,
      this.resolveBridgePath(),
      this.buildNoteDeepLink()
    ).open();
  }

  /**
   * obsidian:// link to the active note, so a reminder created from a selection
   * carries a way back to its context. Stored in the reminder's URL field, which
   * Reminders renders as a tappable link.
   */
  private buildNoteDeepLink(): string | undefined {
    const file = this.app.workspace.getActiveFile();
    if (!file) return undefined;
    const vault = encodeURIComponent(this.app.vault.getName());
    const path = encodeURIComponent(file.path.replace(/\.md$/, ""));
    return `obsidian://open?vault=${vault}&file=${path}`;
  }

  // MARK: - Agenda view

  /** Re-render every open agenda leaf, e.g. after a settings change. */
  async refreshAgendaViews(): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENDA)) {
      if (leaf.view instanceof AgendaView) await leaf.view.refresh();
    }
  }

  private async reloadCalendars(): Promise<void> {
    const settingTab = new AppleCalendarSettingTab(this.app, this);
    await settingTab.refreshCalendars();
    await this.refreshAgendaViews();
    new Notice("Calendars reloaded.");
  }

  async activateAgendaViewToday(): Promise<void> {
    await this.activateAgendaView();
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENDA)[0];
    if (leaf?.view instanceof AgendaView) {
      await leaf.view.showToday();
    }
  }

  async activateAgendaView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENDA);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_AGENDA, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  // MARK: - Bridge

  resolveBridgePath(): string {
    if (this.settings.bridgePath) return this.settings.bridgePath;
    return this.bundledCliPath();
  }

  private bundledCliPath(): string {
    const vaultPath = (this.app.vault.adapter as any).getBasePath();
    const cliPath = join(vaultPath, this.manifest.dir!, "eventkitcli");
    this.ensureExecutable(cliPath);
    return cliPath;
  }

  private ensureExecutable(path: string): void {
    try {
      chmodSync(path, 0o755);
    } catch { /* binary may not exist yet */ }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
