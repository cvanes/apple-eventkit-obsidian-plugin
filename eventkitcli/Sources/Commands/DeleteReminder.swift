import ArgumentParser
import Foundation

struct DeleteReminder: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "delete-reminder",
        abstract: "Delete a reminder.",
        discussion: """
        Permanently deletes the specified reminder.

        Example:
          eventkitcli delete-reminder --id "REM-456"
        """
    )

    @Option(help: "The reminder identifier.")
    var id: String

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestReminderAccess()
                try manager.deleteReminder(id: id)
                printJSON(["deleted": id])
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
