import Foundation
@testable import AWCUI

@main enum NativeAccordionInitializationIntegration {
    static func main() throws {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/accordion-web-initialization.json")
        let reference = try JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: url))
        var checks = 0, failures = 0
        func check(_ value: Bool, _ label: String) { checks += 1; if !value { failures += 1; print("FAIL: " + label) } }
        var results: [AWCValue] = []
        for test in reference["cases"].array {
            let id = test["id"].string, mode = test["mode"].string
            let children = test["items"].array.enumerated().map { index, props in
                AWCNode(id: index == 0 ? "first" : "second", tag: "md-accordion-item", properties: props.object)
            }
            let runtime = AWCNativeAccordionRuntime(node: .init(id: "accordion", tag: "md-accordion", properties: test["properties"].object, children: children))
            var trace: [AWCValue] = []
            func snapshot() -> AWCValue { .array(runtime.state.items.map {
                ["id": .string($0.id), "expanded": .bool($0.expanded), "collapsible": .bool($0.collapsible), "index": .number(Double($0.index))]
            }) }
            func record(_ context: AWCEventContext, phase: String) {
                trace.append(["phase": .string(phase), "name": .string(context.event.name), "target": .string(context.targetID),
                              "detail": context.event.detail, "prevented": .bool(context.defaultPrevented), "stopped": .bool(context.propagationStopped), "items": snapshot()])
            }
            let outer = AWCEventDispatcher(id: "outer", onCapture: { context in
                if mode == "capture-stop" && context.event.name == "mdItemToggle" { context.stopPropagation() }
                record(context, phase: "capture")
            }) { context in record(context, phase: "bubble") }
            runtime.bind(dispatcher: outer, listeners: [.init { context in
                if context.event.name == "mdItemToggle" {
                    if mode == "prevent" { context.preventDefault() }
                    if mode == "stop" { context.stopPropagation() }
                    if mode == "immediate" { context.stopImmediatePropagation() }
                }
                record(context, phase: "target")
            }], observe: { _ in })
            check(trace.isEmpty, id + " preparing first layout does not dispatch or replay events")
            runtime.appear()
            check(.array(trace) == test["trace"], id + " capture/target/nested-bubble order and in-listener state match Web")
            check(snapshot() == test["final"], id + " final item state matches Web")
            let count = trace.count; runtime.appear()
            check(trace.count == count, id + " repeated appearance while connected never replays initialization")
            runtime.disappear(); runtime.appear()
            check(trace.count == count, id + " disconnection/reconnection does not reapply initial defaults")
            results.append(["id": .string(id), "trace": .array(trace), "final": snapshot()])
        }
        if let path = ProcessInfo.processInfo.environment["AWC_ACCORDION_INIT_OUTPUT"] {
            let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(AWCValue.array(results)).write(to: URL(fileURLWithPath: path))
        }
        print("Accordion actual-Web initialization: \(checks-failures)/\(checks) checks across \(reference["cases"].array.count) cases passed")
        if failures > 0 { exit(1) }
    }
}
