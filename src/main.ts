import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import { chmodSync } from "fs";
import { execFile } from "child_process";
import { join } from "path";
import { DEFAULT_SETTINGS, PluginSettings } from "./types";
import { AppleCalendarSettingTab } from "./settings";
import { AgendaView, VIEW_TYPE_AGENDA } from "./agenda-view";
import { fetchEvent, fetchEvents } from "./bridge";
import { formatDateForCli, addDays, startOfDay } from "./date-utils";
import { createOrOpenEventNote } from "./note-manager";
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
            .onClick(() => {
              const view = this.app.workspace.getActiveViewOfType(MarkdownView);
              if (view) this.createReminderFromSelection(editor, view);
            })
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
      id: "create-reminder-from-selection",
      name: "Create reminder from selection",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.createReminderFromSelection(editor, view);
      },
    });

    this.addCommand({
      id: "open-event-in-calendar",
      name: "Open event in Calendar",
      checkCallback: (checking) => {
        const eventId = this.getActiveEventId();
        if (!eventId) return false;
        if (!checking) this.openEventInCalendar(eventId);
        return true;
      },
    });

    this.addCommand({
      id: "reload-calendars",
      name: "Reload calendars",
      callback: () => this.reloadCalendars(),
    });
  }

  private async pickEventAndCreateNote(): Promise<void> {
    try {
      const now = new Date();
      const today = startOfDay(now);
      const from = formatDateForCli(today);
      const to = formatDateForCli(addDays(today, 30));
      const allEvents = await fetchEvents(this.resolveBridgePath(), from, to);
      const events = allEvents
        .filter((e) => new Date(e.endDate) >= now)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      new EventPickerModal(this.app, events, (event) => {
        createOrOpenEventNote(this.app, event, this.settings);
      }).open();
    } catch (e) {
      new Notice(`Failed to load events: ${e}`);
    }
  }

  private createReminderFromSelection(
    editor: Editor,
    view: MarkdownView
  ): void {
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
      async (reminderId, reminderTitle) => {
        await this.addReminderFrontmatter(view, reminderId, reminderTitle);
      }
    ).open();
  }

  private async addReminderFrontmatter(
    view: MarkdownView,
    reminderId: string,
    reminderTitle: string
  ): Promise<void> {
    const file = view.file;
    if (!file) return;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm["reminder-id"] = reminderId;
      fm["reminder-title"] = reminderTitle;
    });
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

  private getActiveEventId(): string | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.["event-id"] ?? null;
  }

  private async openEventInCalendar(eventId: string): Promise<void> {
    try {
      const event = await fetchEvent(this.resolveBridgePath(), eventId);
      const d = new Date(event.startDate);
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
    } catch (e) {
      new Notice(`Failed to open event: ${e}`);
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
