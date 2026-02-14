import { Editor, Notice, Plugin } from "obsidian";
import { chmodSync } from "fs";
import { execFile } from "child_process";
import { join } from "path";
import { BridgeEvent, DEFAULT_SETTINGS, PluginSettings } from "./types";
import { AppleCalendarSettingTab } from "./settings";
import { AgendaView, VIEW_TYPE_AGENDA } from "./agenda-view";
import { fetchEvents } from "./bridge";
import { formatDateForCli, addDays, startOfDay } from "./date-utils";
import { createOrOpenEventNote, linkNoteToEvent, unlinkNoteFromEvent } from "./note-manager";
import { EventPickerModal } from "./event-picker-modal";
import { CreateReminderModal } from "./create-reminder-modal";

export default class AppleCalendarPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_AGENDA, (leaf) => new AgendaView(leaf, this));
    this.addSettingTab(new AppleCalendarSettingTab(this.app, this));
    this.registerCommands();

    this.addRibbonIcon("calendar", "Apple EventKit", () => {
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
      id: "create-note-for-event",
      name: "Create note for event",
      callback: () => this.pickEventAndCreateNote(),
    });

    this.addCommand({
      id: "link-note-to-event",
      name: "Link note to calendar event",
      checkCallback: (checking) => {
        if (!this.app.workspace.getActiveFile()) return false;
        if (!checking) this.pickEventAndLinkNote();
        return true;
      },
    });

    this.addCommand({
      id: "unlink-note-from-event",
      name: "Unlink note from calendar event",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter?.["event-id"]) return false;
        if (!checking) unlinkNoteFromEvent(this.app);
        return true;
      },
    });

    this.addCommand({
      id: "create-reminder-from-selection",
      name: "Create reminder from selection",
      editorCallback: (editor: Editor) => {
        this.createReminderFromSelection(editor);
      },
    });

    this.addCommand({
      id: "open-event-in-calendar",
      name: "Open event in Calendar",
      checkCallback: (checking) => {
        const date = this.getActiveEventDate();
        if (!date) return false;
        if (!checking) this.openDateInCalendar(date);
        return true;
      },
    });

    this.addCommand({
      id: "reload-calendars",
      name: "Reload calendars",
      callback: () => this.reloadCalendars(),
    });
  }

  private async fetchUpcomingEvents(): Promise<BridgeEvent[]> {
    const now = new Date();
    const today = startOfDay(now);
    const from = formatDateForCli(today);
    const to = formatDateForCli(addDays(today, 30));
    const allEvents = await fetchEvents(this.resolveBridgePath(), from, to);
    return allEvents
      .filter((e) => new Date(e.endDate) >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  private async pickEventAndCreateNote(): Promise<void> {
    try {
      const events = await this.fetchUpcomingEvents();
      new EventPickerModal(this.app, events, (event) => {
        createOrOpenEventNote(this.app, event, this.settings);
      }).open();
    } catch (e) {
      new Notice(`Failed to load events: ${e}`);
    }
  }

  private async pickEventAndLinkNote(): Promise<void> {
    try {
      const events = await this.fetchUpcomingEvents();
      new EventPickerModal(this.app, events, (event) => {
        linkNoteToEvent(this.app, event, this.settings);
      }, "Pick an event to link to this note...").open();
    } catch (e) {
      new Notice(`Failed to load events: ${e}`);
    }
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
      (reminderId) => {
        const link = `[${selection} 🔔](x-apple-reminderkit://REMCDReminder/${reminderId})`;
        editor.replaceSelection(link);
      }
    ).open();
  }

  private async reloadCalendars(): Promise<void> {
    const settingTab = new AppleCalendarSettingTab(this.app, this);
    await settingTab.refreshCalendars();
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENDA);
    for (const leaf of leaves) {
      if (leaf.view instanceof AgendaView) {
        await leaf.view.refresh();
      }
    }
    new Notice("Calendars reloaded.");
  }

  private getActiveEventDate(): string | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.["event-date"] ?? null;
  }

  private openDateInCalendar(dateStr: string): void {
    const d = new Date(dateStr + "T00:00:00");
    const script = [
      "tell application \"Calendar\"",
      "activate",
      "set d to current date",
      `set year of d to ${d.getFullYear()}`,
      `set month of d to ${d.getMonth() + 1}`,
      `set day of d to ${d.getDate()}`,
      "view calendar at d",
      "end tell",
    ].join("\n");
    execFile("osascript", ["-e", script], (err) => {
      if (err) new Notice(`Failed to open Calendar: ${err.message}`);
    });
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

  resolveBridgePath(): string {
    if (this.settings.bridgePath) return this.settings.bridgePath;
    return this.bundledCliPath();
  }

  private bundledCliPath(): string {
    const vaultPath = (this.app.vault.adapter as any).getBasePath();
    const cliPath = join(vaultPath, this.manifest.dir!, "eventkitcli-bin");
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
