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

export function createReminder(
  bridgePath: string,
  listId: string,
  title: string,
  dueDate?: string,
  notes?: string
): Promise<BridgeReminder> {
  const args = ["create-reminder", `--list=${listId}`, `--title=${title}`];
  if (dueDate) args.push(`--due=${dueDate}`);
  if (notes) args.push(`--notes=${notes}`);
  return run(bridgePath, args);
}
