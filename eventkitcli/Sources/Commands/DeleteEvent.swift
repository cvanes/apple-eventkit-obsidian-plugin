import ArgumentParser
import Foundation

struct DeleteEvent: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "delete-event",
        abstract: "Delete an event.",
        discussion: """
        Permanently deletes the specified event.

        Example:
          eventkitcli delete-event --id "ABC-123"
        """
    )

    @Option(help: "The event identifier.")
    var id: String

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestCalendarAccess()
                try manager.deleteEvent(id: id)
                printJSON(["deleted": id])
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
