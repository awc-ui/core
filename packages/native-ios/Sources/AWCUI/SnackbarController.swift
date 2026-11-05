import SwiftUI
import Observation

public enum AWCSnackbarCloseReason:String,Sendable {case auto,action,close}

/// One retained controller per Snackbar. Methods apply state immediately;
/// their completion does not wait for the visual transition.
@Observable public final class AWCSnackbarController {
    public private(set) var isOpen=false
    public private(set) var transitionDate=Date.distantPast
    public private(set) var openGeneration=0
    @ObservationIgnored private var attached=false
    @ObservationIgnored private var initialized=false
    @ObservationIgnored private var pendingOpen=false
    @ObservationIgnored private var autoHide=true
    @ObservationIgnored private var duration=4000.0
    @ObservationIgnored private var closeable=false
    @ObservationIgnored private var paused=false
    @ObservationIgnored private var timer:Task<Void,Never>?
    @ObservationIgnored private var ripple:Task<Void,Never>?
    @ObservationIgnored private var timerGeneration=0
    @ObservationIgnored private var rippleGeneration=0
    @ObservationIgnored private var emit:((String,AWCValue)->Void)?
    @ObservationIgnored private var changed:((Bool)->Void)?
    @ObservationIgnored private var raised:(()->Void)?
    public init(){}
    @MainActor var acceptsEscape:Bool{attached && isOpen && closeable}

    @MainActor public func show() async {setOpen(true)}
    @MainActor public func hide(reason:AWCSnackbarCloseReason = .close) async {dismiss(reason)}
    @MainActor func attach(initialOpen:Bool,autoHide:Bool,duration:Double,closeable:Bool,emit:@escaping(String,AWCValue)->Void,changed:@escaping(Bool)->Void,raised:@escaping()->Void){
        self.emit=emit;self.changed=changed;self.raised=raised;self.autoHide=autoHide;self.duration=duration;self.closeable=closeable;attached=true
        if !initialized {
            initialized=true
            if !pendingOpen{isOpen=initialOpen}
            if isOpen{opened()}
        }else if isOpen {
            if pendingOpen{opened()}else{raised();if autoHide{startTimer()}}
        }
    }
    @MainActor func update(autoHide:Bool,duration:Double,closeable:Bool){
        // The Web source does not reschedule an existing timer when these
        // properties change. Their current values apply on the next restart.
        self.autoHide=autoHide;self.duration=duration;self.closeable=closeable
    }
    @MainActor func authoredOpen(_ value:Bool){setOpen(value)}
    @MainActor func detach(){attached=false;clearTimer();clearRipple();paused=false}
    @MainActor private func setOpen(_ value:Bool){
        guard value != isOpen else{return}
        isOpen=value;transitionDate=Date();changed?(value)
        if value {if attached{opened()}else{pendingOpen=true}}
        else{pendingOpen=false;clearTimer();clearRipple();paused=false}
    }
    @MainActor private func opened(){
        pendingOpen=false;openGeneration &+= 1;transitionDate=Date();raised?();emit?("mdOpen",.null)
        if autoHide{startTimer()}
    }
    @MainActor private func dismiss(_ reason:AWCSnackbarCloseReason){
        guard isOpen else{return};setOpen(false);emit?("mdClose",["reason":.string(reason.rawValue)])
    }
    @MainActor func activateAction(){
        guard attached,isOpen else{return}
        emit?("mdAction",.null)
        // Source action restarts auto-hide even when autoHide=false. The eventual
        // reason is auto, not action; hide(reason:.action) is a separate method.
        startTimer()
    }
    @MainActor func requestRippleDismiss(){
        guard attached,isOpen,closeable,ripple==nil else{return}
        rippleGeneration &+= 1;let generation=rippleGeneration
        ripple=Task{ @MainActor [weak self] in
            try? await Task.sleep(for:.milliseconds(150))
            guard let self,!Task.isCancelled,self.attached,self.rippleGeneration==generation else{return}
            self.ripple=nil;self.dismiss(.close)
        }
    }
    @MainActor func pointerEntered(){pause()}
    @MainActor func pointerExited(){resume()}
    @MainActor func focusEntered(){pause()}
    @MainActor func focusLeftSurface(){resume()}
    @MainActor private func pause(){guard isOpen,timer != nil else{return};clearTimer();paused=true}
    @MainActor private func resume(){
        guard isOpen,paused else{return};paused=false
        startTimer()
    }
    @MainActor private func startTimer(){
        clearTimer();guard attached,isOpen else{return}
        timerGeneration &+= 1;let generation=timerGeneration
        // Browser setTimeout uses a signed32-bit millisecond range. Out-of-range
        // or negative delays become effectively immediate rather than sleeping
        // for a value that cannot be represented by the platform scheduler.
        let milliseconds=duration.isFinite && duration>=0 && duration<=2_147_483_647 ? duration:0
        timer=Task { @MainActor [weak self] in
            try? await Task.sleep(for:.milliseconds(milliseconds))
            guard let self,!Task.isCancelled,self.attached,self.timerGeneration==generation else{return}
            self.timer=nil;if self.isOpen{self.dismiss(.auto)}
        }
    }
    @MainActor private func clearTimer(){timerGeneration &+= 1;timer?.cancel();timer=nil}
    @MainActor private func clearRipple(){rippleGeneration &+= 1;ripple?.cancel();ripple=nil}
}
private struct AWCSnackbarControllerKey:EnvironmentKey{static let defaultValue:AWCSnackbarController?=nil}
extension EnvironmentValues{var awcSnackbarController:AWCSnackbarController?{get{self[AWCSnackbarControllerKey.self]}set{self[AWCSnackbarControllerKey.self]=newValue}}}
public extension View{func awcSnackbarController(_ controller:AWCSnackbarController)->some View{environment(\.awcSnackbarController,controller)}}
