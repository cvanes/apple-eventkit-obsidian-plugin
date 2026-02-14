import Foundation

struct CalendarInfo: Codable {
    let id: String
    let title: String
    let color: String
    let source: String
}

struct EventInfo: Codable {
    let id: String
    let title: String
    let startDate: String
    let endDate: String
    let isAllDay: Bool
    let location: String
    let notes: String
    let calendarId: String
    let calendarTitle: String
    let calendarColor: String
}

struct ReminderListInfo: Codable {
    let id: String
    let title: String
    let color: String
}

struct ReminderInfo: Codable {
    let id: String
    let title: String
    let notes: String
    let dueDate: String?
    let isCompleted: Bool
    let priority: Int
    let listId: String
    let listTitle: String
}
