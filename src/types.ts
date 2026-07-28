export interface CalendarToggle {
  id: string;
  title: string;
  color: string;
  source: string;
  enabled: boolean;
}

export interface PluginSettings {
  dateFormat: string;
  noteFolderPath: string;
  templateFilePath: string;
  defaultReminderList: string;
  hideAllDayInAgenda: boolean;
  hideAllDayInModals: boolean;
  /** Show reminders due on the selected day alongside events in the agenda. */
  showRemindersInAgenda: boolean;
  /** Restrict agenda reminders to these list titles. Empty means all lists. */
  agendaReminderLists: string[];
  calendarToggles: CalendarToggle[];
  bridgePath: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  dateFormat: "YYYY-MM-DD",
  noteFolderPath: "",
  templateFilePath: "",
  defaultReminderList: "",
  hideAllDayInAgenda: false,
  hideAllDayInModals: false,
  showRemindersInAgenda: false,
  agendaReminderLists: [],
  calendarToggles: [],
  bridgePath: "",
};

export interface BridgeCalendar {
  id: string;
  title: string;
  color: string;
  source: string;
}

export interface BridgeEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location: string;
  notes: string;
  calendarId: string;
  calendarTitle: string;
  calendarColor: string;
}

export interface BridgeReminderList {
  id: string;
  title: string;
  color: string;
}

export interface BridgeReminder {
  id: string;
  /**
   * Reminders' own identifier, distinct from `id` (EventKit's
   * calendarItemIdentifier). Needed to deep-link into Reminders.app, which only
   * recognises this one. Absent for some store types.
   */
  externalId?: string;
  title: string;
  notes: string;
  /** Absent when unset. All-day reminders return `YYYY-MM-DD`, timed ones ISO 8601. */
  dueDate?: string;
  isAllDay: boolean;
  isCompleted: boolean;
  priority: number;
  /** Absent when unset. */
  url?: string;
  listId: string;
  listTitle: string;
  listColor: string;
}

export interface BridgeResponse<T> {
  status: "ok" | "error";
  data?: T;
  message?: string;
}
