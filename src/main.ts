import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import { chmodSync } from "fs";
import { join } from "path";
import { DEFAULT_SETTINGS, PluginSettings } from "./types";
import { AppleCalendarSettingTab } from "./settings";
import { AgendaView, VIEW_TYPE_AGENDA } from "./agenda-view";
import { fetchEvents } from "./bridge";
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
      id: "reload-calendars",
      name: "Reload calendars",
      callback: () => this.reloadCalendars(),
    });
  }

  private async pickEventAndCreateNote(): Promise<void> {
    try {
      const today = startOfDay(new Date());
      const from = formatDateForCli(addDays(today, -7));
      const to = formatDateForCli(addDays(today, 30));
      const events = await fetchEvents(this.resolveBridgePath(), from, to);

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
