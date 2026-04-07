import { App, Notice, PluginSettingTab, Setting, moment } from "obsidian";
import type AppleCalendarPlugin from "./main";
import { fetchCalendars, fetchReminderLists } from "./bridge";
import { CalendarToggle } from "./types";
import { FileSuggest, FolderSuggest } from "./file-suggest";

const DATE_FORMAT_PRESETS: { label: string; value: string }[] = [
  { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
  { label: "YYYY.MM.DD", value: "YYYY.MM.DD" },
  { label: "YYYY/MM/DD", value: "YYYY/MM/DD" },
  { label: "YYYY/MM/YYYY-MM-DD", value: "YYYY/MM/YYYY-MM-DD" },
];

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

    const isPreset = DATE_FORMAT_PRESETS.some(
      (p) => p.value === this.plugin.settings.dateFormat
    );

    const customSetting = new Setting(containerEl).setClass("custom-format-setting");
    customSetting.settingEl.style.display = "none";

    const updateCustomField = (show: boolean) => {
      customSetting.settingEl.style.display = show ? "" : "none";
      if (show) {
        const preview = moment().format(this.plugin.settings.dateFormat);
        customSetting.clear();
        customSetting
          .setName("Custom format")
          .setDesc(`For more syntax, refer to the moment.js format reference. Your current syntax looks like this: ${preview}`)
          .addText((text) =>
            text
              .setPlaceholder("YYYY/MM/YYYY-MM-DD")
              .setValue(this.plugin.settings.dateFormat)
              .onChange(async (value) => {
                this.plugin.settings.dateFormat = value;
                await this.plugin.saveSettings();
              })
          );
      }
    };

    new Setting(containerEl)
      .setName("Date format")
      .setDesc("Choose how event notes are named in your vault.")
      .addDropdown((dd) => {
        for (const preset of DATE_FORMAT_PRESETS) {
          dd.addOption(preset.value, moment().format(preset.value));
        }
        dd.addOption("custom", "Custom");
        dd.setValue(isPreset ? this.plugin.settings.dateFormat : "custom");
        dd.onChange(async (value) => {
          if (value !== "custom") {
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
            updateCustomField(false);
          } else {
            updateCustomField(true);
          }
        });
      });

    // Move custom field after the dropdown setting
    containerEl.append(customSetting.settingEl);
    updateCustomField(!isPreset);

    new Setting(containerEl)
      .setName("New file location")
      .setDesc("New event notes will be placed here.")
      .addText((text) => {
        text
          .setPlaceholder("Example: folder 1/folder")
          .setValue(this.plugin.settings.noteFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.noteFolderPath = value;
            await this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName("Template file location")
      .setDesc("Choose the file to use as a template.")
      .addText((text) => {
        text
          .setPlaceholder("Example: folder/note")
          .setValue(this.plugin.settings.templateFilePath)
          .onChange(async (value) => {
            this.plugin.settings.templateFilePath = value;
            await this.plugin.saveSettings();
          });
        new FileSuggest(this.app, text.inputEl);
      });
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

    new Setting(containerEl)
      .setName("Hide all day events in agenda")
      .setDesc("Filter out all day events from the agenda sidebar.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.hideAllDayInAgenda).onChange(async (value) => {
          this.plugin.settings.hideAllDayInAgenda = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Hide all day events in calendar modals")
      .setDesc("Filter out all day events from event picker modals.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.hideAllDayInModals).onChange(async (value) => {
          this.plugin.settings.hideAllDayInModals = value;
          await this.plugin.saveSettings();
        })
      );

    const toggles = this.plugin.settings.calendarToggles;
    if (toggles.length === 0) {
      containerEl.createEl("p", {
        text: 'No calendars loaded. Click "Refresh" above.',
        cls: "setting-item-description",
      });
      return;
    }

    const needsRefresh = toggles.some((t) => !t.source);
    if (needsRefresh) {
      this.refreshCalendars().then(() => this.display());
      return;
    }

    const grouped = [...this.groupBySource(toggles).entries()]
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [source, items] of grouped) {
      new Setting(containerEl).setName(source).setHeading();
      for (const toggle of items) {
        this.addCalendarToggle(containerEl, toggle);
      }
    }
  }

  private groupBySource(toggles: CalendarToggle[]): Map<string, CalendarToggle[]> {
    const groups = new Map<string, CalendarToggle[]>();
    for (const toggle of toggles) {
      const source = toggle.source || "Other";
      const list = groups.get(source) ?? [];
      list.push(toggle);
      groups.set(source, list);
    }
    for (const [, items] of groups) {
      items.sort((a, b) => a.title.localeCompare(b.title));
    }
    return groups;
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
        source: cal.source,
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
