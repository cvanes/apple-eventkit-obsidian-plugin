import { App, Notice, TFile, normalizePath } from "obsidian";
import { BridgeEvent, BridgeReminder, PluginSettings } from "./types";
import { formatNoteDate } from "./date-utils";
import { fetchReminder, updateReminder } from "./bridge";
import {
  advancedUriIdField,
  buildAdvancedUri,
  ensureNoteUid,
  isAdvancedUriEnabled,
  isAdvancedUri,
} from "./advanced-uri";
import {
  FRONTMATTER,
  NoteIndex,
  buildNoteIndex,
  calendarLinkOf,
  eventDateString,
  findNoteForEvent,
  findNoteForReminder,
  reminderIdOf,
} from "./note-index";

// MARK: - Calendar events

export async function createOrOpenEventNote(
  app: App,
  event: BridgeEvent,
  settings: PluginSettings,
  index: NoteIndex = buildNoteIndex(app)
): Promise<void> {
  const existing = findNoteForEvent(index, event);
  if (existing) {
    await openNote(app, existing);
    return;
  }
  const file = await createOrAdoptNote(app, buildEventNotePath(event, settings), settings);
  await linkNoteToEvent(app, file, event);
  await openNote(app, file);
}

export async function linkNoteToEvent(app: App, file: TFile, event: BridgeEvent): Promise<void> {
  const link = calendarLinkOf(app, file);
  const date = eventDateString(event);
  if (link?.id === event.id && link.date === date) return;
  await app.fileManager.processFrontMatter(file, (fm) => {
    fm[FRONTMATTER.calendarId] = event.id;
    fm[FRONTMATTER.calendarDate] = date;
  });
}

export async function unlinkNoteFromEvent(app: App, file: TFile): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm) => {
    delete fm[FRONTMATTER.calendarId];
    delete fm[FRONTMATTER.calendarDate];
  });
}

/** Keep a linked note's frontmatter current, e.g. after the event moved day. */
export async function syncNoteWithEvent(
  app: App,
  event: BridgeEvent,
  index: NoteIndex
): Promise<void> {
  const file = findNoteForEvent(index, event);
  if (file) await linkNoteToEvent(app, file, event);
}

function buildEventNotePath(event: BridgeEvent, settings: PluginSettings): string {
  const datePath = formatNoteDate(new Date(event.startDate), settings.dateFormat);
  const filename = `${datePath} - ${sanitizeFilename(event.title)}.md`;
  return settings.noteFolderPath
    ? normalizePath(`${settings.noteFolderPath}/${filename}`)
    : normalizePath(filename);
}

// MARK: - Reminders

/** Reminder notes live at the vault root, named after the reminder. */
export async function createOrOpenReminderNote(
  app: App,
  reminder: BridgeReminder,
  bridgePath: string,
  index: NoteIndex = buildNoteIndex(app)
): Promise<void> {
  const existing = findNoteForReminder(index, reminder);
  if (existing) {
    await openNote(app, existing);
    return;
  }
  const path = normalizePath(`${sanitizeFilename(reminder.title)}.md`);
  const file = await createOrAdoptNote(app, path);
  await linkNoteToReminder(app, file, reminder, bridgePath);
  await openNote(app, file);
}

/**
 * Record the reminder on the note and point the reminder back at the note.
 *
 * The link is an Advanced URI keyed on the note's uid, so it keeps working if
 * the note is renamed or moved. It goes into the reminder's notes as well as its
 * URL field: EventKit's `url` is stored as the iCalendar URL, which Reminders.app
 * on the Mac never displays, whereas notes are always visible.
 *
 * Any existing notes on the reminder move into the Obsidian note first, and the
 * reminder is only rewritten once that write has completed, so a failure part
 * way leaves a copy in one place or the other but never in neither.
 */
export async function linkNoteToReminder(
  app: App,
  file: TFile,
  reminder: BridgeReminder,
  bridgePath: string
): Promise<void> {
  if (!isAdvancedUriEnabled(app)) {
    new Notice("Advanced URI plugin is not enabled, so the link back from Reminders will not open.");
  }
  const uri = buildAdvancedUri(app, await ensureUid(app, file, reminder));
  // Re-read rather than trust the agenda's copy: the notes may have changed since.
  const current = await fetchReminder(bridgePath, reminder.id);
  const carried = notesWithoutLinks(current.notes);
  if (carried) await app.vault.append(file, `\n${carried}\n`);
  await updateReminder(bridgePath, reminder.id, { url: uri, notes: uri });
}

async function ensureUid(app: App, file: TFile, reminder: BridgeReminder): Promise<string> {
  const idField = advancedUriIdField(app);
  let uid = "";
  await app.fileManager.processFrontMatter(file, (fm) => {
    fm[FRONTMATTER.reminderId] = reminder.id;
    uid = ensureNoteUid(fm, idField);
  });
  return uid;
}

/** Remove the link from the note, and from the reminder if it still exists. */
export async function unlinkNoteFromReminder(
  app: App,
  file: TFile,
  bridgePath: string
): Promise<void> {
  const reminderId = reminderIdOf(app, file);
  await app.fileManager.processFrontMatter(file, (fm) => {
    delete fm[FRONTMATTER.reminderId];
  });
  if (!reminderId) return;
  try {
    const current = await fetchReminder(bridgePath, reminderId);
    const remaining = notesWithoutLinks(current.notes);
    await updateReminder(bridgePath, reminderId, {
      clearUrl: true,
      ...(remaining ? { notes: remaining } : { clearNotes: true }),
    });
  } catch (e) {
    new Notice(`Note unlinked, but the reminder could not be updated: ${e}`);
  }
}

/** The reminder's notes with any lines that are just an Obsidian link removed. */
function notesWithoutLinks(notes: string): string {
  return notes
    .split("\n")
    .filter((line) => !isAdvancedUri(line.trim()))
    .join("\n")
    .trim();
}

// MARK: - Shared

/**
 * A note may already sit at the path without being linked -- adopt it rather
 * than throwing, which is what vault.create does on a duplicate path.
 */
async function createOrAdoptNote(
  app: App,
  path: string,
  settings?: PluginSettings
): Promise<TFile> {
  const atPath = app.vault.getAbstractFileByPath(path);
  if (atPath instanceof TFile) {
    new Notice(`Linked existing note: ${atPath.basename}`);
    return atPath;
  }
  const folder = path.substring(0, path.lastIndexOf("/"));
  if (folder) await ensureFolder(app, folder);
  const template = settings ? await readTemplate(app, settings.templateFilePath) : null;
  return app.vault.create(path, template ?? "");
}

async function readTemplate(app: App, path: string): Promise<string | null> {
  if (!path) return null;
  const normalized = normalizePath(path.endsWith(".md") ? path : `${path}.md`);
  const file = app.vault.getAbstractFileByPath(normalized);
  if (!(file instanceof TFile)) return null;
  return app.vault.read(file);
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  if (app.vault.getAbstractFileByPath(normalized)) return;
  await app.vault.createFolder(normalized);
}

function openNote(app: App, file: TFile): Promise<void> {
  return app.workspace.openLinkText(file.path, "", false);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-");
}
