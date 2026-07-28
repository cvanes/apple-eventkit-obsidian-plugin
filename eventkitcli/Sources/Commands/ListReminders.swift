import ArgumentParser
import Foundation

struct ListReminders: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "list-reminders",
        abstract: "List reminders, from one list or from every list.",
        discussion: """
        Omit --list to search every reminder list. Results are sorted by due date,
        with undated reminders last.

        Examples:
          eventkitcli list-reminders --list Work --incomplete-only
          eventkitcli list-reminders --incomplete-only
          eventkitcli list-reminders --incomplete-only --due-before 2026-08-01T00:00:00Z
        """
    )

    @Option(help: "Reminder list title or ID. Omit to search all lists.")
    var list: String?

    @Flag(help: "Only return incomplete reminders.")
    var incompleteOnly = false

    @Option(help: "Only return reminders due before this date/time (ISO 8601). Undated reminders are excluded.")
    var dueBefore: String?

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestReminderAccess()
                let cutoff = dueBefore.flatMap { ISO8601DateFormatter().date(from: $0) }
                let reminders = try await manager.listReminders(
                    list: list, incompleteOnly: incompleteOnly, dueBefore: cutoff
                )
                printJSON(reminders)
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
