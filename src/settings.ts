import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AppleCalendarPlugin from "./main";
import { fetchCalendars, fetchReminderLists } from "./bridge";
import { CalendarToggle } from "./types";

export class AppleCalendarSettingTab extends PluginSettingTab {
  plugin: AppleCalendarPlugin;

  constructor(app: App, plugin: AppleCalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.addNoteSettings(containerEl);
    this.addReminderSettings(containerEl);
    this.addCalendarToggles(containerEl);
    this.addAdvancedSettings(containerEl);
  }

  private addNoteSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Notes").setHeading();

    new Setting(containerEl)
      .setName("Date format")
      .setDesc("Format for the date prefix in note titles (moment.js tokens).")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Note folder path")
      .setDesc(
        "Folder for event notes. Supports date tokens (e.g. YYYY/MM). Leave empty for vault root."
      )
      .addText((text) =>
        text
          .setPlaceholder("e.g. Calendar/YYYY/MM")
          .setValue(this.plugin.settings.noteFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.noteFolderPath = value;
            await this.plugin.saveSettings();
          })
      );

  }

  private addReminderSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Reminders").setHeading();

    const dropdown = new Setting(containerEl)
      .setName("Default reminder list")
      .setDesc("The list used when creating reminders from selected text.");

    dropdown.addDropdown((dd) => {
      dd.addOption("", "Loading...");
      dd.setDisabled(true);

      this.loadReminderLists(dd).then(() => {
        dd.setDisabled(false);
      });
    });
  }

  private async loadReminderLists(
    dd: import("obsidian").DropdownComponent
  ): Promise<void> {
    try {
      const lists = await fetchReminderLists(this.plugin.resolveBridgePath());
      dd.selectEl.empty();
      dd.addOption("", "— Select a list —");
      for (const list of lists) {
        dd.addOption(list.id, list.title);
      }
      dd.setValue(this.plugin.settings.defaultReminderList);
      dd.onChange(async (value) => {
        this.plugin.settings.defaultReminderList = value;
        await this.plugin.saveSettings();
      });
    } catch {
      dd.selectEl.empty();
      dd.addOption("", "Failed to load reminder lists");
    }
  }

  private addCalendarToggles(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Calendars").setHeading();

    new Setting(containerEl)
      .setName("Refresh calendars")
      .setDesc("Fetch the latest calendars from Apple Calendar.")
      .addButton((btn) =>
        btn.setButtonText("Refresh").onClick(async () => {
          await this.refreshCalendars();
          this.display();
        })
      );

    for (const toggle of this.plugin.settings.calendarToggles) {
      this.addCalendarToggle(containerEl, toggle);
    }

    if (this.plugin.settings.calendarToggles.length === 0) {
      containerEl.createEl("p", {
        text: 'No calendars loaded. Click "Refresh" above.',
        cls: "setting-item-description",
      });
    }
  }

  private addCalendarToggle(
    containerEl: HTMLElement,
    toggle: CalendarToggle
  ): void {
    const setting = new Setting(containerEl)
      .setName(toggle.title)
      .addToggle((t) =>
        t.setValue(toggle.enabled).onChange(async (value) => {
          toggle.enabled = value;
          await this.plugin.saveSettings();
        })
      );

    const dot = createEl("span", { cls: "apple-eventkit-dot" });
    dot.style.backgroundColor = toggle.color;
    setting.nameEl.prepend(dot);
    setting.nameEl.prepend(createEl("span", { text: " " }));
    // Re-order: dot first, then space, then text
    setting.nameEl.prepend(dot);
  }

  async refreshCalendars(): Promise<void> {
    try {
      const calendars = await fetchCalendars(
        this.plugin.resolveBridgePath()
      );
      const existing = new Map(
        this.plugin.settings.calendarToggles.map((t) => [t.id, t.enabled])
      );
      this.plugin.settings.calendarToggles = calendars.map((cal) => ({
        id: cal.id,
        title: cal.title,
        color: cal.color,
        enabled: existing.get(cal.id) ?? true,
      }));
      await this.plugin.saveSettings();
      new Notice("Calendars refreshed.");
    } catch (e) {
      new Notice(`Failed to refresh calendars: ${e}`);
    }
  }

  private addAdvancedSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Advanced").setHeading();

    new Setting(containerEl)
      .setName("Bridge path")
      .setDesc(
        "Path to eventkitcli binary. Leave empty for auto-detection."
      )
      .addText((text) =>
        text
          .setPlaceholder("~/.local/bin/eventkitcli")
          .setValue(this.plugin.settings.bridgePath)
          .onChange(async (value) => {
            this.plugin.settings.bridgePath = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
