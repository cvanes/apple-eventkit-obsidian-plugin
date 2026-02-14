import { App, Modal, Notice, Setting } from "obsidian";
import { BridgeReminderList, PluginSettings } from "./types";
import { createReminder, fetchReminderLists } from "./bridge";

export class CreateReminderModal extends Modal {
  title: string;
  settings: PluginSettings;
  bridgePath: string;
  onCreated: (reminderId: string, reminderTitle: string) => void;

  private selectedListId = "";
  private dueDate = "";
  private reminderLists: BridgeReminderList[] = [];

  constructor(
    app: App,
    title: string,
    settings: PluginSettings,
    bridgePath: string,
    onCreated: (reminderId: string, reminderTitle: string) => void
  ) {
    super(app);
    this.title = title;
    this.settings = settings;
    this.bridgePath = bridgePath;
    this.onCreated = onCreated;
    this.selectedListId = settings.defaultReminderList;
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Create Reminder" });

    new Setting(contentEl)
      .setName("Title")
      .addText((text) =>
        text.setValue(this.title).setDisabled(true)
      );

    const listSetting = new Setting(contentEl).setName("Reminder list");
    listSetting.addDropdown((dd) => {
      dd.addOption("", "Loading...");
      dd.setDisabled(true);
      this.loadLists(dd);
    });

    new Setting(contentEl)
      .setName("Due date")
      .setDesc("Optional")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .onChange((value) => {
            this.dueDate = value;
          })
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Create")
        .setCta()
        .onClick(() => this.submit())
    );
  }

  private async loadLists(
    dd: import("obsidian").DropdownComponent
  ): Promise<void> {
    try {
      this.reminderLists = await fetchReminderLists(this.bridgePath);
      dd.selectEl.empty();
      dd.addOption("", "— Select a list —");
      for (const list of this.reminderLists) {
        dd.addOption(list.id, list.title);
      }
      dd.setValue(this.selectedListId);
      dd.setDisabled(false);
      dd.onChange((value) => {
        this.selectedListId = value;
      });
    } catch {
      dd.selectEl.empty();
      dd.addOption("", "Failed to load lists");
    }
  }

  private async submit(): Promise<void> {
    if (!this.selectedListId) {
      new Notice("Please select a reminder list.");
      return;
    }
    try {
      const dueIso = this.dueDate
        ? `${this.dueDate}T09:00:00Z`
        : undefined;
      const reminder = await createReminder(
        this.bridgePath,
        this.selectedListId,
        this.title,
        dueIso
      );
      new Notice(`Reminder created: ${reminder.title}`);
      this.onCreated(reminder.id, reminder.title);
      this.close();
    } catch (e) {
      new Notice(`Failed to create reminder: ${e}`);
    }
  }
}
