import Foundation
@testable import AWCUI

enum NativeButtonGroupCases {
    static func run(_ check: (Bool,String) -> Void) {
        let fields = ["gap","width","minWidth","maxWidth","height","minHeight","maxHeight"]
        for field in fields {
            let valid = AWCButtonGroupAppearance(values:[field:0])
            check(valid != .init(), "\(field) accepts zero")
            for invalid: AWCValue in [-1,2401,.number(.infinity),.number(.nan),"4",true] {
                check(AWCButtonGroupAppearance(values:[field:invalid]) == .init(), "\(field) rejects non-finite, out-of-range and wrong-type values")
            }
        }
        let base = AWCButtonGroupAppearance(gap:12,width:200,minWidth:40,maxWidth:600,height:72,minHeight:24,maxHeight:96)
        check(base.merging(.init(gap:0,width:300)) == .init(gap:0,width:300,minWidth:40,maxWidth:600,height:72,minHeight:24,maxHeight:96), "Per-field scoped appearance merge retains unrelated hooks")
        func child(_ id:String,_ value:String,_ selected:Bool = false) -> AWCNode { .init(id:id,tag:"md-button",properties:["value":.string(value),"selected":.bool(selected)]) }
        let children = [child("a","same",true),child("b","same"),child("c","")]
        let state = AWCNativeButtonGroupState(children:children)
        state.inject(["a":["size":"xs"]],initialDepth:1)
        state.inject(["a":["size":"lg"]],initialDepth:0)
        state.inject(["a":["size":"xs"]],initialDepth:1)
        check(state.injected["a"]?["size"] == "lg","Initial outer sync wins regardless SwiftUI appearance order")
        state.inject(["a":["size":"md"]])
        state.inject(["a":["size":"lg"]],initialDepth:0)
        check(state.injected["a"]?["size"] == "md","Later real sync wins and cannot be overwritten by late initial callback")
        state.commit("b",selected:true)
        check(state.reconcile("b",multiple:false,required:false) == ["values":["same"],"added":[],"removed":[]], "Duplicate values preserve identity without fabricating changes")
        check(state.selection == [false,true,false], "Single selection commits clicked identity in authored order")
        state.commit("b",selected:false)
        check(state.reconcile("b",multiple:false,required:true) == ["values":["same"],"added":[],"removed":[]] && state.selection == [false,true,false], "Required restores last deselected child after child action")
        check(state.reconcile("c",multiple:false,required:false) == ["values":[],"added":[],"removed":["same"]] && state.selection == [false,false,false], "Raw canceled/inert click still clears other single-select children without toggling clicked child")
        state.commit("a",selected:true); state.commit("b",selected:true)
        check(state.reconcile("b",multiple:true,required:false) == ["values":["same","same"],"added":["same","same"],"removed":[]], "Duplicate additions retain source array multiplicity")
        state.update(children:children)
        check(state.selection == [true,true,false], "Unchanged authored flags preserve live child state")
        let changed = [child("a","different",false),child("b","same"),child("c","")]
        state.update(children:changed)
        check(state.selection == [false,true,false], "Changed authored selected flag replaces only that child state")
        check(state.reconcile("b",multiple:true,required:false) == ["values":["same"],"added":[],"removed":[]], "External source changes do not reset previous event snapshot")
        let removed = [child("c","")]; state.update(children:removed)
        check(state.selection == [false] && state.reconcile("missing",multiple:false,required:true) == nil, "Removed identities cannot participate in reconciliation")
        let wrapped = AWCNode(id:"g",tag:"md-button-group",children:[children[0],.init(tag:"md-card",children:[children[1],children[2]])])
        let edited = try! AWCPreviewButtonGroupSelection.applying([false,true,true],to:wrapped)
        check(AWCPreviewButtonGroupSelection.descendants(edited.children).map{$0.properties["selected"]?.bool} == [false,true,true], "Host selection walks actual authored descendant order")
        do { _ = try AWCPreviewButtonGroupSelection.applying([true],to:wrapped); check(false,"Mismatched selection must reject") } catch { check(true,"Mismatched selection rejects") }
        let outerFocus = AWCButtonFocusGroup(), innerFocus = AWCButtonFocusGroup()
        outerFocus.configure(items:[.init(id:"a"),.init(id:"b"),.init(id:"c")])
        innerFocus.configure(items:[.init(id:"b"),.init(id:"c")])
        var focused = ""
        innerFocus.register(id:"b") { focused="b"; return true }; innerFocus.register(id:"c") { focused="c"; return true }
        outerFocus.register(id:"a") { focused="a"; return true }; innerFocus.parent = outerFocus
        check(innerFocus.tabindex(for:"b") == -1 && outerFocus.tabindex(for:"a") == 0,"Nested focus scopes preserve one outer sequential entry")
        check(innerFocus.move("ArrowRight",from:"c") && focused == "a","Nested arrow bubbles to broad outer source descendant order after inner handling")
        innerFocus.didFocus(id:"b")
        check(outerFocus.activeID == "b" && innerFocus.tabindex(for:"b") == 0,"Nested focusin promotes outer roving identity")
        for (index,size) in ["xs","sm","md","lg","xl"].enumerated() {
            for left in [false,true] { for right in [false,true] {
                let geometry = AWCNativeGroupChildGeometry(size:size,shape:"round",connected:true,left:left,right:right,density:0,fullWidth:false,maximumHeight:nil,motionDelta:0)
                if !left && !right { check(geometry.corners(icon:false,selected:true,pressed:true) == nil,"Single connected child has no group corner override"); continue }
                for icon in [false,true] {
                    let ordinary = geometry.corners(icon:icon,selected:false,pressed:false)!
                    let inner: CGFloat = [4,8,8,16,20][index], outer: CGFloat = (icon ? [16,20,28,48,68] : [16,20,24,28,48])[index]
                    check(ordinary.start == (left ? inner : outer) && ordinary.end == (right ? inner : outer),"\(size) connected logical corners button/icon source geometry")
                    check(geometry.corners(icon:icon,selected:true,pressed:false)!.start == [16,20,24,28,48][index],"\(size) selected group corner override wins")
                    check(geometry.corners(icon:icon,selected:true,pressed:true)!.start == [2,4,4,8,12][index],"\(size) pressed group corner override wins over selected")
                }
            } }
        }
    }
}
