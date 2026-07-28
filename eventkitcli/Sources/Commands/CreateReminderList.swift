import ArgumentParser
import Foundation

struct CreateReminderList: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "create-reminder-list",
        abstract: "Create a reminder list, or return it if the title already exists.",
        discussion: """
        Idempotent: if a list with this title already exists it is returned unchanged,
        so the command is safe to run from setup scripts.

        Example:
          eventkitcli create-reminder-list --title Holiday
        """
    )

    @Option(help: "List title.")
    var title: String

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestReminderAccess()
                printJSON(try manager.createReminderList(title: title))
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
