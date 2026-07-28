# Apple EventKit Plugin

Obsidian plugin that integrates with Apple Calendar and Reminders on macOS via a Swift CLI bridge.

## Architecture

The plugin has two parts:

1. **`eventkitcli`** — A standalone Swift CLI tool that wraps Apple's EventKit framework. Bundled alongside the plugin in its directory. All commands output JSON to stdout.
2. **`src/`** — The Obsidian plugin (TypeScript). Calls `eventkitcli` via `child_process.execFile` through a bridge layer (`bridge.ts`).

## Toolchain

Node is pinned to 24.8.0 in `.node-version` (nodenv/fnm/asdf all read it) and enforced by
`engines.node: ">=24"`. Run `npm ci` before the first build — an empty `node_modules` surfaces as
~130 `Cannot find module 'obsidian'` errors that look like source problems but are not.

`@types/node` is intentionally held at v22, not v24: it describes the runtime the *plugin* code
executes in, which is Obsidian's bundled Electron (Node ~20-22), not the build toolchain. The plugin
only touches `child_process`, `fs`, `path` and `util`, so the surface is stable either way.

## Building

- **Plugin**: `npm run build` produces `main.js` in the project root.
- **CLI**: `cd eventkitcli && bash build.sh` builds a universal binary (arm64 + x86_64), codesigns it, and copies it to the plugin directory.

## Key conventions

- The bridge layer (`bridge.ts`) is the only file that calls `child_process`. All CLI interaction goes through it.
- The agenda view separates data/lifecycle (`agenda-view.ts`) from DOM rendering (`agenda-renderer.ts`). Renderer functions are pure — they take a container element and data, and return nothing.
- Events and reminders render as one interleaved list via `AgendaItem`, sorted by `sortAgendaItems`: all-day items first, then timed items by start/due time. Reminders are distinguished only by a checkbox and a list-coloured dot, matching Apple Calendar.
- Refresh triggers are the five-minute timer, `visibilitychange` and window `focus`. The timer does not fire across sleep, so the event listeners are what keep the view current. `advanceIfDayChanged` rolls the view onto the new day at midnight, but only while it is still showing today — explicit navigation sets `renderedForToday` false and is respected.
- Event notes are linked to calendar events via `event-id` in frontmatter. Note lookup scans `app.metadataCache`.
- Settings support moment.js date tokens in `noteFolderPath` (e.g. `YYYY/MM`). Empty path means vault root.

## TCC permissions and the embedded Info.plist

EventKit access is gated by TCC, and TCC requires a usage description on the requesting binary.
A bare command-line tool has no bundle, so `Info.plist` is embedded into a `__TEXT,__info_plist`
section via linker flags in `Package.swift`. **Without it, macOS 14+ denies access and never shows a
prompt** — which presents as a revoked permission when in fact no permission was ever requested.

Verify it is present after a build:

```sh
otool -X -s __TEXT __info_plist .build/eventkitcli | head -3
```

Permission is attributed to the *responsible process*, not to `eventkitcli`. Running it from iTerm
uses iTerm's grant; running it from Obsidian uses Obsidian's; running it from a headless agent uses
that agent's. So a permission can appear granted in one context and denied in another. Inspect the
records with:

```sh
sqlite3 "$HOME/Library/Application Support/com.apple.TCC/TCC.db" \
  "select service, client, auth_value from access
   where service in ('kTCCServiceCalendar','kTCCServiceReminders');"
```

`auth_value` 2 is allowed, 0 is denied. A *missing* row means never asked — which should prompt, and
will not if the Info.plist is absent or the process cannot show UI.

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
