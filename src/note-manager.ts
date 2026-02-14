import { App, Notice, TFile, normalizePath } from "obsidian";
import { BridgeEvent, PluginSettings } from "./types";
import { formatNoteDate, expandDateTokens } from "./date-utils";

export function findNoteForEvent(app: App, eventId: string): TFile | null {
  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.frontmatter?.["event-id"] === eventId) return file;
  }
  return null;
}

export async function createOrOpenEventNote(
  app: App,
  event: BridgeEvent,
  settings: PluginSettings
): Promise<void> {
  const existing = findNoteForEvent(app, event.id);
  if (existing) {
    await app.workspace.openLinkText(existing.path, "", false);
    return;
  }
  const file = await createEventNote(app, event, settings);
  await app.workspace.openLinkText(file.path, "", false);
}

export async function linkNoteToEvent(
  app: App,
  event: BridgeEvent,
  settings: PluginSettings
): Promise<void> {
  const file = app.workspace.getActiveFile();
  if (!file) {
    new Notice("No active note to link.");
    return;
  }
  await updateFrontmatterIfNeeded(app, file, event);
  await renameNoteIfNeeded(app, file, event, settings);
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
  settings: PluginSettings
): Promise<void> {
  const file = findNoteForEvent(app, event.id);
  if (!file) return;
  await updateFrontmatterIfNeeded(app, file, event);
  await renameNoteIfNeeded(app, file, event, settings);
}

async function createEventNote(
  app: App,
  event: BridgeEvent,
  settings: PluginSettings
): Promise<TFile> {
  const eventDate = new Date(event.startDate);
  const folderPath = resolveFolderPath(settings.noteFolderPath, eventDate);
  await ensureFolder(app, folderPath);

  const fullPath = buildNotePath(event, settings);
  const frontmatter = buildFrontmatter(event);
  return app.vault.create(fullPath, `---\n${frontmatter}---\n`);
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

async function renameNoteIfNeeded(
  app: App,
  file: TFile,
  event: BridgeEvent,
  settings: PluginSettings
): Promise<void> {
  const expectedPath = buildNotePath(event, settings);
  if (file.path === expectedPath) return;
  const folder = expectedPath.substring(0, expectedPath.lastIndexOf("/"));
  if (folder) await ensureFolder(app, folder);
  await app.fileManager.renameFile(file, expectedPath);
}

function buildNotePath(event: BridgeEvent, settings: PluginSettings): string {
  const eventDate = new Date(event.startDate);
  const folderPath = resolveFolderPath(settings.noteFolderPath, eventDate);
  const datePrefix = formatNoteDate(eventDate, settings.dateFormat);
  const filename = `${datePrefix} - ${sanitizeFilename(event.title)}.md`;
  return folderPath
    ? normalizePath(`${folderPath}/${filename}`)
    : normalizePath(filename);
}

export function buildFrontmatter(event: BridgeEvent): string {
  const date = eventDateString(event);
  return `event-id: "${event.id}"\nevent-date: ${date}\n`;
}

function eventDateString(event: BridgeEvent): string {
  return new Date(event.startDate).toISOString().slice(0, 10);
}

function resolveFolderPath(template: string, date: Date): string {
  if (!template) return "";
  return expandDateTokens(template, date);
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
