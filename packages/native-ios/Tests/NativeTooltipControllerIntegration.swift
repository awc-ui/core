import Foundation
@testable import AWCUI

@main @MainActor enum NativeTooltipControllerIntegration {
    static var checks=0,failures:[String]=[],events:[String]=[],changes:[Bool]=[]
    static func check(_ v:Bool,_ label:String){checks += 1;if !v{failures.append(label);print("FAIL: "+label)}}
    static func wait(_ ms:Double) async{try? await Task.sleep(for:.milliseconds(ms))}
    static func attach(_ c:AWCTooltipController,open:Bool=false,disabled:Bool=false,show:Double=80,hide:Double=80){c.attach(initialOpen:open,disabled:disabled,showDelay:show,hideDelay:hide,emit:{name,detail in check(detail == .null,"Instance event carries null detail");events.append(name)},changed:{changes.append($0)})}
    static func main() async{
        let c=AWCTooltipController();attach(c,open:true)
        check(c.isOpen && c.isVisible && events==["mdOpen"],"Initial open is visible and emits one opening")
        await c.show();check(events.count==1,"Repeated public show does not duplicate opening")
        c.triggerExited();await wait(30);await c.show();await wait(100)
        check(c.isVisible && events.count==1,"Public show cancels a stale delayed hide while already open")
        await c.hide();check(!c.isOpen && !c.isVisible && events.last=="mdClose","Public hide applies state and close event")
        c.triggerEntered();await wait(30);await c.hide();await wait(100)
        check(!c.isVisible,"Public hide cancels a stale delayed show while already closed")
        c.triggerEntered();await wait(30);check(!c.isVisible,"Hover respects opening delay");await wait(80)
        check(c.isVisible,"Delayed hover opens")
        c.triggerExited();await wait(30);c.popupEntered();await wait(100)
        check(c.isVisible,"Popup entry cancels trigger-leave grace timer")
        c.popupEntered();c.triggerExited();await wait(100);check(c.isVisible,"Popup entry wins even when native layout observers deliver trigger exit afterward")
        c.popupExited();await wait(30);check(c.isVisible,"Popup leave retains closing grace");await wait(80)
        check(!c.isVisible,"Popup leave eventually closes")
        c.triggerFocused();await wait(110);check(c.isVisible,"Trigger focus opens after show delay")
        c.popupEntered();c.focusLeftComponent();await wait(110)
        check(!c.isVisible,"Focus leaving owned popup/trigger closes after grace")
        await c.show();var restored=0;c.hasOwnedFocus={true};c.restoreTriggerFocus={restored += 1;c.triggerFocused()}
        check(c.escape() && !c.isVisible && restored==1,"Escape dismisses and restores only owned focus")
        c.triggerEntered();await wait(110);check(!c.isVisible,"Escape suppresses immediate focus/hover re-opening")
        c.triggerExited();c.triggerEntered();await wait(110);check(c.isVisible,"Exit and re-entry releases Escape suppression")
        c.hasOwnedFocus={false};check(c.escape() && restored==1,"Escape preserves unrelated focus")
        c.update(disabled:true,showDelay:80,hideDelay:80);await c.show();c.authoredOpen(true);await wait(110)
        check(!c.isOpen && !c.isVisible,"Disabled rejects public and authored opening without visible state")
        c.update(disabled:false,showDelay:80,hideDelay:80);await wait(110);check(!c.isOpen,"Re-enable does not implicitly open")
        await c.show();let count=events.count;c.detach();await wait(110);attach(c)
        check(c.isOpen && c.isVisible && events.count==count,"Reattach preserves visibility without replaying mdOpen")
        c.triggerExited();c.detach();await wait(110);check(c.isOpen,"Detach cancels pending hide timer")
        attach(c);c.anchorRemoved();check(!c.isOpen && !c.isVisible,"Removing the anchor dismisses and clears ownership")
        c.detach();let before=events.count;await c.show();await wait(110)
        check(c.isOpen && !c.isVisible && events.count==before,"Detached show defers visibility and global resources")
        attach(c);check(c.isVisible && events.count==before+1,"Reattachment honors one deferred opening")
        c.detach();await c.hide();let disabled=AWCTooltipController();let original=events.count;attach(disabled,open:true,disabled:true)
        check(!disabled.isOpen && !disabled.isVisible && events.count==original,"Initial disabled/open normalizes closed without a close event")
        disabled.detach();print("Tooltip controller: \(checks-failures.count)/\(checks) checks passed.")
        if !failures.isEmpty{exit(1)}
    }
}
