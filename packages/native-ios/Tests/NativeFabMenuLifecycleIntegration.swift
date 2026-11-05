import Foundation
@testable import AWCUI

@MainActor private final class RenderGate {
    var pending:[CheckedContinuation<Void,Never>]=[]
    func boundary() async {await withCheckedContinuation{pending.append($0)}}
    func finish(){let callbacks=pending;pending=[];for callback in callbacks {callback.resume()}}
}
@main @MainActor enum NativeFabMenuLifecycleIntegration {
    static var checks=0
    static func check(_ value:Bool,_ message:String){checks += 1;precondition(value,message)}
    static func turns() async {for _ in 0..<8 {await Task.yield()}}
    static func main() async {
        let wrapped = AWCNode(tag:"md-fab-menu-item",properties:["label":"  ","icon":"ignored"],children:[.init(tag:"span",children:[.text(" Archive ")])])
        check(awcFabMenuTypeaheadLabel(wrapped) == "Archive","Typeahead traverses wrapped authored descendants")
        var supplied = wrapped; supplied.children = [.symbol("folder",slot:"icon"),.text(" Archive")]
        check(awcFabMenuTypeaheadLabel(supplied) == "folder Archive","Authored symbol text participates, unlike the icon property")
        supplied.properties["label"]="  Priority  "
        check(awcFabMenuTypeaheadLabel(supplied) == "Priority","Trimmed nonempty label takes precedence over authored slots")
        let controller=AWCFabMenuController(),gate=RenderGate()
        var events:[Bool]=[],shown=false,closed=false
        let show=Task {await controller.show();shown=true}
        await turns();check(!shown && !controller.isOpen,"Pre-mount show waits for actual native initial render")
        controller.attach(initialOpen:false,quick:false,renderBoundary:{await gate.boundary()},onChange:{events.append($0)},onReopen:{})
        await turns();check(gate.pending.count == 1 && !shown,"Attached closed render remains deferred until render bridge reports completion")
        gate.finish();await show.value
        check(shown && controller.isOpen && events == [true],"Show commits open once after initialization")
        let wait=Task{await controller.whenClosed();closed=true};await turns()
        await controller.close()
        check(controller.isOpen && controller.isClosing && !closed,"Close returns while source180ms phase remains visible")
        await controller.close()
        try? await Task.sleep(for:.milliseconds(220));await turns()
        check(!controller.isOpen && !controller.isClosing && events == [true,false],"Repeated close is idempotent and does not invalidate its timer")
        check(!closed && gate.pending.count == 1,"whenClosed waits for actual native closed render boundary")
        gate.finish();await wait.value;check(closed,"Closed cycle settles after rendered boundary")

        await controller.show();closed=false
        let reopenedWait=Task{await controller.whenClosed();closed=true};await turns()
        await controller.close();await controller.show()
        try? await Task.sleep(for:.milliseconds(220));await turns()
        check(controller.isOpen && !controller.isClosing && !closed,"Show cancels close timer and retains current cycle waiter")
        controller.update(quick:true);await controller.close();await turns()
        check(!controller.isOpen && !controller.isClosing && !closed,"Quick close commits immediately but still awaits render settlement")
        gate.finish();await reopenedWait.value;check(closed,"Reopened cycle resolves only on its later close")
        controller.detach()

        let initial=AWCFabMenuController(),initialGate=RenderGate();var initialEvents:[Bool]=[]
        initial.attach(initialOpen:true,quick:false,renderBoundary:{await initialGate.boundary()},onChange:{initialEvents.append($0)},onReopen:{})
        await turns();check(initial.isOpen && initialEvents.isEmpty,"Initial open state mounts silently")
        initialGate.finish();await turns();var detached=false
        let detachWait=Task{await initial.whenClosed();detached=true};await turns();initial.detach();await detachWait.value
        check(detached && initialEvents.isEmpty,"Teardown resolves active-cycle waiters without synthesizing close event")
        await initial.show();check(initialEvents.isEmpty,"Disconnected show completes without reopening detached view")

        let canceled=AWCFabMenuController(),cancelGate=RenderGate();var canceledEvents:[Bool]=[],canceledShow=false
        let early=Task{await canceled.show();canceledShow=true};await turns()
        canceled.attach(initialOpen:false,quick:false,renderBoundary:{await cancelGate.boundary()},onChange:{canceledEvents.append($0)},onReopen:{})
        await turns();await canceled.close();await early.value;await turns()
        check(canceledShow && !canceled.isOpen && canceledEvents.isEmpty,"Close cancels an opening request waiting for initial render")
        var canceledCycle=false;let canceledWait=Task{await canceled.whenClosed();canceledCycle=true};await turns()
        cancelGate.finish();await canceledWait.value;check(canceledCycle,"Canceled pre-open cycle also settles, without a leaked waiter")
        canceled.detach();cancelGate.finish()

        let reentrant=AWCFabMenuController(),reentrantGate=RenderGate();var reentrantEvents:[Bool]=[]
        reentrant.attach(initialOpen:false,quick:true,renderBoundary:{await reentrantGate.boundary()},onChange:{value in reentrantEvents.append(value);if value {reentrant.setAuthoredOpen(false)}},onReopen:{})
        await turns();reentrantGate.finish();await turns();await reentrant.show();await turns()
        check(!reentrant.isOpen && reentrantEvents == [true,false],"Synchronous open callback can close without stale reopen work")
        reentrantGate.finish();reentrant.detach()
        print("Passed \(checks) native FAB Menu lifecycle contract checks with controlled actual-render boundaries.")
    }
}
