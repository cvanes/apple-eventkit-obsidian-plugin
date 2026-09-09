import { App, TFile } from "obsidian";
import { BridgeEvent, BridgeReminder } from "./types";
import { formatDateForCli } from "./date-utils";

export const FRONTMATTER = {
  calendarId: "eventkit-calendar-id",
  calendarDate: "eventkit-calendar-date",
  reminderId: "eventkit-reminder-id",
} as const;

export type Frontmatter = Record<string, unknown>;

export interface CalendarLink {
  id: string;
  date: string;
}

/**
 * Maps linked items to the notes holding them.
 *
 * Built once per refresh: scanning the vault per item was O(items x files),
 * which is heavy on a large vault and ran on every navigation and every
 * five-minute auto-refresh.
 *
 * Recurring events share one `eventIdentifier` across every occurrence, so the
 * date is part of the event key -- keying on id alone made next week's
 * occurrence of a weekly meeting open last week's note.
 */
export interface NoteIndex {
  events: Map<string, TFile>;
  reminders: Map<string, TFile>;
}

export function buildNoteIndex(app: App): NoteIndex {
  const index: NoteIndex = { events: new Map(), reminders: new Map() };
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) continue;
    const calendar = readCalendarLink(fm);
    if (calendar) index.events.set(eventKey(calendar.id, calendar.date), file);
    const reminderId = readReminderId(fm);
    if (reminderId) index.reminders.set(reminderId, file);
  }
  return index;
}

export function readCalendarLink(fm: Frontmatter | undefined): CalendarLink | null {
  const id = fm?.[FRONTMATTER.calendarId];
  const date = fm?.[FRONTMATTER.calendarDate];
  if (!id || !date) return null;
  return { id: String(id), date: String(date) };
}

export function readReminderId(fm: Frontmatter | undefined): string | null {
  const id = fm?.[FRONTMATTER.reminderId];
  return id ? String(id) : null;
}

export function calendarLinkOf(app: App, file: TFile): CalendarLink | null {
  return readCalendarLink(app.metadataCache.getFileCache(file)?.frontmatter);
}

export function reminderIdOf(app: App, file: TFile): string | null {
  return readReminderId(app.metadataCache.getFileCache(file)?.frontmatter);
}

export function eventKey(eventId: string, eventDate: string): string {
  return `${eventId}|${eventDate}`;
}

/**
 * The local day an event starts on. Must be local, not UTC: an all-day event
 * starts at local midnight, which in BST is 23:00 UTC the day before.
 */
export function eventDateString(event: BridgeEvent): string {
  return formatDateForCli(new Date(event.startDate));
}

export function findNoteForEvent(index: NoteIndex, event: BridgeEvent): TFile | null {
  return index.events.get(eventKey(event.id, eventDateString(event))) ?? null;
}

export function findNoteForReminder(index: NoteIndex, reminder: BridgeReminder): TFile | null {
  return index.reminders.get(reminder.id) ?? null;
}
