import Foundation
import Observation

/// Retain one controller per FAB Menu and attach it with
/// `View.awcFabMenuController`. Completion means the same lifecycle boundary as
/// the source method: close starts closing; whenClosed waits for settlement.
@Observable public final class AWCFabMenuController {
    public private(set) var isOpen = false
    public private(set) var isClosing = false
    public var isPresented: Bool { isOpen || isClosing }
    @ObservationIgnored private var attached = false
    @ObservationIgnored private var disconnected = false
    @ObservationIgnored private var initialized = false
    @ObservationIgnored private var quick = false
    @ObservationIgnored private var request = 0
    @ObservationIgnored private var transition = 0
    @ObservationIgnored private var cycle = false
    @ObservationIgnored private var pendingOpen: CheckedContinuation<Void,Never>?
    @ObservationIgnored private var closedWaiters: [CheckedContinuation<Void,Never>] = []
    @ObservationIgnored private var initialTask: Task<Void,Never>?
    @ObservationIgnored private var closeTask: Task<Void,Never>?
    @ObservationIgnored private var settleTask: Task<Void,Never>?
    @ObservationIgnored private var onChange: ((Bool)->Void)?
    @ObservationIgnored private var onReopen: (()->Void)?
    @ObservationIgnored private var renderBoundary: (() async -> Void)?
    public init() {}

    @MainActor public func show() async {
        pendingOpen?.resume(); pendingOpen=nil
        request &+= 1; transition &+= 1
        let generation=request
        guard !disconnected else { return }
        cycle=true
        if !initialized { await withCheckedContinuation {pendingOpen=$0} }
        guard attached, !disconnected, generation==request else {return}
        pendingOpen=nil; closeTask?.cancel();closeTask=nil
        isClosing=false
        if isOpen {onReopen?()} else {commit(true)}
    }
    @MainActor public func close() async {
        beginClose()
    }
    @MainActor func showImmediatelyIfReady()->Bool {
        guard attached,initialized,!disconnected else{return false}
        request &+= 1;transition &+= 1;cycle=true
        pendingOpen?.resume();pendingOpen=nil;closeTask?.cancel();closeTask=nil
        isClosing=false
        if isOpen {onReopen?()} else {commit(true)}
        return true
    }
    @MainActor func beginClose() {
        request &+= 1; pendingOpen?.resume();pendingOpen=nil
        guard isOpen,!isClosing else {if !isOpen {settleClosed()};return}
        if quick {commit(false);return}
        isClosing=true
        closeTask?.cancel()
        closeTask=Task { @MainActor [weak self] in
            try? await Task.sleep(for:.milliseconds(180))
            guard !Task.isCancelled,let self,self.attached else {return}
            self.isClosing=false;self.closeTask=nil
            if self.isOpen {self.commit(false)} else {self.settleClosed()}
        }
    }
    @MainActor public func whenClosed() async {
        guard !disconnected,cycle || isOpen || pendingOpen != nil else {return}
        cycle=true
        await withCheckedContinuation {closedWaiters.append($0)}
    }

    // The view supplies an actual native render boundary, allowing deferred
    // methods to progress independently of Laboratory frame streaming.
    @MainActor func attach(initialOpen:Bool,quick:Bool,renderBoundary:@escaping () async -> Void,
                           onChange:@escaping (Bool)->Void,onReopen:@escaping ()->Void) {
        attached=true;disconnected=false;initialized=false;self.quick=quick
        self.renderBoundary=renderBoundary;self.onChange=onChange;self.onReopen=onReopen
        isOpen=initialOpen;isClosing=false;cycle=cycle || initialOpen
        initialTask?.cancel()
        initialTask=Task { @MainActor [weak self] in
            await renderBoundary()
            guard !Task.isCancelled,let self,self.attached else {return}
            self.initialized=true;self.initialTask=nil
            self.pendingOpen?.resume();self.pendingOpen=nil
        }
    }
    @MainActor func update(quick:Bool) {self.quick=quick}
    @MainActor func setAuthoredOpen(_ value:Bool) {
        guard value != isOpen else {return}
        if value {transition &+= 1;cycle=true}
        commit(value)
    }
    @MainActor private func commit(_ value:Bool) {
        guard value != isOpen else {return}
        isOpen=value
        if value {transition &+= 1;cycle=true} else {settleClosed()}
        // Initial attachment sets state directly and deliberately emits nothing.
        onChange?(value)
    }
    @MainActor private func settleClosed() {
        guard cycle else {return}
        transition &+= 1;let generation=transition
        settleTask?.cancel()
        settleTask=Task { @MainActor [weak self] in
            guard let self else {return}
            await self.renderBoundary?()
            guard !Task.isCancelled,self.transition==generation,!self.isPresented,self.pendingOpen==nil else {return}
            self.cycle=false;self.settleTask=nil
            let waiters=self.closedWaiters;self.closedWaiters=[]
            for waiter in waiters {waiter.resume()}
        }
    }
    @MainActor func detach() {
        attached=false;disconnected=true;initialized=false
        request &+= 1;transition &+= 1
        initialTask?.cancel();initialTask=nil;closeTask?.cancel();closeTask=nil;settleTask?.cancel();settleTask=nil
        pendingOpen?.resume();pendingOpen=nil
        let waiters=closedWaiters;closedWaiters=[];cycle=false
        for waiter in waiters {waiter.resume()}
        onChange=nil;onReopen=nil;renderBoundary=nil
    }
}
