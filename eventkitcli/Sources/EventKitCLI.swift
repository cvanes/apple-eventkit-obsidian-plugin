import ArgumentParser
import Foundation

@main
struct EventKitCLI: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "eventkitcli",
        abstract: "Command-line interface for Apple Calendar and Reminders via EventKit.",
        version: "1.0.0",
        subcommands: [
            ListCalendars.self,
            ListEvents.self,
            GetEvent.self,
            CreateEvent.self,
            UpdateEvent.self,
            DeleteEvent.self,
            ListReminderLists.self,
            ListReminders.self,
            GetReminder.self,
            CreateReminder.self,
            CompleteReminder.self,
            DeleteReminder.self,
        ]
    )
}

/// Runs an async block and exits the process — used by all async subcommands.
func runAsync(_ block: @escaping () async -> Void) {
    Task {
        await block()
        Foundation.exit(0)
    }
    dispatchMain()
}
