import ArgumentParser
import Foundation

struct UpdateEvent: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "update-event",
        abstract: "Update an existing event.",
        discussion: """
        Update one or more fields of an existing event. Only provided fields are changed.

        Example:
          eventkitcli update-event --id "ABC-123" --title "New Title" --location "Room 2"
        """
    )

    @Option(help: "The event identifier.")
    var id: String

    @Option(help: "New title.")
    var title: String?

    @Option(help: "New start date/time (ISO 8601).")
    var start: String?

    @Option(help: "New end date/time (ISO 8601).")
    var end: String?

    @Option(help: "New location.")
    var location: String?

    @Option(help: "New notes.")
    var notes: String?

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestCalendarAccess()
                let iso = ISO8601DateFormatter()
                let startDate = start.flatMap { iso.date(from: $0) }
                let endDate = end.flatMap { iso.date(from: $0) }
                let event = try manager.updateEvent(
                    id: id, title: title,
                    start: startDate, end: endDate,
                    location: location, notes: notes
                )
                printJSON(event)
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
