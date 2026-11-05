// Generated from actual hydrated Web output; do not edit expected values.
// web-sequences.json SHA-256: 99e4e8dd12bd3e5e6740f42db06c7a28e533ece4ee972d019ea06098be9e9908

import Foundation
@testable import AWCUI

@main enum NativeAccordionBrowserStateIntegration {
    static var checks=0, failures=0
    static func verify(_ g:AWCNativeAccordionState,_ expected:String,_ label:String) {
        let actual=g.items.map { "\($0.id)|\($0.expanded)|\($0.disabled)|\($0.headingLevel)|\($0.regionRole)|\($0.collapsible)|\($0.index)|\($0.hasChassisHandle)" }.joined(separator:";")
        checks += 1; if actual != expected { failures += 1; print("FAIL \(label)\nexpected: \(expected)\nactual: \(actual)") }
    }
    static func main() {
        scenario0()
        scenario1()
        scenario2()
        scenario3()
        scenario4()
        scenario5()
        scenario6()
        print("Accordion actual-Web sequences: \(checks-failures)/\(checks) snapshots passed.")
        if failures>0 { exit(1) }
    }
    static func scenario0() {
        var configuration=AWCNativeAccordionConfiguration()
        configuration.exclusive=true
        configuration.keepOneExpanded=true
        configuration.defaultExpanded="2, 0"
        let g=AWCNativeAccordionState(configuration:configuration)
        var nodes:[String:AWCNativeAccordionItemState]=[:]
        nodes["a"]=AWCNativeAccordionItemState(id:"a",disabled:true)
        nodes["b"]=AWCNativeAccordionItemState(id:"b",expanded:true)
        nodes["c"]=AWCNativeAccordionItemState(id:"c")
        nodes["d"]=AWCNativeAccordionItemState(id:"d")
        g.connect([nodes["a"]!,nodes["b"]!,nodes["c"]!,nodes["d"]!])
        verify(g,"a|true|true|3|region|false|0|false;b|false|false|3|region|true|1|false;c|false|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/0")
        nodes["b"]!.toggle()
        verify(g,"a|false|true|3|region|true|0|false;b|true|false|3|region|false|1|false;c|false|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/1")
        nodes["b"]!.toggle()
        verify(g,"a|false|true|3|region|true|0|false;b|true|false|3|region|false|1|false;c|false|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/2")
        nodes["c"]!.toggle()
        verify(g,"a|false|true|3|region|true|0|false;b|false|false|3|region|true|1|false;c|true|false|3|region|false|2|false;d|false|false|3|region|true|3|false","selection-membership/3")
        nodes["c"]!.setExpanded(false)
        verify(g,"a|false|true|3|region|true|0|false;b|false|false|3|region|true|1|false;c|false|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/4")
        nodes["b"]!.disabled=true
        verify(g,"a|false|true|3|region|true|0|false;b|false|true|3|region|true|1|false;c|false|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/5")
        g.synchronize([nodes["a"]!,nodes["b"]!,nodes["c"]!,nodes["d"]!])
        verify(g,"a|false|true|3|region|true|0|false;b|false|true|3|region|true|1|false;c|true|false|3|region|false|2|false;d|false|false|3|region|true|3|false","selection-membership/6")
        configuration=g.configuration
        configuration.keepOneExpanded=false
        g.update(configuration)
        verify(g,"a|false|true|3|region|true|0|false;b|false|true|3|region|true|1|false;c|true|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/7")
        nodes["c"]!.toggle()
        verify(g,"a|false|true|3|region|true|0|false;b|false|true|3|region|true|1|false;c|false|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/8")
        configuration=g.configuration
        configuration.exclusive=false
        g.update(configuration)
        verify(g,"a|false|true|3|region|true|0|false;b|false|true|3|region|true|1|false;c|false|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/9")
        nodes["a"]!.setExpanded(true)
        verify(g,"a|true|true|3|region|true|0|false;b|false|true|3|region|true|1|false;c|false|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/10")
        nodes["d"]!.toggle()
        verify(g,"a|true|true|3|region|true|0|false;b|false|true|3|region|true|1|false;c|false|false|3|region|true|2|false;d|true|false|3|region|true|3|false","selection-membership/11")
        configuration=g.configuration
        configuration.exclusive=true
        g.update(configuration)
        verify(g,"a|true|true|3|region|true|0|false;b|false|true|3|region|true|1|false;c|false|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/12")
        configuration=g.configuration
        configuration.defaultExpanded="3"
        g.update(configuration)
        verify(g,"a|true|true|3|region|true|0|false;b|false|true|3|region|true|1|false;c|false|false|3|region|true|2|false;d|false|false|3|region|true|3|false","selection-membership/13")
        g.synchronize(g.items.filter { $0.id != "a" })
        verify(g,"b|false|true|3|region|true|0|false;c|false|false|3|region|true|1|false;d|false|false|3|region|true|2|false","selection-membership/14")
        configuration=g.configuration
        configuration.keepOneExpanded=true
        g.update(configuration)
        verify(g,"b|false|true|3|region|true|0|false;c|true|false|3|region|false|1|false;d|false|false|3|region|true|2|false","selection-membership/15")
        g.synchronize(g.items.filter { $0.id != "c" })
        verify(g,"b|false|true|3|region|true|0|false;d|true|false|3|region|false|1|false","selection-membership/16")
        configuration=g.configuration
        configuration.keepOneExpanded=false
        g.update(configuration)
        verify(g,"b|false|true|3|region|true|0|false;d|true|false|3|region|true|1|false","selection-membership/17")
        nodes["d"]!.toggle()
        verify(g,"b|false|true|3|region|true|0|false;d|false|false|3|region|true|1|false","selection-membership/18")
        g.disconnect()
    }
    static func scenario1() {
        var configuration=AWCNativeAccordionConfiguration()
        configuration.reorderable=true
        configuration.floating=true
        configuration.regionThreshold=2.0
        let g=AWCNativeAccordionState(configuration:configuration)
        var nodes:[String:AWCNativeAccordionItemState]=[:]
        nodes["a"]=AWCNativeAccordionItemState(id:"a")
        nodes["b"]=AWCNativeAccordionItemState(id:"b",disabled:true)
        nodes["c"]=AWCNativeAccordionItemState(id:"c")
        nodes["d"]=AWCNativeAccordionItemState(id:"d")
        g.connect([nodes["a"]!,nodes["b"]!,nodes["c"]!,nodes["d"]!])
        verify(g,"a|false|false|3|group|true|0|true;b|false|true|3|group|true|1|false;c|false|false|3|group|true|2|false;d|false|false|3|group|true|3|false","reorder-roles/0")
        nodes["c"]!.key("ArrowUp",alt:true)
        verify(g,"a|false|false|3|group|true|0|true;c|false|false|3|group|true|1|false;b|false|true|3|group|true|2|false;d|false|false|3|group|true|3|false","reorder-roles/1")
        nodes["c"]!.key("ArrowUp",alt:true)
        verify(g,"c|false|false|3|group|true|0|true;a|false|false|3|group|true|1|false;b|false|true|3|group|true|2|false;d|false|false|3|group|true|3|false","reorder-roles/2")
        nodes["c"]!.key("ArrowUp",alt:true)
        verify(g,"c|false|false|3|group|true|0|true;a|false|false|3|group|true|1|false;b|false|true|3|group|true|2|false;d|false|false|3|group|true|3|false","reorder-roles/3")
        nodes["c"]!.key("ArrowDown",alt:true)
        verify(g,"a|false|false|3|group|true|0|true;c|false|false|3|group|true|1|false;b|false|true|3|group|true|2|false;d|false|false|3|group|true|3|false","reorder-roles/4")
        nodes["a"]!.key("End",alt:false)
        verify(g,"a|false|false|3|group|true|0|true;c|false|false|3|group|true|1|false;b|false|true|3|group|true|2|false;d|false|false|3|group|true|3|false","reorder-roles/5")
        nodes["d"]!.key("ArrowDown",alt:false)
        verify(g,"a|false|false|3|group|true|0|true;c|false|false|3|group|true|1|false;b|false|true|3|group|true|2|false;d|false|false|3|group|true|3|false","reorder-roles/6")
        nodes["a"]!.key("ArrowUp",alt:false)
        verify(g,"a|false|false|3|group|true|0|true;c|false|false|3|group|true|1|false;b|false|true|3|group|true|2|false;d|false|false|3|group|true|3|false","reorder-roles/7")
        configuration=g.configuration
        configuration.reorderable=false
        g.update(configuration)
        verify(g,"a|false|false|3|group|true|0|true;c|false|false|3|group|true|1|false;b|false|true|3|group|true|2|false;d|false|false|3|group|true|3|false","reorder-roles/8")
        nodes["d"]!.key("ArrowUp",alt:true)
        verify(g,"a|false|false|3|group|true|0|true;c|false|false|3|group|true|1|false;b|false|true|3|group|true|2|false;d|false|false|3|group|true|3|false","reorder-roles/9")
        configuration=g.configuration
        configuration.region="always"
        g.update(configuration)
        verify(g,"a|false|false|3|region|true|0|true;c|false|false|3|region|true|1|false;b|false|true|3|region|true|2|false;d|false|false|3|region|true|3|false","reorder-roles/10")
        nodes["a"]!.headingLevel=2
        verify(g,"a|false|false|2|region|true|0|true;c|false|false|3|region|true|1|false;b|false|true|3|region|true|2|false;d|false|false|3|region|true|3|false","reorder-roles/11")
        configuration=g.configuration
        configuration.floating=false
        g.update(configuration)
        verify(g,"a|false|false|2|region|true|0|false;c|false|false|3|region|true|1|false;b|false|true|3|region|true|2|false;d|false|false|3|region|true|3|false","reorder-roles/12")
        configuration=g.configuration
        configuration.floating=true
        g.update(configuration)
        verify(g,"a|false|false|2|region|true|0|true;c|false|false|3|region|true|1|false;b|false|true|3|region|true|2|false;d|false|false|3|region|true|3|false","reorder-roles/13")
        configuration=g.configuration
        configuration.headingLevel=5
        g.update(configuration)
        verify(g,"a|false|false|5|region|true|0|true;c|false|false|5|region|true|1|false;b|false|true|5|region|true|2|false;d|false|false|5|region|true|3|false","reorder-roles/14")
        configuration=g.configuration
        configuration.region="never"
        g.update(configuration)
        verify(g,"a|false|false|5|group|true|0|true;c|false|false|5|group|true|1|false;b|false|true|5|group|true|2|false;d|false|false|5|group|true|3|false","reorder-roles/15")
        g.synchronize(g.items.filter { $0.id != "b" })
        verify(g,"a|false|false|5|group|true|0|true;c|false|false|5|group|true|1|false;d|false|false|5|group|true|2|false","reorder-roles/16")
        g.synchronize(g.items.filter { $0.id != "d" })
        verify(g,"a|false|false|5|group|true|0|true;c|false|false|5|group|true|1|false","reorder-roles/17")
        configuration=g.configuration
        configuration.region="auto"
        g.update(configuration)
        verify(g,"a|false|false|5|region|true|0|true;c|false|false|5|region|true|1|false","reorder-roles/18")
        configuration=g.configuration
        configuration.regionThreshold=1.0
        g.update(configuration)
        verify(g,"a|false|false|5|group|true|0|true;c|false|false|5|group|true|1|false","reorder-roles/19")
        nodes["e"]=AWCNativeAccordionItemState(id:"e")
        g.synchronize(g.items + [nodes["e"]!])
        verify(g,"a|false|false|5|group|true|0|true;c|false|false|5|group|true|1|false;e|false|false|5|group|true|2|false","reorder-roles/20")
        configuration=g.configuration
        configuration.reorderable=true
        g.update(configuration)
        verify(g,"a|false|false|5|group|true|0|true;c|false|false|5|group|true|1|false;e|false|false|5|group|true|2|false","reorder-roles/21")
        nodes["e"]!.key("ArrowUp",alt:true)
        verify(g,"a|false|false|5|group|true|0|true;e|false|false|5|group|true|1|false;c|false|false|5|group|true|2|false","reorder-roles/22")
        g.synchronize([nodes["e"]!,nodes["a"]!,nodes["c"]!])
        verify(g,"e|false|false|5|group|true|0|true;a|false|false|5|group|true|1|false;c|false|false|5|group|true|2|false","reorder-roles/23")
        g.disconnect()
    }
    static func scenario2() {
        var configuration=AWCNativeAccordionConfiguration()
        configuration.defaultExpanded=" , "
        let g=AWCNativeAccordionState(configuration:configuration)
        var nodes:[String:AWCNativeAccordionItemState]=[:]
        nodes["n0"]=AWCNativeAccordionItemState(id:"n0")
        nodes["n1"]=AWCNativeAccordionItemState(id:"n1")
        nodes["n2"]=AWCNativeAccordionItemState(id:"n2")
        nodes["n3"]=AWCNativeAccordionItemState(id:"n3")
        nodes["n4"]=AWCNativeAccordionItemState(id:"n4")
        nodes["n5"]=AWCNativeAccordionItemState(id:"n5")
        nodes["n6"]=AWCNativeAccordionItemState(id:"n6")
        g.connect([nodes["n0"]!,nodes["n1"]!,nodes["n2"]!,nodes["n3"]!,nodes["n4"]!,nodes["n5"]!,nodes["n6"]!])
        verify(g,"n0|false|false|3|group|true|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|false|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-0/0")
        configuration=g.configuration
        configuration.exclusive=true
        g.update(configuration)
        verify(g,"n0|false|false|3|group|true|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|false|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-0/1")
        configuration=g.configuration
        configuration.keepOneExpanded=true
        g.update(configuration)
        verify(g,"n0|true|false|3|group|false|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|false|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-0/2")
        g.disconnect()
    }
    static func scenario3() {
        var configuration=AWCNativeAccordionConfiguration()
        configuration.defaultExpanded="1,2e0,0x3,0b100,0o5,+6,-0"
        let g=AWCNativeAccordionState(configuration:configuration)
        var nodes:[String:AWCNativeAccordionItemState]=[:]
        nodes["n0"]=AWCNativeAccordionItemState(id:"n0")
        nodes["n1"]=AWCNativeAccordionItemState(id:"n1")
        nodes["n2"]=AWCNativeAccordionItemState(id:"n2")
        nodes["n3"]=AWCNativeAccordionItemState(id:"n3")
        nodes["n4"]=AWCNativeAccordionItemState(id:"n4")
        nodes["n5"]=AWCNativeAccordionItemState(id:"n5")
        nodes["n6"]=AWCNativeAccordionItemState(id:"n6")
        g.connect([nodes["n0"]!,nodes["n1"]!,nodes["n2"]!,nodes["n3"]!,nodes["n4"]!,nodes["n5"]!,nodes["n6"]!])
        verify(g,"n0|true|false|3|group|true|0|false;n1|true|false|3|group|true|1|false;n2|true|false|3|group|true|2|false;n3|true|false|3|group|true|3|false;n4|true|false|3|group|true|4|false;n5|true|false|3|group|true|5|false;n6|true|false|3|group|true|6|false","defaults-1/0")
        configuration=g.configuration
        configuration.exclusive=true
        g.update(configuration)
        verify(g,"n0|true|false|3|group|true|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|false|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-1/1")
        configuration=g.configuration
        configuration.keepOneExpanded=true
        g.update(configuration)
        verify(g,"n0|true|false|3|group|false|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|false|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-1/2")
        g.disconnect()
    }
    static func scenario4() {
        var configuration=AWCNativeAccordionConfiguration()
        configuration.defaultExpanded="0x1p2,+0x3,1_000,1f,0x+3"
        let g=AWCNativeAccordionState(configuration:configuration)
        var nodes:[String:AWCNativeAccordionItemState]=[:]
        nodes["n0"]=AWCNativeAccordionItemState(id:"n0")
        nodes["n1"]=AWCNativeAccordionItemState(id:"n1")
        nodes["n2"]=AWCNativeAccordionItemState(id:"n2")
        nodes["n3"]=AWCNativeAccordionItemState(id:"n3")
        nodes["n4"]=AWCNativeAccordionItemState(id:"n4")
        nodes["n5"]=AWCNativeAccordionItemState(id:"n5")
        nodes["n6"]=AWCNativeAccordionItemState(id:"n6")
        g.connect([nodes["n0"]!,nodes["n1"]!,nodes["n2"]!,nodes["n3"]!,nodes["n4"]!,nodes["n5"]!,nodes["n6"]!])
        verify(g,"n0|false|false|3|group|true|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|false|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-2/0")
        configuration=g.configuration
        configuration.exclusive=true
        g.update(configuration)
        verify(g,"n0|false|false|3|group|true|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|false|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-2/1")
        configuration=g.configuration
        configuration.keepOneExpanded=true
        g.update(configuration)
        verify(g,"n0|true|false|3|group|false|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|false|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-2/2")
        g.disconnect()
    }
    static func scenario5() {
        var configuration=AWCNativeAccordionConfiguration()
        configuration.defaultExpanded="﻿3﻿,2"
        let g=AWCNativeAccordionState(configuration:configuration)
        var nodes:[String:AWCNativeAccordionItemState]=[:]
        nodes["n0"]=AWCNativeAccordionItemState(id:"n0")
        nodes["n1"]=AWCNativeAccordionItemState(id:"n1")
        nodes["n2"]=AWCNativeAccordionItemState(id:"n2")
        nodes["n3"]=AWCNativeAccordionItemState(id:"n3")
        nodes["n4"]=AWCNativeAccordionItemState(id:"n4")
        nodes["n5"]=AWCNativeAccordionItemState(id:"n5")
        nodes["n6"]=AWCNativeAccordionItemState(id:"n6")
        g.connect([nodes["n0"]!,nodes["n1"]!,nodes["n2"]!,nodes["n3"]!,nodes["n4"]!,nodes["n5"]!,nodes["n6"]!])
        verify(g,"n0|false|false|3|group|true|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|true|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-3/0")
        configuration=g.configuration
        configuration.exclusive=true
        g.update(configuration)
        verify(g,"n0|false|false|3|group|true|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|true|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-3/1")
        configuration=g.configuration
        configuration.keepOneExpanded=true
        g.update(configuration)
        verify(g,"n0|false|false|3|group|true|0|false;n1|false|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|true|false|3|group|false|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-3/2")
        g.disconnect()
    }
    static func scenario6() {
        var configuration=AWCNativeAccordionConfiguration()
        configuration.defaultExpanded="3,1,-1,Infinity,NaN,1.5"
        let g=AWCNativeAccordionState(configuration:configuration)
        var nodes:[String:AWCNativeAccordionItemState]=[:]
        nodes["n0"]=AWCNativeAccordionItemState(id:"n0")
        nodes["n1"]=AWCNativeAccordionItemState(id:"n1")
        nodes["n2"]=AWCNativeAccordionItemState(id:"n2")
        nodes["n3"]=AWCNativeAccordionItemState(id:"n3")
        nodes["n4"]=AWCNativeAccordionItemState(id:"n4")
        nodes["n5"]=AWCNativeAccordionItemState(id:"n5")
        nodes["n6"]=AWCNativeAccordionItemState(id:"n6")
        g.connect([nodes["n0"]!,nodes["n1"]!,nodes["n2"]!,nodes["n3"]!,nodes["n4"]!,nodes["n5"]!,nodes["n6"]!])
        verify(g,"n0|false|false|3|group|true|0|false;n1|true|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|true|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-4/0")
        configuration=g.configuration
        configuration.exclusive=true
        g.update(configuration)
        verify(g,"n0|false|false|3|group|true|0|false;n1|true|false|3|group|true|1|false;n2|false|false|3|group|true|2|false;n3|false|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-4/1")
        configuration=g.configuration
        configuration.keepOneExpanded=true
        g.update(configuration)
        verify(g,"n0|false|false|3|group|true|0|false;n1|true|false|3|group|false|1|false;n2|false|false|3|group|true|2|false;n3|false|false|3|group|true|3|false;n4|false|false|3|group|true|4|false;n5|false|false|3|group|true|5|false;n6|false|false|3|group|true|6|false","defaults-4/2")
        g.disconnect()
    }
}
