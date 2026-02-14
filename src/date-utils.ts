import { moment } from "obsidian";

export function formatDateForDisplay(date: Date): string {
  return moment(date).format("dddd, D MMM YYYY");
}

export function formatDateForCli(date: Date): string {
  return moment(date).format("YYYY-MM-DD");
}

export function formatTime(isoString: string): string {
  return moment(isoString).format("HH:mm");
}

export function formatNoteDate(date: Date, format: string): string {
  return moment(date).format(format);
}

export function expandDateTokens(template: string, date: Date): string {
  return moment(date).format(template);
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
