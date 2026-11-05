import SwiftUI

/// Laboratory's authored parent context. It does not add component properties.
public struct AWCPreviewSegmentedContext: Decodable, Equatable {
    /// A retained update of a mounted set (gate-7 R1-04): the set's own multiselect / density properties win over the
    /// configure-time context, so an in-place Laboratory edit reaches the rendered set.
    public func retaining(_ node: AWCNode) -> AWCPreviewSegmentedContext {
        guard node.tag == "md-segmented-button-set" else { return self }
        return .init(mode: mode, multiselect: node.properties["multiselect"]?.bool ?? multiselect, density: node.properties["density"]?.number ?? density, selection: selection)
    }
    public let mode: String
    public let multiselect: Bool
    public let density: Double
    public let selection: [Bool]
    public init(mode: String = "set", multiselect: Bool = false, density: Double = 0, selection: [Bool] = [true,false,false]) {
        self.mode=mode;self.multiselect=multiselect;self.density=density;self.selection=selection
    }
    public func validate(tag: String) throws {
        struct Invalid: LocalizedError {var errorDescription:String?{"Invalid segmented preview context."}}
        guard ["md-segmented-button","md-segmented-button-set"].contains(tag),
              ["standalone","set"].contains(mode),[0.0,-1,-2,-3,-4].contains(density),
              (mode=="standalone" ? tag=="md-segmented-button" && selection.isEmpty:selection.count==3) else {throw Invalid()}
    }
    public static func selectionRootID(for node: AWCNode) -> String {node.tag=="md-segmented-button-set" ? node.id:"demo-segmented-set"}
    public static func defaults(for node: AWCNode) -> Self {
        .init(multiselect:node.tag=="md-segmented-button-set" && node.properties["multiselect"]?.bool==true,
              density:node.tag=="md-segmented-button-set" ? node.properties["density"]?.number ?? 0:0)
    }
    public func tree(_ selected: AWCNode) -> AWCNode {
        if mode=="standalone" {return selected}
        let labels=["Day","Week","Month"],ids=["segment-day","segment-week","segment-month"]
        var children=labels.enumerated().map {index,label in
            AWCNode(id:ids[index],tag:"md-segmented-button",properties:["label":.string(label),"value":.string(label.lowercased()),"selected":.bool(selection.indices.contains(index) && selection[index])])
        }
        var properties = selected.tag=="md-segmented-button-set" ? selected.properties:[:]
        properties.merge(["multiselect":.bool(multiselect),"density":.number(density)]){_,new in new}
        if selected.tag=="md-segmented-button" {
            var first=selected;first.id="segment-day";first.properties["selected"] = .bool(selection.first ?? false);children[0]=first
        }
        return .init(id:Self.selectionRootID(for:selected),tag:"md-segmented-button-set",properties:properties,children:children)
    }
}
public struct AWCPreviewSegmented: View {
    public let node: AWCNode
    public let context: AWCPreviewSegmentedContext
    public let onEvent: (AWCEvent)->Void
    public init(node: AWCNode, context: AWCPreviewSegmentedContext? = nil, onEvent: @escaping (AWCEvent)->Void = {_ in}) {
        self.node=node;self.context=context ?? .defaults(for:node);self.onEvent=onEvent
    }
    public var body:some View {AWCNativeView(node:context.tree(node),onEvent:onEvent)}
}
