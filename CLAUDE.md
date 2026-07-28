# Apple EventKit Plugin

Obsidian plugin that integrates with Apple Calendar and Reminders on macOS via a Swift CLI bridge.

## Architecture

The plugin has two parts:

1. **`eventkitcli`** — A standalone Swift CLI tool that wraps Apple's EventKit framework. Bundled alongside the plugin in its directory. All commands output JSON to stdout.
2. **`src/`** — The Obsidian plugin (TypeScript). Calls `eventkitcli` via `child_process.execFile` through a bridge layer (`bridge.ts`).

## The CLI is not installed on PATH

`install.sh` copies `eventkitcli` into the plugin directory only. It is deliberately **not** installed to
`~/.local/bin`: run from a terminal, TCC attributes its requests to that terminal, so access depends on
which terminal you happen to be in (see below). Run from Obsidian, attribution is to Obsidian, which holds
both grants — so the plugin path is the reliable one. To invoke it by hand, use the built or installed
binary directly:

```sh
./eventkitcli/.build/eventkitcli --help
"$HOME/second-brain/.obsidian/plugins/apple-eventkit-obsidian-plugin/eventkitcli" --help
```

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
- Deep-linking into Reminders.app needs `externalId` (`calendarItemExternalIdentifier`), **not** `id` (`calendarItemIdentifier`) — the two are different UUID spaces and Reminders only recognises the former. There is no usable URL scheme either: `x-apple-reminder://` is not registered with Launch Services, so `open` fails with `kLSApplicationNotFoundErr`. AppleScript does resolve it, so `show reminder id "x-apple-reminder://<externalId>"` via osascript is the route, matching the existing Calendar opener.
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

**The host app needs the usage description too.** Embedding `Info.plist` in `eventkitcli` is necessary
but not sufficient: because TCC attributes to the responsible process, the launching app must also
declare the relevant `NS*UsageDescription`. If it does not, no prompt can appear and the app never
shows up in the Privacy pane to be enabled manually. Observed in practice — iTerm declares and holds
both Calendars and Reminders, while cmux declares Apple Events, Bluetooth, Camera and Microphone but
no Calendars, so `list-calendars` fails there and cannot be fixed from System Settings. `PermissionError`
reports the launching app (from `TERM_PROGRAM`) so the denial is diagnosable rather than misleading.

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

Alias the built binary first, since it is not on PATH:

```sh
alias ekc=./eventkitcli/.build/eventkitcli

ekc list-calendars
ekc list-events --from 2026-02-14 --to 2026-02-14
ekc list-reminder-lists
ekc create-reminder-list --title Holiday          # idempotent
ekc list-reminders --incomplete-only              # across all lists
ekc list-reminders --list Work --due-before 2026-08-01T00:00:00Z
ekc create-reminder --list Work --title "Review draft" --url "obsidian://open?vault=v&file=Note"
ekc update-reminder --id ID --clear-due
echo '[{"list":"Work","title":"Batch one"}]' | ekc create-reminders   # single commit
ekc --help
```

Calendar commands need a terminal that holds the Calendars grant. Reminders commands are more widely
granted. If either is denied, the error names the launching app.

## Testing the plugin

Copy the built plugin files (`main.js`, `manifest.json`, `styles.css`, `eventkitcli-bin`) into a vault's `.obsidian/plugins/apple-eventkit/` directory and enable it in Obsidian settings.
