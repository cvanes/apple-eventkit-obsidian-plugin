# Apple EventKit Plugin

Obsidian plugin that integrates with Apple Calendar and Reminders on macOS via a Swift CLI bridge.

## Architecture

The plugin has two parts:

1. **`eventkitcli`** — A standalone Swift CLI tool that wraps Apple's EventKit framework. Bundled alongside the plugin in its directory. All commands output JSON to stdout.
2. **`src/`** — The Obsidian plugin (TypeScript). Calls `eventkitcli` via `child_process.execFile` through a bridge layer (`bridge.ts`).

## Building

- **Plugin**: `npm run build` produces `main.js` in the project root.
- **CLI**: `cd eventkitcli && bash build.sh` builds a universal binary (arm64 + x86_64), codesigns it, and copies it to the plugin directory.

## Key conventions

- The bridge layer (`bridge.ts`) is the only file that calls `child_process`. All CLI interaction goes through it.
- The agenda view separates data/lifecycle (`agenda-view.ts`) from DOM rendering (`agenda-renderer.ts`). Renderer functions are pure — they take a container element and data, and return nothing.
- Event notes are linked to calendar events via `event-id` in frontmatter. Note lookup scans `app.metadataCache`.
- Settings support moment.js date tokens in `noteFolderPath` (e.g. `YYYY/MM`). Empty path means vault root.

## Reminder list resolution

`--list` accepts either a list title or an identifier, resolved by `EventKitManager.resolveReminderList`.
Titles are matched case-insensitively and an ambiguous title is an error rather than a silent pick.
This keeps scripts and agents free of UUIDs.

## All-day due dates

`EKReminder` has no `isAllDay`, so it is inferred from `dueDateComponents` having no hour or minute.
All-day reminders report `dueDate` as `YYYY-MM-DD` and timed ones as ISO 8601, with `isAllDay` alongside.
Reporting a UTC instant for an all-day reminder shifts the apparent day either side of midnight.

Swift's synthesised `Codable` omits nil optionals, so `dueDate` and `url` may be **absent** rather than
null. The TypeScript types mark them optional to match.

## Out of scope: private API features

RemCTL supports Reminders features that EventKit does not expose publicly — subtasks, tags, sections,
templates and smart lists — by using the private `ReminderKit` framework. This CLI deliberately stays on
public EventKit, so those are unavailable. Import paths that carry them (e.g. TickTick subtasks) flatten
them into the notes field instead.

## Testing the CLI standalone

```sh
eventkitcli list-calendars
eventkitcli list-events --from 2026-02-14 --to 2026-02-14
eventkitcli list-reminder-lists
eventkitcli create-reminder-list --title Holiday          # idempotent
eventkitcli list-reminders --incomplete-only              # across all lists
eventkitcli list-reminders --list Work --due-before 2026-08-01T00:00:00Z
eventkitcli create-reminder --list Work --title "Review draft" --url "obsidian://open?vault=v&file=Note"
eventkitcli update-reminder --id ID --clear-due
echo '[{"list":"Work","title":"Batch one"}]' | eventkitcli create-reminders   # single commit
eventkitcli --help
```

## Testing the plugin

Copy the built plugin files (`main.js`, `manifest.json`, `styles.css`, `eventkitcli-bin`) into a vault's `.obsidian/plugins/apple-eventkit/` directory and enable it in Obsidian settings.
