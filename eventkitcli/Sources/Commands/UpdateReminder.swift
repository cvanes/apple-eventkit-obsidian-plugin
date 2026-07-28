import ArgumentParser
import Foundation

struct UpdateReminder: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "update-reminder",
        abstract: "Update an existing reminder.",
        discussion: """
        Only the options you pass are changed. Use --clear-due to remove a due date.

        Examples:
          eventkitcli update-reminder --id ID --title "New title"
          eventkitcli update-reminder --id ID --due 2026-08-04T09:00:00Z --priority 1
          eventkitcli update-reminder --id ID --clear-due
        """
    )

    @Option(help: "Reminder ID.")
    var id: String

    @Option(help: "New title.")
    var title: String?

    @Option(help: "New due date/time (ISO 8601).")
    var due: String?

    @Option(help: "New notes.")
    var notes: String?

    @Option(help: "Priority (0 = none, 1 = high, 5 = medium, 9 = low).")
    var priority: Int?

    @Option(help: "Attached URL, e.g. an obsidian:// deep link.")
    var url: String?

    @Flag(help: "Remove the due date.")
    var clearDue: Bool = false

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestReminderAccess()
                let dueDate = due.flatMap { ISO8601DateFormatter().date(from: $0) }
                let reminder = try manager.updateReminder(
                    id: id, title: title, dueDate: dueDate, notes: notes,
                    priority: priority, url: url, clearDue: clearDue
                )
                printJSON(reminder)
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
