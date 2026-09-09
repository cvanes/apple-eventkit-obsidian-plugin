import { App } from "obsidian";
import { randomUUID } from "crypto";
import type { Frontmatter } from "./note-index";

const ADVANCED_URI_PLUGIN_ID = "obsidian-advanced-uri";
const DEFAULT_ID_FIELD = "uid";

/**
 * Links into the vault use the Advanced URI plugin's `uid` form rather than a
 * file path, so they survive the note being renamed or moved. Advanced URI lets
 * the user pick which frontmatter field holds that id, so read its setting
 * rather than asking for it again here.
 */
export function advancedUriIdField(app: App): string {
  const settings = pluginRegistry(app)?.plugins?.[ADVANCED_URI_PLUGIN_ID]?.settings;
  return settings?.idField || DEFAULT_ID_FIELD;
}

export function isAdvancedUriEnabled(app: App): boolean {
  return pluginRegistry(app)?.enabledPlugins?.has(ADVANCED_URI_PLUGIN_ID) ?? false;
}

/** Ensure the note carries an id and return it. Call from inside processFrontMatter. */
export function ensureNoteUid(fm: Frontmatter, idField: string): string {
  const existing = fm[idField];
  if (typeof existing === "string" && existing) return existing;
  const uid = randomUUID();
  fm[idField] = uid;
  return uid;
}

const ADVANCED_URI_PREFIX = "obsidian://adv-uri?";

export function buildAdvancedUri(app: App, uid: string): string {
  const vault = encodeURIComponent(app.vault.getName());
  return `${ADVANCED_URI_PREFIX}vault=${vault}&uid=${encodeURIComponent(uid)}`;
}

export function isAdvancedUri(text: string): boolean {
  return text.startsWith(ADVANCED_URI_PREFIX);
}

/** Obsidian's plugin registry is not part of the public API. */
function pluginRegistry(app: App): any {
  return (app as any).plugins;
}
