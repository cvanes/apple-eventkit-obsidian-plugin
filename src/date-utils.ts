import { moment } from "obsidian";

export function formatDateForDisplay(date: Date): string {
  return moment(date).format("dddd, D MMM YYYY");
}

export function formatDateForCli(date: Date): string {
  return moment(date).format("YYYY-MM-DD");
}

/**
 * ISO 8601 with the local UTC offset, e.g. `2026-08-12T00:00:00+01:00`.
 *
 * Cutoffs sent to the CLI must carry the offset: a `Z` instant puts the
 * boundary an hour out during BST, so items either side of midnight land on
 * the wrong day.
 */
export function formatIsoLocal(date: Date): string {
  return moment(date).format();
}

/**
 * The local day a reminder falls on. All-day due dates are already date-only;
 * timed ones arrive as UTC instants and have to be converted back.
 */
export function dueDay(dueDate: string | undefined): string | undefined {
  if (!dueDate) return undefined;
  return dueDate.includes("T") ? moment(dueDate).format("YYYY-MM-DD") : dueDate;
}

export function formatTime(isoString: string): string {
  return moment(isoString).format("HH:mm");
}

export function formatNoteDate(date: Date, format: string): string {
  return moment(date).format(format);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
