import { Notice } from "obsidian";
import { execFile } from "child_process";
import { BridgeReminder } from "./types";

/**
 * Show a day in Calendar.app. There is no dependable way to reveal a specific
 * event, so the day it falls on is the closest Calendar will take us.
 */
export function openDateInCalendar(dateStr: string): void {
  const d = new Date(dateStr + "T00:00:00");
  runAppleScript("Calendar", [
    'tell application "Calendar"',
    "activate",
    "set d to current date",
    `set year of d to ${d.getFullYear()}`,
    `set month of d to ${d.getMonth() + 1}`,
    `set day of d to ${d.getDate()}`,
    "view calendar at d",
    "end tell",
  ]);
}

/**
 * Reveal a reminder in Reminders.app.
 *
 * There is no usable URL scheme: `x-apple-reminder://` is not registered with
 * Launch Services, so `open` fails with kLSApplicationNotFoundErr. AppleScript
 * does resolve that identifier though, so `show reminder id` is the route.
 *
 * It must be the *external* identifier: Reminders does not recognise
 * EventKit's calendarItemIdentifier.
 */
export function openReminderInApp(reminder: BridgeReminder): void {
  if (!reminder.externalId) {
    new Notice("This reminder cannot be opened in Reminders.");
    return;
  }
  runAppleScript("Reminders", [
    'tell application "Reminders"',
    "activate",
    `show reminder id "x-apple-reminder://${reminder.externalId}"`,
    "end tell",
  ]);
}

function runAppleScript(appName: string, lines: string[]): void {
  execFile("osascript", ["-e", lines.join("\n")], (err) => {
    if (err) new Notice(`Failed to open ${appName}: ${err.message}`);
  });
}
