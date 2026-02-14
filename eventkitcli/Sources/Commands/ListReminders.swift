import ArgumentParser
import Foundation

struct ListReminders: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "list-reminders",
        abstract: "List reminders from a specific list.",
        discussion: """
        Returns reminders from the given reminder list.

        Examples:
          eventkitcli list-reminders --list LIST-ID
          eventkitcli list-reminders --list LIST-ID --incomplete-only
        """
    )

    @Option(help: "Reminder list ID.")
    var list: String

    @Flag(help: "Only return incomplete reminders.")
    var incompleteOnly = false

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestReminderAccess()
                let reminders = try await manager.listReminders(listId: list, incompleteOnly: incompleteOnly)
                printJSON(reminders)
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
