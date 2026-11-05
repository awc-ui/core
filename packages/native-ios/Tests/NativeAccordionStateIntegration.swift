import Foundation
@testable import AWCUI

@main enum NativeAccordionStateIntegration {
    static var checks = 0, failures: [String] = []
    static func check(_ value: Bool, _ label: String) { checks += 1; if !value { failures.append(label); print("FAIL: " + label) } }
    static func item(_ id: String, open: Bool = false, disabled: Bool = false) -> AWCNativeAccordionItemState {
        .init(id: id, expanded: open, disabled: disabled)
    }
    static func main() {
        selection(); ownership(); keyboard(); pointer(); events()
        print("Accordion native state: \(checks - failures.count)/\(checks) checks passed.")
        if !failures.isEmpty { exit(1) }
    }
    static func selection() {
        check(AWCNativeAccordionState.defaultIndices(" , , ").isEmpty, "Blank default selection does not open zero")
        check(AWCNativeAccordionState.defaultIndices("1, 2e0,0x3,0b100,0o5,+6,-0,NaN,Infinity,-2,2.5,7px") == [0,1,2,3,4,5,6], "Source Number conversion accepts finite nonnegative integral indices")
        check(AWCNativeAccordionState.defaultIndices("0x1p2,+0x3,1_000,1f").isEmpty, "Non-JavaScript numeric spellings are rejected")
        check(AWCNativeAccordionState.defaultIndices("0x+3,0o+4,0b+1,\u{0085}2,\u{FEFF}3\u{FEFF}") == [3], "Radix signs and whitespace follow JavaScript grammar")
        var c = AWCNativeAccordionConfiguration(); c.exclusive = true; c.defaultExpanded = "2, 0"
        let a = item("a", disabled: true), b = item("b", open: true), d = item("d")
        let g = AWCNativeAccordionState(configuration: c); g.connect([a,b,d])
        check(g.expandedIndices == [0], "Initial exclusive selection keeps the first authored/default index even when disabled")
        b.toggle(); check(g.expandedIndices == [1], "Opening another item closes the previous disabled open item")
        c.defaultExpanded = "2"; g.update(c); check(g.expandedIndices == [1], "defaultExpanded changes do not control current selection")
        c.exclusive = false; g.update(c); d.toggle(); check(g.expandedIndices == [1,2], "Nonexclusive mode retains other open panels")
        c.exclusive = true; g.update(c); check(g.expandedIndices == [1], "Enabling exclusive keeps the first currently open item")
        c.keepOneExpanded = true; g.update(c)
        check(!b.collapsible && !b.disabled, "The sole open item is locked but remains focusable")
        b.toggle(); check(b.expanded, "Public toggle cannot close a locked item")
        d.toggle(); check(g.expandedIndices == [2] && !d.collapsible && b.collapsible, "Opening a peer transfers the lock")
        d.setExpanded(false); check(g.expandedIndices.isEmpty && d.collapsible, "Direct expanded assignment can clear a locked panel as on Web")
        g.synchronize([a,b,d]); check(g.expandedIndices == [1], "Membership synchronization restores keep-one to the first enabled item")
        g.synchronize([d]); check(d.expanded && !d.collapsible && d.index == 0, "Removing the open panel opens and reindexes the remaining enabled item")
        c.keepOneExpanded = false; g.update(c); d.toggle(); check(!d.expanded && d.collapsible, "Disabling keep-one permits closing the last panel")
        let allDisabled = AWCNativeAccordionState(configuration: .init(keepOneExpanded: true))
        allDisabled.connect([item("x", disabled: true),item("y", disabled: true)])
        check(allDisabled.expandedIndices.isEmpty, "All-disabled groups are not forced open")
        let standalone = AWCNativeAccordionItemState(id: "solo", collapsible: false)
        standalone.toggle(); check(standalone.expanded, "Standalone collapsible=false still permits initial opening")
        standalone.toggle(); check(standalone.expanded, "Standalone collapsible=false blocks closing")
        standalone.disabled = true; standalone.setExpanded(false); standalone.toggle()
        check(!standalone.expanded, "Explicit disabled blocks activation in both directions")
    }
    static func ownership() {
        let authored = AWCNativeAccordionItemState(id: "authored", expanded: true, headingLevel: 2, regionRole: "none", collapsible: false)
        let first = AWCNativeAccordionState(configuration: .init(keepOneExpanded: true, headingLevel: 4, region: "never"))
        first.connect([authored]); check(authored.headingLevel == 4 && authored.regionRole == "group" && !authored.collapsible, "First owner applies its orchestration")
        let second = AWCNativeAccordionState(configuration: .init(headingLevel: 6))
        second.connect([authored]); first.synchronize([]); first.disconnect()
        check(authored.owner === second && authored.headingLevel == 6 && authored.regionRole == "region" && authored.collapsible && authored.index == 0, "Stale old-owner removal cannot overwrite the new owner")
        second.synchronize([])
        check(authored.owner == nil && authored.headingLevel == 2 && authored.regionRole == "none" && !authored.collapsible && authored.index == -1, "Final release restores original authored properties across transfer")
        var c = AWCNativeAccordionConfiguration(); c.regionThreshold = 1
        let group = AWCNativeAccordionState(configuration: c), a = item("a"), b = item("b")
        group.connect([a,b]); check(a.regionRole == "group" && b.regionRole == "group", "Auto region threshold uses direct membership")
        group.synchronize([b]); check(b.regionRole == "region", "Dynamic removal refreshes region policy")
        c.region = "always"; c.regionThreshold = 0; group.update(c); check(b.regionRole == "region", "Always region ignores threshold")
        c.region = "never"; group.update(c); check(b.regionRole == "group", "Never means labelled group, not unlabelled content")
        let outer = AWCNativeAccordionState(configuration: .init(exclusive: true)), inner = AWCNativeAccordionState(configuration: .init(exclusive: true))
        let outerA = item("outer-a"), outerB = item("outer-b", open: true), innerA = item("inner-a")
        outer.connect([outerA,outerB]); inner.connect([innerA]); var outerEvents = 0; outer.emit = { _,_ in outerEvents += 1 }; innerA.toggle()
        check(outer.expandedIndices == [1] && innerA.expanded && outerEvents == 0, "Nested selection remains local and does not emit outer coordination")
        group.disconnect(); group.connect([b]); check(b.regionRole == "group" && b.index == 0, "Reconnect reclaims orchestration without reseeding initial selection")
    }
    static func keyboard() {
        var c = AWCNativeAccordionConfiguration(); c.reorderable = true; c.floating = true
        let rows = [item("a", disabled:true),item("b"),item("c", disabled:true),item("d")]
        let group = AWCNativeAccordionState(configuration: c); group.connect(rows)
        var focused: [Int] = []
        for (i,row) in rows.enumerated() { row.requestFocus = { focused.append(i) } }
        rows[1].key("ArrowDown"); rows[3].key("ArrowDown"); rows[1].key("ArrowUp"); rows[3].key("Home"); rows[1].key("End")
        check(focused == [3,1,3,1,3], "Browser disabled-navigation reference matches exactly")
        check(!rows[0].key("ArrowDown") && !rows[1].key("Escape"), "Disabled and unrelated keys are not consumed")
        rows[1].key("Enter"); rows[1].key(" "); check(!rows[1].expanded, "Enter and Space each activate once")
        var reorder: [AWCValue] = []; group.emit = { name,detail in if name == "mdReorder" { reorder.append(detail) } }
        rows[1].key("ArrowUp",alt:true)
        check(group.originalIndices == [1,0,2,3] && rows[1].index == 0 && rows[1].hasChassisHandle && !rows[0].hasChassisHandle && focused.last == 1, "Keyboard reorder crosses disabled neighbor, refocuses moved item and transfers chassis grip")
        rows[1].key("ArrowUp",alt:true); check(reorder.count == 1, "Boundary reorder is a no-op")
        rows[1].key("ArrowDown",alt:true); rows[1].key("ArrowDown",alt:true)
        check(group.originalIndices == [0,2,1,3] && reorder.last?["order"] == [0,2,1,3], "Repeated reorder reports original identity indices")
        let inserted = item("inserted"); group.synchronize([inserted] + group.items)
        check(group.originalIndices == [4,0,2,1,3], "New items append to original identity mapping")
        c.reorderable = false; group.update(c); let before = group.originalIndices
        rows[1].key("ArrowUp",alt:true); check(group.originalIndices == before, "Nonreorderable parent ignores the item's declared reorder request")
        var requested = false; let solo = item("solo"); solo.emit = { n,d in requested = n == "mdItemRequestReorder" && d["from"] == -1; return true }
        solo.key("ArrowDown",alt:true); check(requested, "Standalone item still emits the public reorder request with index -1")
    }
    static func pointer() {
        var c = AWCNativeAccordionConfiguration(); c.reorderable = true; c.floating = true; c.initialX = 10; c.initialY = 20
        let rows = [item("a"),item("b"),item("c")], group = AWCNativeAccordionState(configuration: c)
        group.connect(rows); var events: [(String,AWCValue)] = []; group.emit = { events.append(($0,$1)) }
        let rects = [AWCNativeAccordionItemRect(top:100,height:60),.init(top:168,height:100),.init(top:276,height:60)]
        check(!group.beginReorder(item:rows[0],pointer:1,button:2,clientY:110,hostTop:100,rects:rects), "Secondary pointer cannot initiate reorder")
        check(group.beginReorder(item:rows[0],pointer:1,clientY:110,hostTop:100,rects:rects), "Primary pointer lifts an enabled item")
        check(group.dropPlaceholder == .init(top:0,height:60), "Initial placeholder retains the lifted item height")
        check(!group.beginChassis(pointer:2,clientX:0,clientY:0), "Chassis cannot steal an active reorder")
        group.moveReorder(pointer:9,clientY:999); group.endReorder(pointer:9)
        check(group.draggedOffset == 0 && group.draggedItemID == "a", "Unrelated pointers cannot move or finish reorder")
        group.moveReorder(pointer:1,clientY:198)
        check(group.dropPlaceholder?.top == 0, "Exact sibling center does not cross insertion boundary")
        group.moveReorder(pointer:1,clientY:199)
        check(group.dropPlaceholder == .init(top:68,height:60) && group.siblingOffsets == ["b":-68], "Crossing the center shifts the sibling by original item stride")
        group.moveReorder(pointer:1,clientY:400)
        check(group.dropPlaceholder == .init(top:176,height:60) && group.siblingOffsets == ["b":-68,"c":-68], "Long drag tracks the final insertion position")
        group.endReorder(pointer:1,cancelled:true)
        check(group.originalIndices == [0,1,2] && group.dropPlaceholder == nil && group.siblingOffsets.isEmpty && events.isEmpty, "Pointer cancel restores order and clears all drag presentation without an event")
        group.beginReorder(item:rows[2],pointer:2,clientY:280,hostTop:100,rects:rects); group.moveReorder(pointer:2,clientY:0); group.endReorder(pointer:2)
        check(group.originalIndices == [2,0,1] && events.last?.0 == "mdReorder" && group.dropPlaceholder == nil, "Upward drop commits once and clears placeholder in the same update")
        group.beginReorder(item:rows[2],pointer:3,clientY:100,hostTop:100,rects:rects); c.reorderable = false; group.update(c); group.endReorder(pointer:3)
        check(group.draggedItemID == nil && events.count == 1, "Disabling reordering cancels capture state and rejects stale completion")
        let z = group.zIndex; check(group.x == 10 && group.y == 20 && z != nil, "Initial floating coordinates and stacking are seeded")
        c.initialX = 70; c.initialY = 80; group.update(c); check(group.x == 10 && group.y == 20, "Initial coordinates are not controlled current position")
        check(group.beginChassis(pointer:4,clientX:100,clientY:200), "Floating grip begins a physical coordinate drag")
        check((group.zIndex ?? 0) > (z ?? 0), "Beginning a floating drag raises its stacking level")
        group.moveChassis(pointer:99,clientX:0,clientY:0); check(group.x == 10 && group.y == 20, "Wrong pointer cannot move chassis")
        group.moveChassis(pointer:4,clientX:-100,clientY:250)
        check(group.x == -190 && group.y == 70, "Floating drag is unclamped and uses physical coordinates")
        group.endChassis(pointer:4,clientX:-90,clientY:260)
        check(group.x == -190 && group.y == 70 && !group.chassisDragging, "Terminal pointer coordinates do not invent a final move")
        check(events.last?.1 == ["clientX":-90,"clientY":260,"x":-190,"y":70,"dx":-190,"dy":60], "Drag end reports terminal delta and last rendered position")
        c.floating = false; group.update(c); check(group.x == 0 && group.y == 0 && group.zIndex == nil && !group.items[0].hasChassisHandle, "Leaving floating mode clears translation, stacking and grip")
        c.floating = true; c.bringToFront = false; group.update(c)
        check(group.x == 70 && group.y == 80 && group.zIndex == nil, "Re-entering floating uses latest seeds without implicit stacking")
        group.beginChassis(pointer:5,clientX:0,clientY:0); let count = events.count; group.disconnect(); group.moveChassis(pointer:5,clientX:10,clientY:10); group.endChassis(pointer:5,clientX:10,clientY:10)
        check(!group.chassisDragging && group.zIndex == nil && events.count == count, "Disconnect silently cancels active floating resources and stale callbacks")
        check(!group.beginChassis(pointer:6,clientX:0,clientY:0), "A stale callback cannot restart a disconnected floating drag")
    }
    static func events() {
        let a = item("a",open:true), b = item("b"), g = AWCNativeAccordionState(configuration:.init(exclusive:true))
        g.connect([a,b]); var records:[(String,AWCValue)] = []
        a.emit = { records.append(($0,$1)); return true }; b.emit = { records.append(($0,$1)); return true }; g.emit = { records.append(($0,$1)) }
        b.toggle()
        check(records.map(\.0) == ["mdItemToggle","mdItemToggle","mdToggle","mdToggle"], "Exclusive coordination preserves synchronous nested toggle events")
        check(records.last?.1 == ["index":1,"expanded":true,"expandedIndices":[1]], "Parent detail contains the final expanded-index set")
        records = []; a.emit = { records.append(($0,$1)); return false }; a.toggle()
        check(a.expanded && b.expanded && records.count == 1, "Stopping item propagation preserves local change and skips parent coordination")
        a.toggle(); a.toggle(); check(records.count == 3, "Each real local state change emits once even without a receiving parent")
    }
}
