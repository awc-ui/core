import Foundation
@testable import AWCUI

@main @MainActor enum NativeSnackbarControllerIntegration {
    static var checks=0,failures:[String]=[]
    static var events:[(String,AWCValue)]=[],changes:[Bool]=[],raises=0
    static func check(_ value:Bool,_ description:String){checks += 1;if !value{failures.append(description);print("FAIL: "+description)}}
    static func wait(_ milliseconds:Double) async {try? await Task.sleep(for:.milliseconds(milliseconds))}
    static func attach(_ c:AWCSnackbarController,open:Bool=false,auto:Bool=false,duration:Double=80,closeable:Bool=true){
        c.attach(initialOpen:open,autoHide:auto,duration:duration,closeable:closeable,emit:{events.append(($0,$1))},changed:{changes.append($0)},raised:{raises += 1})
    }
    static func reset(){events=[];changes=[];raises=0}
    static func count(_ name:String)->Int{events.filter{$0.0==name}.count}
    static func main() async {
        reset();let c=AWCSnackbarController();attach(c,open:true)
        check(c.isOpen && count("mdOpen")==1 && raises==1,"Initial mounted open emits one source opening and raises")
        await c.show();check(count("mdOpen")==1 && raises==1,"Showing already-open does not emit or raise")
        c.authoredOpen(false);check(!c.isOpen && count("mdClose")==0,"Authored false changes state without synthesizing close event")
        await c.show();await c.hide(reason:.action)
        check(count("mdClose")==1 && events.last?.1==["reason":"action"],"Public hide action emits exact reason object")
        await c.hide();check(count("mdClose")==1,"Public hide closed is idempotent")
        await c.show();c.activateAction();check(c.isOpen && count("mdAction")==1 && events.last?.1 == .null,"Fallback action emits null immediately and retains open")
        await wait(130);check(!c.isOpen && events.last?.1==["reason":"auto"],"Fallback action starts auto timer even when autoHide false")
        await c.show();c.activateAction();c.pointerEntered();await wait(130);check(c.isOpen,"Hover pauses an action-started timer even when autoHide false")
        c.pointerExited();await wait(130);check(!c.isOpen && events.last?.1==["reason":"auto"],"Hover exit restarts paused timer regardless current autoHide")
        await c.show();c.pointerEntered();c.pointerExited();await wait(130);check(c.isOpen,"Pointer exit does not invent a timer when none was active")
        c.update(autoHide:true,duration:100,closeable:true);c.authoredOpen(false);await c.show();await wait(35);c.focusEntered();await wait(130);check(c.isOpen,"Focus entry pauses active timer")
        c.focusEntered();await wait(30);check(c.isOpen,"Moving focus inside surface keeps timer paused")
        c.focusLeftSurface();await wait(40);check(c.isOpen,"Focus exit restarts full duration rather than remaining time")
        await wait(100);check(!c.isOpen,"Focus exit's renewed timer eventually closes")
        c.update(autoHide:true,duration:120,closeable:true);await c.show();await wait(30);c.update(autoHide:true,duration:5,closeable:true);await wait(35);check(c.isOpen,"Duration edit does not reschedule running timer")
        await wait(100);check(!c.isOpen,"Original duration still completes")
        c.update(autoHide:false,duration:80,closeable:true);await c.show();c.requestRippleDismiss();c.requestRippleDismiss();await wait(50);check(c.isOpen,"Escape/close preserves150ms ripple feedback")
        await wait(140);let closes=count("mdClose");check(!c.isOpen && events.last?.1==["reason":"close"],"Repeated close requests coalesce into one close")
        await wait(100);check(count("mdClose")==closes,"No second pending ripple close remains")
        await c.show();c.requestRippleDismiss();await wait(35);c.authoredOpen(false);await c.show();await wait(180);check(c.isOpen,"Old ripple cannot close a fresh open cycle")
        c.requestRippleDismiss();c.detach();await wait(180);check(c.isOpen,"Disconnect cancels pending ripple")
        let opens=count("mdOpen");attach(c,open:true,auto:true,duration:80);check(count("mdOpen")==opens && raises>1,"Reconnect restores resources without duplicate mdOpen")
        await wait(130);check(!c.isOpen,"Reconnect restores auto-hide")
        c.detach();await c.show();let detachedOpen=count("mdOpen");await wait(130);check(c.isOpen && count("mdOpen")==detachedOpen,"Detached show defers events and timers")
        attach(c,open:false,auto:false);check(count("mdOpen")==detachedOpen+1 && c.isOpen,"Reconnect delivers one deferred opening")
        c.detach();await c.hide();await c.show();await c.hide();let last=count("mdOpen");attach(c,open:false);check(!c.isOpen && count("mdOpen")==last,"Detached close cancels pending open")
        c.update(autoHide:false,duration:80,closeable:false);await c.show();c.requestRippleDismiss();await wait(180);check(c.isOpen,"Escape ignores noncloseable surface")
        await c.hide();c.detach()
        print("Snackbar controller: \(checks-failures.count)/\(checks) checks passed.")
        if !failures.isEmpty{exit(1)}
    }
}
