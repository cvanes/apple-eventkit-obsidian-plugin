import ArgumentParser
import Foundation

/// One entry in the batch payload. `list` may be a list title or an identifier.
struct BatchReminderInput: Codable {
    let list: String
    let title: String
    let due: String?
    let notes: String?
    let priority: Int?
    let url: String?
    let allDay: Bool?
}

struct BatchResult: Codable {
    let created: [ReminderInfo]
    let failed: [BatchFailure]
}

struct BatchFailure: Codable {
    let title: String
    let error: String
}

struct CreateRemindersBatch: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "create-reminders",
        abstract: "Create many reminders from a JSON array on stdin.",
        discussion: """
        Reads a JSON array of objects, each requiring `list` and `title`. Optional keys:
        `due` (ISO 8601), `notes`, `priority`, `url`, `allDay`.

        Saves are batched into a single commit, which is dramatically faster than one
        process per reminder when importing from another task system.

        A failure on one entry does not abort the run; failures are reported per item.

        Example:
          echo '[{"list":"Work","title":"Draft proposal","due":"2026-08-04T09:00:00Z"}]' \\
            | eventkitcli create-reminders
        """
    )

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestReminderAccess()
                let data = FileHandle.standardInput.readDataToEndOfFile()
                let inputs = try JSONDecoder().decode([BatchReminderInput].self, from: data)

                var created: [ReminderInfo] = []
                var failed: [BatchFailure] = []
                let iso = ISO8601DateFormatter()

                for input in inputs {
                    do {
                        let info = try manager.createReminder(
                            list: input.list,
                            title: input.title,
                            dueDate: input.due.flatMap { iso.date(from: $0) },
                            notes: input.notes,
                            priority: input.priority,
                            url: input.url,
                            allDay: input.allDay ?? false,
                            commit: false
                        )
                        created.append(info)
                    } catch {
                        failed.append(BatchFailure(title: input.title, error: error.localizedDescription))
                    }
                }
                try manager.commitChanges()
                printJSON(BatchResult(created: created, failed: failed))
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}
