import Foundation

/// JSON-shaped, platform-independent property and event values. No DOM objects cross this boundary.
public enum AWCValue: Codable, Hashable, Sendable {
    case string(String), number(Double), bool(Bool), array([AWCValue]), object([String: AWCValue]), null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([AWCValue].self) { self = .array(value) }
        else { self = .object(try container.decode([String: AWCValue].self)) }
    }
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
    public var string: String {
        switch self {
        case .string(let v): return v
        case .number(let v): return v == v.rounded() ? String(format: "%.0f", v) : String(v)
        case .bool(let v): return String(v)
        default: return ""
        }
    }
    public var number: Double? {
        if case .number(let v) = self { return v }
        if case .string(let v) = self { return Double(v) }
        return nil
    }
    public var bool: Bool? {
        if case .bool(let v) = self { return v }
        if case .string(let v) = self { return ["true", "1", ""].contains(v) }
        return nil
    }
    public var array: [AWCValue] {
        if case .array(let v) = self { return v }
        if case .string(let json) = self, let data = json.data(using: .utf8),
           let v = try? JSONDecoder().decode([AWCValue].self, from: data) { return v }
        return []
    }
    public var object: [String: AWCValue] {
        if case .object(let v) = self { return v }
        return [:]
    }
    public subscript(_ key: String) -> AWCValue { object[key] ?? .null }
    public var json: String {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return (try? String(data: encoder.encode(self), encoding: .utf8)) ?? "null"
    }
}

extension AWCValue: ExpressibleByStringLiteral, ExpressibleByBooleanLiteral, ExpressibleByIntegerLiteral, ExpressibleByFloatLiteral, ExpressibleByArrayLiteral, ExpressibleByDictionaryLiteral {
    public init(stringLiteral value: String) { self = .string(value) }
    public init(booleanLiteral value: Bool) { self = .bool(value) }
    public init(integerLiteral value: Int) { self = .number(Double(value)) }
    public init(floatLiteral value: Double) { self = .number(value) }
    public init(arrayLiteral elements: AWCValue...) { self = .array(elements) }
    public init(dictionaryLiteral elements: (String, AWCValue)...) { self = .object(Dictionary(uniqueKeysWithValues: elements)) }
}

public struct AWCNode: Identifiable, Codable, Hashable, Sendable {
    public var id: String
    public var tag: String
    public var properties: [String: AWCValue]
    public var children: [AWCNode]
    public var slot: String?
    public init(id: String = UUID().uuidString, tag: String, properties: [String: AWCValue] = [:], children: [AWCNode] = [], slot: String? = nil) {
        self.id = id; self.tag = tag; self.properties = properties; self.children = children; self.slot = slot
    }
    public static func text(_ value: String, slot: String? = nil) -> AWCNode {
        AWCNode(tag: "#text", properties: ["text": .string(value)], slot: slot)
    }
}

public struct AWCEvent: Identifiable, Sendable {
    public let id: UUID
    public let name: String
    public let tag: String
    public let nodeID: String
    public let detail: AWCValue
    /// Observation of cancellation after synchronous native scope dispatch.
    public internal(set) var defaultPrevented: Bool = false
    public init(name: String, tag: String, nodeID: String, detail: AWCValue = .null) {
        self.id = UUID(); self.name = name; self.tag = tag; self.nodeID = nodeID; self.detail = detail
    }
}
