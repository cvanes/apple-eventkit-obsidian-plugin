import { App, TFile, normalizePath } from "obsidian";
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

async function createEventNote(
  app: App,
  event: BridgeEvent,
  settings: PluginSettings
): Promise<TFile> {
  const eventDate = new Date(event.startDate);
  const folderPath = resolveFolderPath(settings.noteFolderPath, eventDate);
  await ensureFolder(app, folderPath);

  const datePrefix = formatNoteDate(eventDate, settings.dateFormat);
  const safeTitle = sanitizeFilename(event.title);
  const filename = `${datePrefix} - ${safeTitle}.md`;
  const fullPath = folderPath
    ? normalizePath(`${folderPath}/${filename}`)
    : normalizePath(filename);

  const frontmatter = buildFrontmatter(event);
  const content = `---\n${frontmatter}---\n`;

  return app.vault.create(fullPath, content);
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

function buildFrontmatter(event: BridgeEvent): string {
  const date = new Date(event.startDate).toISOString().slice(0, 10);
  return `event-id: "${event.id}"\nevent-date: ${date}\n`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-");
}
