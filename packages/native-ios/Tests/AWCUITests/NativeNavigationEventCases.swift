import Foundation
#if !AWC_STANDALONE
@testable import AWCUI
#endif

enum NativeNavigationEventCases {
    static func run(_ check: @escaping (Bool, String) -> Void) {
        let event = AWCEvent(name: "mdClick", tag: "md-button", nodeID: "button")
        var trace: [String] = []
        func mark(_ context: AWCEventContext, _ name: String) { trace.append("\(context.phase.rawValue):\(name)") }
        let outer = AWCEventDispatcher(id: "outer", onCapture: { mark($0, "outer") }) { mark($0, "outer") }
        let inner = AWCEventDispatcher(id: "inner", parent: outer, onCapture: { mark($0, "inner") }, listeners: [.init { mark($0, "first") }]) { mark($0, "second") }
        var saved: AWCEventContext?
        let result = inner.dispatch(event, cancelable: true, targetListeners: [.init(capture: true) { mark($0, "target capture") }, .init { context in
            mark(context, "target"); saved = context
            check(context.targetID == "button" && context.currentScopeID == "button" && context.path == ["button", "inner", "outer"], "Target identity/path stay stable through native phases")
        }])
        check(trace == ["capture:outer", "capture:inner", "target:target capture", "target:target", "bubble:first", "bubble:second", "bubble:outer"], "Native capture-target-bubble ordering includes ordered same-scope listeners")
        check(result.phase == .none && result.currentScopeID == nil && result.observedEvent.propagationPath == ["button", "inner", "outer"], "Finished context clears current phase/scope and observation preserves path")
        saved?.preventDefault(); check(!result.defaultPrevented, "Finished native dispatch cannot be canceled asynchronously")
        trace = []
        let stop = AWCEventDispatcher(id: "stop", parent: outer, listeners: [.init { context in mark(context, "first"); context.stopPropagation() }]) { mark($0, "second") }
        let stopped = stop.dispatch(event, cancelable: true)
        check(trace == ["capture:outer", "bubble:first", "bubble:second"] && !stopped.defaultPrevented, "stopPropagation keeps same-scope listeners and does not cancel defaults")
        trace = []
        let immediate = AWCEventDispatcher(id: "stop", parent: outer, listeners: [.init { context in mark(context, "first"); context.stopImmediatePropagation() }]) { mark($0, "second") }
        check(immediate.dispatch(event).immediatePropagationStopped && trace == ["capture:outer", "bubble:first"], "Immediate stop suppresses remaining same-scope listeners and outer bubble")
        trace = []
        let stopCapture = AWCEventDispatcher(id: "capture-stop", parent: outer, onCapture: { context in mark(context, "first"); context.stopPropagation() }, listeners: [.init(capture: true) { mark($0, "second") }]) { mark($0, "bubble") }
        _ = stopCapture.dispatch(event, targetListeners: [.init { mark($0, "target") }])
        check(trace == ["capture:outer", "capture:first", "capture:second"], "Capture stop preserves current-scope capture listeners but prevents target")
        trace = []
        _ = inner.dispatch(event, bubbles: false, targetListeners: [.init { mark($0, "target") }])
        check(trace == ["capture:outer", "capture:inner", "target:target"], "Nonbubbling native events still capture and reach target")
        trace = []
        let boundary = AWCEventDispatcher(id: "boundary", parent: outer, isBoundary: true, onCapture: { mark($0, "boundary") }) { mark($0, "boundary") }
        let bounded = boundary.dispatch(event, crossesBoundaries: false, targetListeners: [.init { mark($0, "target") }])
        check(bounded.path == ["button", "boundary"] && trace == ["capture:boundary", "target:target", "bubble:boundary"], "Explicit native boundary clips path/capture/bubble when crossing disabled")
        var nestedPath: [String] = []
        let reentrant = AWCEventDispatcher(id: "nested", parent: outer, onCapture: { context in
            if context.event.name == "mdClick" {
                let nested = AWCEventDispatcher.dispatch(AWCEvent(name: "nested", tag: "test", nodeID: "nested-target"), targetListeners: [.init { nestedPath = $0.path }])
                check(nested.phase == .none && context.phase == .capture && context.currentScopeID == "nested", "Nested dispatch cannot corrupt outer phase/current scope")
            }
        }) { _ in }
        _ = reentrant.dispatch(event); check(nestedPath == ["nested-target"], "Nested dispatch owns independent stable path")
        var selected = false, routed = 0
        let router = AWCURLRouter { _ in routed += 1; return true }
        let cancelCapture = AWCEventDispatcher(id: "capture", onCapture: { $0.preventDefault() }) { _ in }
        let node = AWCNode(id: "button", tag: "md-button", properties: ["toggle": true, "href": "https://example.com"])
        let canceled = AWCButtonAction.perform(node: node, dispatcher: cancelCapture, router: router, commitSelected: { selected = $0 })
        check(canceled == .canceled && !selected && routed == 0, "Capture cancellation suppresses real button toggle and navigation")
        var observations: [AWCEvent] = []
        let metadata = AWCActivationMetadata(kind: .nativeControl)
        let toggled = AWCButtonAction.perform(node: node, dispatcher: stop, router: router, targetListeners: [.init { context in
            if context.event.name == "mdChange" { context.preventDefault(); check(!context.cancelable && !context.defaultPrevented, "mdChange remains noncancelable after committed toggle") }
        }], activation: metadata, observe: { observations.append($0) }, commitSelected: { selected = $0 })
        check(toggled == .navigated && selected && routed == 1 && observations.map(\.name) == ["mdClick", "mdChange"], "Propagation stop preserves activation and legacy observations")
        check(observations.allSatisfy { $0.activation == metadata && $0.propagationPath == ["button", "stop", "outer"] }, "Native activation metadata/path reaches both legacy observations without fabricated OS events")
        var targetCanceled = false
        _ = AWCButtonAction.perform(node: node, router: router, targetListeners: [.init { $0.preventDefault() }], observe: { targetCanceled = $0.defaultPrevented }, commitSelected: { _ in fatalError("target veto must prevent commit") })
        check(targetCanceled && routed == 1, "Target listener cancellation works even without enclosing scopes")

        let navigation = AWCNavigationCoordinator(baseURL: URL(string: "https://awc.local/demo/")!)
        var presentations: [AWCNavigationTransition] = []
        navigation.onPresent = { transition in
            presentations.append(transition)
            check(navigation.context(id: transition.destinationID)?.currentURL == transition.url, "Host presentation observes committed native navigation state")
        }
        check(navigation.createContext(id: "section", parentID: "root") == "section" && navigation.createContext(id: "editor", parentID: "section", url: URL(string: "child/")!) == "editor", "Native embedded contexts resolve explicit relative initial URLs")
        let retained = navigation.router(from: "editor")
        check(retained.route(href: "next/", target: "_SELF", nodeID: "button") && navigation.context(id: "editor")?.currentURL.absoluteString == "https://awc.local/demo/child/next/", "Case-insensitive self resolves relative to actual source context")
        check(retained.route(href: "final", target: "", nodeID: "button") && navigation.context(id: "editor")?.currentURL.absoluteString == "https://awc.local/demo/child/next/final", "Retained router resolves against updated context history and empty target means self")
        check(navigation.navigate(href: "parent", target: "_parent", from: "editor") && navigation.activeContextID == "section", "Parent target presents immediate native owner")
        check(navigation.navigate(href: "top", target: "_top", from: "editor") && navigation.activeContextID == "root", "Top target follows explicit native owner chain")
        check(navigation.navigate(href: "root-parent", target: "_parent", from: "root") && navigation.activeContextID == "root", "Parent on native root falls back to itself")
        let count = navigation.contexts.count
        check(navigation.navigate(href: "one", target: "_blank", from: "editor"), "Blank native target creates context")
        let firstBlank = navigation.activeContextID
        check(navigation.navigate(href: "two", target: "_blank", from: "editor") && navigation.activeContextID != firstBlank && navigation.contexts.count == count + 2, "Every blank activation creates a distinct native context")
        check(navigation.navigate(href: "named-one", target: "details", from: "editor"), "Named native target creates reusable local context")
        let named = navigation.activeContextID; let namedCount = navigation.contexts.count
        check(navigation.navigate(href: "named-two", target: "details", from: "editor") && navigation.activeContextID == named && navigation.contexts.count == namedCount && navigation.context(id: named)?.history.count == 2, "Named native target reuses history without creating another context")
        let before = navigation.contexts; let presentationCount = presentations.count
        navigation.shouldNavigate = { _ in false }
        check(!navigation.navigate(href: "blocked", target: "_blank", from: "editor") && navigation.contexts == before && presentations.count == presentationCount, "Rejected host navigation creates no context/history/presentation")
        check(!navigation.back(in: named) && navigation.contexts == before, "Host rejection also prevents back history mutation")
        navigation.shouldNavigate = { _ in true }
        check(navigation.back(in: named) && navigation.context(id: named)?.historyIndex == 0, "Back selects previous local route")
        check(navigation.navigate(href: "branch", from: named) && navigation.context(id: named)?.history.count == 2 && navigation.context(id: named)?.currentURL.absoluteString.hasSuffix("/branch") == true, "New navigation after back discards forward history")
        let safeCount = navigation.contexts.count; let safePresentations = presentations.count
        for href in ["javascript:alert(1)", "data:text/html,x", "file:///tmp/a", "https://example.com\n"] {
            check(!navigation.navigate(href: href, target: "_blank", from: "editor") && navigation.contexts.count == safeCount, "Unsafe route never creates a native context: \(href.debugDescription)")
        }
        check(!navigation.navigate(href: "next", target: "_invalid", from: "editor") && presentations.count == safePresentations, "Unsupported native reserved targets cause no presentation")
        check(!navigation.navigate(href: "next", from: "missing"), "Unknown source contexts cannot route")
        let form = AWCFormState(); var submitted = false; form.onSubmit = { _ in submitted = true }
        let invalidLink = AWCNode(tag: "md-button", properties: ["type": "submit", "href": "javascript:x"])
        check(AWCButtonAction.perform(node: invalidLink, form: form, router: retained, commitSelected: { _ in }) == .navigationRejected && !submitted, "Raw unsafe href still suppresses form action with native navigation coordinator")
        navigation.onPresent = { _ in }
    }
}
