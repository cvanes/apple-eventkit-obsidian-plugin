import ArgumentParser
import Foundation

struct ListEvents: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "list-events",
        abstract: "List events in a date range.",
        discussion: """
        Fetch calendar events between two dates (inclusive).

        Examples:
          eventkitcli list-events --from 2026-02-14 --to 2026-02-14
          eventkitcli list-events --from 2026-02-01 --to 2026-02-28 --calendars id1,id2
        """
    )

    @Option(help: "Start date (YYYY-MM-DD).")
    var from: String

    @Option(help: "End date (YYYY-MM-DD).")
    var to: String

    @Option(help: "Comma-separated calendar IDs to filter by.")
    var calendars: String?

    func run() {
        runAsync {
            let manager = EventKitManager()
            do {
                try await manager.requestCalendarAccess()
                guard let fromDate = parseDate(from), let toDate = parseDate(to) else {
                    printError("Invalid date format. Use YYYY-MM-DD.")
                    return
                }
                let endOfDay = Calendar.current.date(bySettingHour: 23, minute: 59, second: 59, of: toDate)!
                let ids = calendars?.split(separator: ",").map(String.init)
                printJSON(manager.listEvents(from: fromDate, to: endOfDay, calendarIds: ids))
            } catch {
                printError(error.localizedDescription)
            }
        }
    }
}

private func parseDate(_ str: String) -> Date? {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    f.locale = Locale(identifier: "en_US_POSIX")
    return f.date(from: str)
}
