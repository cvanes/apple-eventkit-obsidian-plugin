import Foundation

struct SuccessResponse<T: Codable>: Codable {
    let status: String
    let data: T

    init(data: T) {
        self.status = "ok"
        self.data = data
    }
}

struct ErrorResponse: Codable {
    let status: String
    let message: String

    init(message: String) {
        self.status = "error"
        self.message = message
    }
}

func printJSON<T: Codable>(_ data: T) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let response = SuccessResponse(data: data)
    guard let json = try? encoder.encode(response),
          let str = String(data: json, encoding: .utf8) else { return }
    print(str)
}

func printError(_ message: String) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let response = ErrorResponse(message: message)
    guard let json = try? encoder.encode(response),
          let str = String(data: json, encoding: .utf8) else { return }
    print(str)
}
