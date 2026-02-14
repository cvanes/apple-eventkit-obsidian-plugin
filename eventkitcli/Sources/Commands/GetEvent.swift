import ArgumentParser
import Foundation

struct GetEvent: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "get-event",
        abstract: "Get a single event by ID.",
        discussion: """
        Returns the full details of a calendar event.

        Example:
          eventkitcli get-event --id "ABC-123"
        """
    )

    @Option(help: "The event identifier.")
    var id: String

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestCalendarAccess()
                guard let event = manager.getEvent(id: id) else {
                    printError("Event not found: \(id)")
                    return
                }
                printJSON(event)
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
