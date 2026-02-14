export interface CalendarToggle {
  id: string;
  title: string;
  color: string;
  enabled: boolean;
}

export interface PluginSettings {
  dateFormat: string;
  noteFolderPath: string;
  templateFilePath: string;
  defaultReminderList: string;
  calendarToggles: CalendarToggle[];
  bridgePath: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  dateFormat: "YYYY-MM-DD",
  noteFolderPath: "",
  templateFilePath: "",
  defaultReminderList: "",
  calendarToggles: [],
  bridgePath: "",
};

export interface BridgeCalendar {
  id: string;
  title: string;
  color: string;
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
  title: string;
  notes: string;
  dueDate: string | null;
  isCompleted: boolean;
  priority: number;
  listId: string;
  listTitle: string;
}

export interface BridgeResponse<T> {
  status: "ok" | "error";
  data?: T;
  message?: string;
}
