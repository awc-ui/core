import SwiftUI
import Observation

/// Retained source lifecycle. View attachment owns pointer/focus/key resources;
/// detached state requests never install global listeners or run a watchdog.
@Observable public final class AWCTooltipController{
    public private(set) var isOpen=false
    public private(set) var isVisible=false
    public private(set) var transitionDate=Date.distantPast
    public private(set) var openGeneration=0
    @ObservationIgnored private var attached=false
    @ObservationIgnored private var initialized=false
    @ObservationIgnored private var requested=false
    @ObservationIgnored private var disabled=false
    @ObservationIgnored private var suppressed=false
    @ObservationIgnored private var triggerHovered=false
    @ObservationIgnored private var popupHovered=false
    @ObservationIgnored private var showDelay=500.0
    @ObservationIgnored private var hideDelay=200.0
    @ObservationIgnored private var timer:Task<Void,Never>?
    @ObservationIgnored private var generation=0
    @ObservationIgnored private var emit:((String,AWCValue)->Void)?
    @ObservationIgnored private var changed:((Bool)->Void)?
    @ObservationIgnored var restoreTriggerFocus:(()->Void)?
    @ObservationIgnored var hasOwnedFocus:(()->Bool)?
    public init(){}
    @MainActor public func show() async{clearTimers();guard !disabled else{return};setOpen(true)}
    @MainActor public func hide() async{clearTimers();setOpen(false)}
    @MainActor func attach(initialOpen:Bool,disabled:Bool,showDelay:Double,hideDelay:Double,emit:@escaping(String,AWCValue)->Void,changed:@escaping(Bool)->Void){
        self.emit=emit;self.changed=changed;self.disabled=disabled;self.showDelay=showDelay;self.hideDelay=hideDelay;attached=true
        if !initialized{
            initialized=true
            if !requested{isOpen=initialOpen}
            if disabled{isOpen=false;isVisible=false;changed(false)}
            else if isOpen{display()}
        }else if disabled{setOpen(false)}
        else if isOpen && !isVisible{display()}
    }
    @MainActor func update(disabled:Bool,showDelay:Double,hideDelay:Double){
        let disabling=disabled && !self.disabled;self.disabled=disabled;self.showDelay=showDelay;self.hideDelay=hideDelay
        if disabling{clearTimers();setOpen(false)}
    }
    @MainActor func authoredOpen(_ value:Bool){clearTimers();guard !value || !disabled else{changed?(false);return};setOpen(value)}
    @MainActor func detach(){attached=false;triggerHovered=false;popupHovered=false;clearTimers();restoreTriggerFocus=nil;hasOwnedFocus=nil}
    @MainActor func anchorRemoved(){clearTimers();setOpen(false);suppressed=false}
    @MainActor func triggerEntered(){triggerHovered=true;scheduleShow()}
    @MainActor func triggerExited(){triggerHovered=false;suppressed=false;if !popupHovered{scheduleHide()}}
    @MainActor func triggerFocused(){scheduleShow()}
    @MainActor func focusLeftComponent(){suppressed=false;scheduleHide()}
    @MainActor func popupEntered(){popupHovered=true;clearTimers()}
    @MainActor func popupFocused(){clearTimers()}
    @MainActor func popupExited(){popupHovered=false;if !triggerHovered{scheduleHide()}}
    @discardableResult @MainActor func escape()->Bool{
        guard attached,isVisible else{return false}
        clearTimers();suppressed=true;let restore=hasOwnedFocus?() ?? false;setOpen(false)
        if restore{restoreTriggerFocus?()};return true
    }
    @MainActor private func setOpen(_ value:Bool){
        requested=true;guard value != isOpen else{return};isOpen=value;changed?(value);clearTimers()
        if value{if attached && !disabled{display()}}
        else if isVisible{isVisible=false;transitionDate=Date();emit?("mdClose",.null)}
    }
    @MainActor private func display(){guard !isVisible else{return};isVisible=true;openGeneration &+= 1;transitionDate=Date();emit?("mdOpen",.null)}
    @MainActor private func scheduleShow(){guard attached,!disabled,!suppressed else{return};schedule(true,showDelay)}
    @MainActor private func scheduleHide(){guard attached else{return};schedule(false,hideDelay)}
    @MainActor private func schedule(_ open:Bool,_ delay:Double){
        clearTimers();let current=generation
        let ms=delay.isFinite && delay>=0 && delay<=2_147_483_647 ? delay:0
        timer=Task { @MainActor [weak self] in
            try? await Task.sleep(for:.milliseconds(ms))
            guard let self,!Task.isCancelled,self.attached,self.generation==current else{return};self.timer=nil;self.setOpen(open)
        }
    }
    @MainActor private func clearTimers(){generation &+= 1;timer?.cancel();timer=nil}
}
private struct AWCTooltipControllerKey:EnvironmentKey{static let defaultValue:AWCTooltipController?=nil}
extension EnvironmentValues{var awcTooltipController:AWCTooltipController?{get{self[AWCTooltipControllerKey.self]}set{self[AWCTooltipControllerKey.self]=newValue}}}
public extension View{func awcTooltipController(_ controller:AWCTooltipController)->some View{environment(\.awcTooltipController,controller)}}
