import { App, Notice, TFile, normalizePath } from "obsidian";
import { BridgeEvent, PluginSettings } from "./types";
import { formatNoteDate } from "./date-utils";

/**
 * Maps `event-id|event-date` to the note holding it.
 *
 * Built once per refresh: scanning the vault per event was O(events x files),
 * which is heavy on a large vault and ran on every navigation and every
 * five-minute auto-refresh.
 *
 * Recurring events share one `calendarItemIdentifier` across every occurrence,
 * so the date is part of the key -- keying on id alone made next week's
 * occurrence of a weekly meeting open last week's note.
 */
export type EventNoteIndex = Map<string, TFile>;

export function noteKey(eventId: string, eventDate: string): string {
  return `${eventId}|${eventDate}`;
}

export function buildEventNoteIndex(app: App): EventNoteIndex {
  const index: EventNoteIndex = new Map();
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    const id = fm?.["event-id"];
    if (!id) continue;
    const date = String(fm?.["event-date"] ?? "");
    index.set(noteKey(id, date), file);
    // Fallback for notes written before dates were part of the key.
    if (!index.has(id)) index.set(id, file);
  }
  return index;
}

export function findNoteForEvent(
  app: App,
  event: BridgeEvent,
  index?: EventNoteIndex
): TFile | null {
  const idx = index ?? buildEventNoteIndex(app);
  return (
    idx.get(noteKey(event.id, eventDateString(event))) ?? idx.get(event.id) ?? null
  );
}

export async function createOrOpenEventNote(
  app: App,
  event: BridgeEvent,
  settings: PluginSettings,
  index?: EventNoteIndex
): Promise<void> {
  const existing = findNoteForEvent(app, event, index);
  if (existing) {
    await app.workspace.openLinkText(existing.path, "", false);
    return;
  }
  const file = await createEventNote(app, event, settings);
  await app.workspace.openLinkText(file.path, "", false);
}

export async function linkNoteToEvent(
  app: App,
  event: BridgeEvent
): Promise<void> {
  const file = app.workspace.getActiveFile();
  if (!file) {
    new Notice("No active note to link.");
    return;
  }
  await updateFrontmatterIfNeeded(app, file, event);
  new Notice(`Linked to: ${event.title}`);
}

export async function unlinkNoteFromEvent(app: App): Promise<void> {
  const file = app.workspace.getActiveFile();
  if (!file) {
    new Notice("No active note to unlink.");
    return;
  }
  await app.fileManager.processFrontMatter(file, (fm) => {
    delete fm["event-id"];
    delete fm["event-date"];
  });
  new Notice("Unlinked from calendar event.");
}

export async function syncNoteWithEvent(
  app: App,
  event: BridgeEvent,
  index?: EventNoteIndex
): Promise<void> {
  const file = findNoteForEvent(app, event, index);
  if (!file) return;
  await updateFrontmatterIfNeeded(app, file, event);
}

async function createEventNote(
  app: App,
  event: BridgeEvent,
  settings: PluginSettings
): Promise<TFile> {
  const fullPath = buildNotePath(event, settings);
  const folder = fullPath.substring(0, fullPath.lastIndexOf("/"));
  if (folder) await ensureFolder(app, folder);

  // A note may already sit at this path without being linked -- adopt it rather
  // than throwing, which is what vault.create does on a duplicate path.
  const atPath = app.vault.getAbstractFileByPath(fullPath);
  if (atPath instanceof TFile) {
    await updateFrontmatterIfNeeded(app, atPath, event);
    new Notice(`Linked existing note: ${atPath.basename}`);
    return atPath;
  }

  const frontmatter = buildFrontmatter(event);
  const templateContent = await readTemplate(app, settings.templateFilePath);
  const body = templateContent ? `\n${templateContent}` : "";
  return app.vault.create(fullPath, `---\n${frontmatter}---\n${body}`);
}

async function readTemplate(app: App, path: string): Promise<string | null> {
  if (!path) return null;
  const normalized = normalizePath(path.endsWith(".md") ? path : `${path}.md`);
  const file = app.vault.getAbstractFileByPath(normalized);
  if (!(file instanceof TFile)) return null;
  return app.vault.read(file);
}

async function updateFrontmatterIfNeeded(
  app: App,
  file: TFile,
  event: BridgeEvent
): Promise<void> {
  const cache = app.metadataCache.getFileCache(file);
  const fm = cache?.frontmatter;
  const expectedDate = eventDateString(event);
  if (fm?.["event-id"] === event.id && fm?.["event-date"] === expectedDate) return;
  await app.fileManager.processFrontMatter(file, (fm) => {
    fm["event-id"] = event.id;
    fm["event-date"] = expectedDate;
  });
}

function buildNotePath(event: BridgeEvent, settings: PluginSettings): string {
  const eventDate = new Date(event.startDate);
  const datePath = formatNoteDate(eventDate, settings.dateFormat);
  const filename = `${datePath} - ${sanitizeFilename(event.title)}.md`;
  return settings.noteFolderPath
    ? normalizePath(`${settings.noteFolderPath}/${filename}`)
    : normalizePath(filename);
}

export function buildFrontmatter(event: BridgeEvent): string {
  const date = eventDateString(event);
  return `event-id: "${event.id}"\nevent-date: ${date}\n`;
}

export function eventDateString(event: BridgeEvent): string {
  return new Date(event.startDate).toISOString().slice(0, 10);
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  if (!folderPath) return;
  const normalized = normalizePath(folderPath);
  if (app.vault.getAbstractFileByPath(normalized)) return;
  await app.vault.createFolder(normalized);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-");
}
