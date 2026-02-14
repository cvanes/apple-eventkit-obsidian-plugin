# Apple EventKit

An Obsidian plugin that integrates with Apple Calendar and Reminders on macOS.

Browse your daily agenda in the sidebar, create linked notes for calendar events and turn selected text into reminders -- all without leaving Obsidian.

## Features

### Agenda view

A sidebar panel showing your events for the selected day. Navigate between days, jump to a specific date or tap "Today" to return to the current day. Past events are greyed out and the view refreshes automatically every five minutes.

Clicking an event creates a linked note (or opens an existing one).

### Event notes

Notes are created with a configurable date prefix and named after the event (e.g. `2026-02-14 - Team standup.md`). Each note stores a minimal frontmatter block:

```yaml
event-id: "ABC-123"
event-date: 2026-02-14
```

When the agenda view loads, linked notes are kept in sync -- if an event title or date has changed, the frontmatter and filename are updated automatically. Only notes that actually need changes are touched, so last-modified timestamps are preserved.

### Link and unlink notes

Use **Link note to calendar event** to attach an existing note to a calendar event. The note is renamed to match the standard naming convention and the required frontmatter is added.

Use **Unlink note from calendar event** to remove the event frontmatter from the current note.

### Open event in Calendar

From any linked note, run **Open event in Calendar** to switch to Apple Calendar and navigate to the event's date.

### Reminders

Select text in any note and run **Create reminder from selection** (also available via the right-click context menu). A modal lets you pick a reminder list, edit the title and set a due date using natural language (e.g. "tomorrow", "next Monday at 9am").

After creation the selected text is replaced with a clickable link to the reminder in Apple Reminders.

## Commands

| Command | Description |
|---|---|
| Open agenda view | Show the agenda sidebar |
| Create note for event | Pick an upcoming event and create a linked note |
| Link note to calendar event | Link the current note to a calendar event |
| Unlink note from calendar event | Remove event link from the current note |
| Open event in Calendar | Open Apple Calendar at the linked event's date |
| Create reminder from selection | Create a reminder from selected text |
| Reload calendars | Refresh the calendar list from Apple Calendar |

## Settings

- **Date format** -- Moment.js format for the date prefix in note titles (default: `YYYY-MM-DD`).
- **Note folder path** -- Where event notes are created. Supports date tokens (e.g. `YYYY/MM`). Leave empty for vault root.
- **Default reminder list** -- The list used when creating reminders.
- **Calendars** -- Toggle which calendars appear in the agenda view. Grouped by source (iCloud, Google, Exchange, etc.) just like Apple Calendar.
- **Bridge path** -- Override the path to the `eventkitcli` binary. Leave empty to use the bundled binary.

## Requirements

- macOS (this plugin uses Apple's EventKit framework)
- Obsidian 0.15.0 or later
- Calendar and Reminders permissions must be granted when prompted

## Architecture

The plugin has two parts:

1. **eventkitcli** -- A Swift CLI tool that wraps Apple's EventKit framework. It ships as a universal binary (arm64 + x86_64) alongside the plugin. All commands output JSON to stdout.
2. **Plugin (TypeScript)** -- Calls `eventkitcli` via `child_process.execFile` through a bridge layer.

## Building from source

```sh
# Build the plugin
npm install
npm run build

# Build the CLI (requires Xcode command line tools)
cd eventkitcli
bash build.sh
```

Copy `main.js`, `manifest.json`, `styles.css` and `eventkitcli-bin` into your vault's `.obsidian/plugins/apple-eventkit/` directory.

## Licence

MIT
