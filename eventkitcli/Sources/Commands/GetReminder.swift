import ArgumentParser
import Foundation

struct GetReminder: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "get-reminder",
        abstract: "Get a single reminder by ID.",
        discussion: """
        Returns the full details of a reminder.

        Example:
          eventkitcli get-reminder --id "REM-456"
        """
    )

    @Option(help: "The reminder identifier.")
    var id: String

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestReminderAccess()
                guard let reminder = manager.getReminder(id: id) else {
                    printError("Reminder not found: \(id)")
                    return
                }
                printJSON(reminder)
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
