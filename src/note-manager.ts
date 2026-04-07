import { App, Notice, TFile, normalizePath } from "obsidian";
import { BridgeEvent, PluginSettings } from "./types";
import { formatNoteDate } from "./date-utils";

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
  event: BridgeEvent
): Promise<void> {
  const file = findNoteForEvent(app, event.id);
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

function eventDateString(event: BridgeEvent): string {
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
