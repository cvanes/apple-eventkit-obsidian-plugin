import ArgumentParser
import Foundation

struct ListReminderLists: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "list-reminder-lists",
        abstract: "List all reminder lists.",
        discussion: """
        Returns an array of reminder lists (not event calendars).

        Example:
          eventkitcli list-reminder-lists
        """
    )

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestReminderAccess()
                printJSON(manager.listReminderLists())
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
