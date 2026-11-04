import SwiftUI

/// Laboratory's real authored-anchor fixture, shared by live and snapshot hosts.
/// The production renderer never substitutes demo anchors or child actions.
public struct AWCPreviewFabMenu:View {
    public let node:AWCNode
    public let controller:AWCFabMenuController
    public let onEvent:(AWCEvent)->Void
    public init(node:AWCNode,controller:AWCFabMenuController,onEvent:@escaping (AWCEvent)->Void={_ in}) {
        self.node=node;self.controller=controller;self.onEvent=onEvent
    }
    private var menu:AWCNode {
        if node.tag=="md-fab-menu" {return node}
        var parent=AWCExamples.node(for:"md-fab-menu")
        parent.id="demo-fab-menu"
        if !parent.children.isEmpty {parent.children[0]=node}
        return parent
    }
    public var body:some View {
        AWCFabMenuScope {
            AWCNativeView(node:.init(id:"demo-fab-anchor",tag:"md-fab",properties:["icon":"add","label":"Create"]),onEvent:onEvent)
            AWCNativeView(node:menu,onEvent:onEvent).awcFabMenuController(controller)
        }.frame(width:360,height:480)
    }
}
