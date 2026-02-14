import ArgumentParser
import Foundation

struct CreateReminder: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "create-reminder",
        abstract: "Create a new reminder.",
        discussion: """
        Creates a reminder in the specified list.

        Examples:
          eventkitcli create-reminder --list LIST-ID --title "Buy milk"
          eventkitcli create-reminder --list LIST-ID --title "Call dentist" --due 2026-02-15T10:00:00Z --priority 1
        """
    )

    @Option(help: "Reminder list ID.")
    var list: String

    @Option(help: "Reminder title.")
    var title: String

    @Option(help: "Due date/time (ISO 8601).")
    var due: String?

    @Option(help: "Reminder notes.")
    var notes: String?

    @Option(help: "Priority (0 = none, 1 = high, 5 = medium, 9 = low).")
    var priority: Int?

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestReminderAccess()
                let dueDate = due.flatMap { ISO8601DateFormatter().date(from: $0) }
                let reminder = try manager.createReminder(
                    listId: list, title: title,
                    dueDate: dueDate, notes: notes, priority: priority
                )
                printJSON(reminder)
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
