# Apple EventKit

An Obsidian plugin that integrates with Apple Calendar and Reminders on macOS.

Browse your daily agenda in the sidebar, create linked notes for calendar events and turn selected text into reminders -- all without leaving Obsidian.

## Features

### Agenda view

A sidebar panel showing your events for the selected day. Navigate between days, jump to a specific date or tap "Today" to return to the current day. Past events are greyed out. The view refreshes every five minutes, and also whenever the window becomes visible or regains focus -- a timer alone goes stale across sleep. If it is showing today and midnight passes, it rolls onto the new day automatically; if you have navigated to another date deliberately, it stays put.

Clicking an event or a reminder creates a linked note (or opens an existing one). Items that already have
a note are highlighted. Right-click an item for **Open in Calendar** / **Open in Reminders** and, when it
has a note, **Unlink note** and **Delete note**. Both ask for confirmation; deleting moves the note to the trash.

### Linked notes

A note is linked to a calendar event or a reminder through its frontmatter, and can live anywhere in the
vault. A single note can be linked to both at once.

```yaml
eventkit-calendar-id: "ABC-123"
eventkit-calendar-date: 2026-02-14
eventkit-reminder-id: "DEF-456"
```

The date is part of the calendar link because every occurrence of a recurring event shares one
identifier; without it, this week's standup would open last week's note.

When the agenda view loads, linked event notes are kept in sync -- if an event moves to another day, the
frontmatter date follows it. Only notes that actually need changes are touched, so last-modified
timestamps are preserved.

**Event notes** created by the plugin get a configurable date prefix and the event's title
(e.g. `2026-02-14 - Team standup.md`), are placed in the configured folder and start from the template
if one is set.

**Reminder notes** created by the plugin are named after the reminder and placed at the vault root.
Linking a note to a reminder writes an [Advanced URI](https://github.com/Vinzent03/obsidian-advanced-uri)
link back to the note into the reminder's notes and URL field, keyed on the note's uid so it survives
renames and moves. The uid field is read from the Advanced URI plugin's settings and added to the note if
missing. Any notes the reminder already had are moved into the Obsidian note first, so nothing is lost.

The link goes into the notes because Reminders on the Mac never shows a URL set through EventKit: it is
stored as the iCalendar URL, while the link chips the app displays are attachments that EventKit cannot
create. Unlinking removes the link from the notes and clears the URL, leaving any other notes in place.

### Link, unlink and open

Run **Link note to calendar event** or **Link note to reminder** on any note to attach it to an existing
item, and the matching **Unlink** command to detach it.

From a linked note, **Open calendar event in Calendar** switches to Apple Calendar on the event's day and
**Open reminder in Reminders** reveals the reminder in Reminders.app.

### Reminders in the agenda

Enable **Show reminders in agenda** in settings to see reminders due on the selected day *interleaved with
that day's events*, the way Apple Calendar does it: all-day items first, then everything else in time
order. Each reminder shows a coloured dot taken from its Reminders list, its due time and list name. Overdue
reminders are dimmed like past events. Reminders created from a selection carry an `obsidian://` URL
without being linked; those show a ↗ that opens the source note.

Restrict which lists appear with **Agenda reminder lists** (comma-separated titles; empty means all).

### Create reminders from text

Select text in any note and run **Create reminder from selection** (also available via the right-click context menu). A modal lets you pick a reminder list, edit the title and set a due date using natural language (e.g. "tomorrow", "next Monday at 9am").

The reminder stores an `obsidian://` link back to the source note in its URL field. The note itself is left untouched.

## Commands

| Command | Description |
|---|---|
| Open agenda view | Show the agenda sidebar |
| View today | Show the agenda sidebar on today's date |
| Create/Open note for calendar event | Pick an upcoming event and create or open its note |
| Create/Open note for reminder | Pick an open reminder and create or open its note |
| Link note to calendar event | Link the current note to a calendar event |
| Link note to reminder | Link the current note to a reminder |
| Unlink note from calendar event | Remove the calendar link from the current note |
| Unlink note from reminder | Remove the reminder link from the current note and from the reminder |
| Open calendar event in Calendar | Open Apple Calendar on the linked event's day |
| Open reminder in Reminders | Reveal the linked reminder in Reminders.app |
| Create reminder from selection | Create a reminder from selected text |
| Reload calendars | Refresh the calendar list from Apple Calendar |

## Settings

- **Date format** -- Moment.js format for the date prefix in note titles (default: `YYYY-MM-DD`).
- **New file location** -- Where event notes are created. Leave empty for vault root. Put date tokens in the date format (e.g. `YYYY/MM/YYYY-MM-DD`) to get dated sub-folders.
- **Template file location** -- Template for new event notes.
- **Default reminder list** -- The list used when creating reminders.
- **Calendars** -- Toggle which calendars appear in the agenda view. Grouped by source (iCloud, Google, Exchange, etc.) just like Apple Calendar.
- **Bridge path** -- Override the path to the `eventkitcli` binary. Leave empty to use the bundled binary.

## Requirements

- macOS (this plugin uses Apple's EventKit framework)
- Obsidian 0.15.0 or later
- Calendar and Reminders permissions must be granted when prompted
- The [Advanced URI](https://github.com/Vinzent03/obsidian-advanced-uri) plugin, for the link back from a reminder to its note

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
