import ArgumentParser
import Foundation

struct CompleteReminder: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "complete-reminder",
        abstract: "Mark a reminder as complete.",
        discussion: """
        Sets the specified reminder's completion status to true.

        Example:
          eventkitcli complete-reminder --id "REM-456"
        """
    )

    @Option(help: "The reminder identifier.")
    var id: String

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestReminderAccess()
                let reminder = try manager.completeReminder(id: id)
                printJSON(reminder)
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
