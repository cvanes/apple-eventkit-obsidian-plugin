import { execFile } from "child_process";
import { promisify } from "util";
import {
  BridgeCalendar,
  BridgeEvent,
  BridgeReminder,
  BridgeReminderList,
  BridgeResponse,
} from "./types";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 10_000;

async function run<T>(bridgePath: string, args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(bridgePath, args, {
    timeout: TIMEOUT_MS,
  });
  const response: BridgeResponse<T> = JSON.parse(stdout);
  if (response.status === "error") {
    throw new Error(response.message ?? "Unknown eventkitcli error");
  }
  return response.data as T;
}

export function fetchCalendars(
  bridgePath: string
): Promise<BridgeCalendar[]> {
  return run(bridgePath, ["list-calendars"]);
}

export function fetchReminderLists(
  bridgePath: string
): Promise<BridgeReminderList[]> {
  return run(bridgePath, ["list-reminder-lists"]);
}

export function fetchEvents(
  bridgePath: string,
  from: string,
  to: string,
  calendarIds?: string[]
): Promise<BridgeEvent[]> {
  const args = ["list-events", "--from", from, "--to", to];
  if (calendarIds && calendarIds.length > 0) {
    args.push("--calendars", calendarIds.join(","));
  }
  return run(bridgePath, args);
}

export function fetchEvent(
  bridgePath: string,
  id: string
): Promise<BridgeEvent> {
  return run(bridgePath, ["get-event", `--id=${id}`]);
}

export interface CreateReminderOptions {
  dueDate?: string;
  notes?: string;
  priority?: number;
  /** Attached URL -- an obsidian:// deep link back to the source note. */
  url?: string;
  allDay?: boolean;
}

export function createReminder(
  bridgePath: string,
  /** List title or identifier -- eventkitcli resolves either. */
  list: string,
  title: string,
  options: CreateReminderOptions = {}
): Promise<BridgeReminder> {
  const args = ["create-reminder", `--list=${list}`, `--title=${title}`];
  if (options.dueDate) args.push(`--due=${options.dueDate}`);
  if (options.notes) args.push(`--notes=${options.notes}`);
  if (options.priority !== undefined) args.push(`--priority=${options.priority}`);
  if (options.url) args.push(`--url=${options.url}`);
  if (options.allDay) args.push("--all-day");
  return run(bridgePath, args);
}

export function fetchReminders(
  bridgePath: string,
  options: { list?: string; incompleteOnly?: boolean; dueBefore?: string } = {}
): Promise<BridgeReminder[]> {
  const args = ["list-reminders"];
  if (options.list) args.push(`--list=${options.list}`);
  if (options.incompleteOnly !== false) args.push("--incomplete-only");
  if (options.dueBefore) args.push(`--due-before=${options.dueBefore}`);
  return run(bridgePath, args);
}

export function completeReminder(
  bridgePath: string,
  id: string
): Promise<BridgeReminder> {
  return run(bridgePath, ["complete-reminder", `--id=${id}`]);
}

export function createReminderList(
  bridgePath: string,
  title: string
): Promise<BridgeReminderList> {
  return run(bridgePath, ["create-reminder-list", `--title=${title}`]);
}
