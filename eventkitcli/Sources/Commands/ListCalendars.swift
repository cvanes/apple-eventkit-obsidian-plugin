import ArgumentParser
import Foundation

struct ListCalendars: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "list-calendars",
        abstract: "List all event calendars.",
        discussion: """
        Returns an array of event calendars (not reminder lists).

        Example:
          eventkitcli list-calendars
        """
    )

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestCalendarAccess()
                printJSON(manager.listCalendars())
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
