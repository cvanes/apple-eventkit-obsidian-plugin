import ArgumentParser
import Foundation

struct CreateEvent: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "create-event",
        abstract: "Create a new calendar event.",
        discussion: """
        Creates an event in the specified calendar.

        Examples:
          eventkitcli create-event --calendar CAL-ID --title "Meeting" --start 2026-02-14T09:00:00Z --end 2026-02-14T10:00:00Z
          eventkitcli create-event --calendar CAL-ID --title "Day Off" --start 2026-02-14T00:00:00Z --end 2026-02-15T00:00:00Z --all-day
        """
    )

    @Option(help: "Calendar ID to create the event in.")
    var calendar: String

    @Option(help: "Event title.")
    var title: String

    @Option(help: "Start date/time (ISO 8601).")
    var start: String

    @Option(help: "End date/time (ISO 8601).")
    var end: String

    @Option(help: "Event location.")
    var location: String?

    @Option(help: "Event notes.")
    var notes: String?

    @Flag(help: "Mark as an all-day event.")
    var allDay = false

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestCalendarAccess()
                let iso = ISO8601DateFormatter()
                guard let startDate = iso.date(from: start), let endDate = iso.date(from: end) else {
                    printError("Invalid ISO 8601 date format.")
                    return
                }
                let event = try manager.createEvent(
                    calendarId: calendar, title: title,
                    start: startDate, end: endDate,
                    location: location, notes: notes, allDay: allDay
                )
                printJSON(event)
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
