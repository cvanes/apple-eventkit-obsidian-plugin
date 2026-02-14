import EventKit
import Foundation

class EventKitManager {
    let store = EKEventStore()

    private let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private let dateOnlyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    // MARK: - Permissions

    func requestCalendarAccess() async throws {
        let granted = try await store.requestFullAccessToEvents()
        guard granted else {
            throw PermissionError.calendarDenied
        }
    }

    func requestReminderAccess() async throws {
        let granted = try await store.requestFullAccessToReminders()
        guard granted else {
            throw PermissionError.reminderDenied
        }
    }

    // MARK: - Calendars

    func listCalendars() -> [CalendarInfo] {
        store.calendars(for: .event).map { calendarInfo($0) }
    }

    // MARK: - Events

    func listEvents(from: Date, to: Date, calendarIds: [String]?) -> [EventInfo] {
        let calendars = resolveCalendars(ids: calendarIds)
        let predicate = store.predicateForEvents(withStart: from, end: to, calendars: calendars)
        return store.events(matching: predicate).map { eventInfo($0) }
    }

    func getEvent(id: String) -> EventInfo? {
        guard let event = store.event(withIdentifier: id) else { return nil }
        return eventInfo(event)
    }

    func createEvent(
        calendarId: String, title: String, start: Date, end: Date,
        location: String?, notes: String?, allDay: Bool
    ) throws -> EventInfo {
        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = start
        event.endDate = end
        event.isAllDay = allDay
        event.location = location
        event.notes = notes
        event.calendar = store.calendar(withIdentifier: calendarId)
            ?? store.defaultCalendarForNewEvents
        try store.save(event, span: .thisEvent)
        return eventInfo(event)
    }

    func updateEvent(
        id: String, title: String?, start: Date?, end: Date?,
        location: String?, notes: String?
    ) throws -> EventInfo {
        guard let event = store.event(withIdentifier: id) else {
            throw EventKitError.eventNotFound(id)
        }
        if let title { event.title = title }
        if let start { event.startDate = start }
        if let end { event.endDate = end }
        if let location { event.location = location }
        if let notes { event.notes = notes }
        try store.save(event, span: .thisEvent)
        return eventInfo(event)
    }

    func deleteEvent(id: String) throws {
        guard let event = store.event(withIdentifier: id) else {
            throw EventKitError.eventNotFound(id)
        }
        try store.remove(event, span: .thisEvent)
    }

    // MARK: - Reminder Lists

    func listReminderLists() -> [ReminderListInfo] {
        store.calendars(for: .reminder).map { reminderListInfo($0) }
    }

    // MARK: - Reminders

    func listReminders(listId: String, incompleteOnly: Bool) async throws -> [ReminderInfo] {
        guard let calendar = store.calendar(withIdentifier: listId) else {
            throw EventKitError.reminderListNotFound(listId)
        }
        let predicate = store.predicateForReminders(in: [calendar])
        let reminders = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<[EKReminder], Error>) in
            store.fetchReminders(matching: predicate) { result in
                cont.resume(returning: result ?? [])
            }
        }
        let mapped = reminders.map { reminderInfo($0) }
        return incompleteOnly ? mapped.filter { !$0.isCompleted } : mapped
    }

    func getReminder(id: String) -> ReminderInfo? {
        guard let item = store.calendarItem(withIdentifier: id) as? EKReminder else { return nil }
        return reminderInfo(item)
    }

    func createReminder(
        listId: String, title: String, dueDate: Date?, notes: String?, priority: Int?
    ) throws -> ReminderInfo {
        let reminder = EKReminder(eventStore: store)
        reminder.title = title
        reminder.notes = notes
        reminder.priority = priority ?? 0
        reminder.calendar = store.calendar(withIdentifier: listId)
            ?? store.defaultCalendarForNewReminders()
        if let dueDate {
            reminder.dueDateComponents = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute], from: dueDate
            )
        }
        try store.save(reminder, commit: true)
        return reminderInfo(reminder)
    }

    func completeReminder(id: String) throws -> ReminderInfo {
        guard let reminder = store.calendarItem(withIdentifier: id) as? EKReminder else {
            throw EventKitError.reminderNotFound(id)
        }
        reminder.isCompleted = true
        try store.save(reminder, commit: true)
        return reminderInfo(reminder)
    }

    func deleteReminder(id: String) throws {
        guard let reminder = store.calendarItem(withIdentifier: id) as? EKReminder else {
            throw EventKitError.reminderNotFound(id)
        }
        try store.remove(reminder, commit: true)
    }

    // MARK: - Helpers

    private func resolveCalendars(ids: [String]?) -> [EKCalendar]? {
        guard let ids, !ids.isEmpty else { return nil }
        return ids.compactMap { store.calendar(withIdentifier: $0) }
    }

    private func calendarInfo(_ cal: EKCalendar) -> CalendarInfo {
        CalendarInfo(id: cal.calendarIdentifier, title: cal.title, color: hexColor(cal.cgColor), source: cal.source.title)
    }

    private func eventInfo(_ event: EKEvent) -> EventInfo {
        EventInfo(
            id: event.eventIdentifier,
            title: event.title ?? "",
            startDate: isoFormatter.string(from: event.startDate),
            endDate: isoFormatter.string(from: event.endDate),
            isAllDay: event.isAllDay,
            location: event.location ?? "",
            notes: event.notes ?? "",
            calendarId: event.calendar.calendarIdentifier,
            calendarTitle: event.calendar.title,
            calendarColor: hexColor(event.calendar.cgColor)
        )
    }

    private func reminderListInfo(_ cal: EKCalendar) -> ReminderListInfo {
        ReminderListInfo(id: cal.calendarIdentifier, title: cal.title, color: hexColor(cal.cgColor))
    }

    private func reminderInfo(_ reminder: EKReminder) -> ReminderInfo {
        var dueDateStr: String? = nil
        if let comps = reminder.dueDateComponents, let date = Calendar.current.date(from: comps) {
            dueDateStr = isoFormatter.string(from: date)
        }
        return ReminderInfo(
            id: reminder.calendarItemIdentifier,
            title: reminder.title ?? "",
            notes: reminder.notes ?? "",
            dueDate: dueDateStr,
            isCompleted: reminder.isCompleted,
            priority: reminder.priority,
            listId: reminder.calendar.calendarIdentifier,
            listTitle: reminder.calendar.title
        )
    }

    private func hexColor(_ cgColor: CGColor?) -> String {
        guard let c = cgColor, let comps = c.components, comps.count >= 3 else { return "#888888" }
        let r = Int(comps[0] * 255)
        let g = Int(comps[1] * 255)
        let b = Int(comps[2] * 255)
        return String(format: "#%02x%02x%02x", r, g, b)
    }
}

// MARK: - Errors

enum PermissionError: LocalizedError {
    case calendarDenied
    case reminderDenied

    var errorDescription: String? {
        switch self {
        case .calendarDenied:
            return "Calendar access denied. Grant permission in System Settings > Privacy & Security > Calendars."
        case .reminderDenied:
            return "Reminders access denied. Grant permission in System Settings > Privacy & Security > Reminders."
        }
    }
}

enum EventKitError: LocalizedError {
    case eventNotFound(String)
    case reminderNotFound(String)
    case reminderListNotFound(String)

    var errorDescription: String? {
        switch self {
        case .eventNotFound(let id): return "Event not found: \(id)"
        case .reminderNotFound(let id): return "Reminder not found: \(id)"
        case .reminderListNotFound(let id): return "Reminder list not found: \(id)"
        }
    }
}
