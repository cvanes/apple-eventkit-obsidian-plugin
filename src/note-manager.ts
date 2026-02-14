import { App, TFile, normalizePath } from "obsidian";
import { BridgeEvent, PluginSettings } from "./types";
import { formatNoteDate, expandDateTokens, formatTime } from "./date-utils";

const DEFAULT_TEMPLATE = `# {{title}}

| | |
|---|---|
| **Date** | {{date}} |
| **Time** | {{startTime}} - {{endTime}} |
| **Calendar** | {{calendar}} |
| **Location** | {{location}} |

## Meeting Notes

`;

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

  const frontmatter = buildFrontmatter(event, eventDate);
  const body = await buildBody(app, event, settings, eventDate);
  const content = `---\n${frontmatter}---\n\n${body}`;

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

function buildFrontmatter(event: BridgeEvent, eventDate: Date): string {
  const lines = [
    `event-id: "${event.id}"`,
    `event-title: "${escape(event.title)}"`,
    `calendar: "${escape(event.calendarTitle)}"`,
    `event-date: "${formatNoteDate(eventDate, "YYYY-MM-DD")}"`,
    `start-time: "${formatTime(event.startDate)}"`,
    `end-time: "${formatTime(event.endDate)}"`,
  ];
  if (event.location) {
    lines.push(`location: "${escape(event.location)}"`);
  }
  return lines.join("\n") + "\n";
}

async function buildBody(
  app: App,
  event: BridgeEvent,
  settings: PluginSettings,
  eventDate: Date
): Promise<string> {
  const templateContent = await loadTemplate(app, settings.templateFilePath);
  const template = templateContent ?? DEFAULT_TEMPLATE;
  return expandTemplateVars(template, event, eventDate, settings);
}

async function loadTemplate(
  app: App,
  path: string
): Promise<string | null> {
  if (!path) return null;
  const file = app.vault.getAbstractFileByPath(normalizePath(path));
  if (!(file instanceof TFile)) return null;
  return app.vault.read(file);
}

function expandTemplateVars(
  template: string,
  event: BridgeEvent,
  eventDate: Date,
  settings: PluginSettings
): string {
  const vars: Record<string, string> = {
    title: event.title,
    date: formatNoteDate(eventDate, settings.dateFormat),
    startTime: formatTime(event.startDate),
    endTime: formatTime(event.endDate),
    calendar: event.calendarTitle,
    location: event.location || "",
    notes: event.notes || "",
  };
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-");
}

function escape(str: string): string {
  return str.replace(/"/g, '\\"');
}
