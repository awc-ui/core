import Foundation
@testable import AWCUI

enum NativeFabCases {
    static func run(_ check:(Bool,String)->Void) {
        for key in ["containerColor","iconColor","labelColor"] {
            check(AWCFabAppearance(values:[key:"#12aBcD"]) != .init(),"\(key) accepts hex")
            for value:AWCValue in ["red","#fff",true,2] {check(AWCFabAppearance(values:[key:value]) == .init(),"\(key) rejects unsupported color")}
        }
        for key in ["iconSize","cornerRadius"] {
            check(AWCFabAppearance(values:[key:0]) != .init(),"\(key) accepts zero")
            for value:AWCValue in [-1,2401,.number(.infinity),.number(.nan),"4",true] {check(AWCFabAppearance(values:[key:value]) == .init(),"\(key) validates strict finite dimensions")}
        }
        let appearance=AWCFabAppearance(containerColor:"#123456",iconColor:"#aabbcc",iconSize:36,cornerRadius:4,labelColor:"#000000")
        check(appearance.merging(.init(iconSize:0,labelColor:"#ffffff")) == .init(containerColor:"#123456",iconColor:"#AABBCC",iconSize:0,cornerRadius:4,labelColor:"#FFFFFF"),"Five hooks merge independently")
        for (index,size) in ["standard","medium","large"].enumerated() {for density in 0...4 {
            let p:[String:AWCValue]=["size":.string(size),"density":.number(Double(-density))]
            let m=AWCNativeFabMetrics(properties:p,hasIcon:true)
            check(m.height == CGFloat([56,80,96][index]-density*4),"\(size)/\(-density) source container height")
            check(m.iconSize == CGFloat([24,28,36][index]-density),"\(size)/\(-density) source icon density taper")
            let label=AWCNativeFabMetrics(properties:p.merging(["label":"New project"]){_,new in new},hasIcon:true)
            check(label.height == CGFloat(56-density*4) && label.iconSize == CGFloat(24-density) && label.cornerRadius == 16,"Label overrides all size classes to extended standard geometry")
            check(label.fontSize == 14-CGFloat(density)*0.5 && label.lineHeight == 20 && label.fontWeight == 500,"Density typography retains fixed20 line height")
            let pads=label.padding(1)
            check(pads.0 == CGFloat(density==4 ? 8:density>=2 ? 12:16) && pads.1 == 20 && label.gap == CGFloat(density>=2 ? 8:12),"Discrete token insets and gap match actual source stylesheet")
        }}
        for variant in ["surface","primary-container","secondary-container","tertiary-container","primary","secondary","tertiary"] {for lowered in [false,true] {
            let palette=AWCNativeFabPalette(variant:variant,lowered:lowered)
            check(palette.container == (variant == "surface" ? (lowered ? "surface-container-low":"surface-container-high"):variant),"\(variant) lowered palette source role")
            check(palette.ink == (variant == "surface" ? "primary":"on-"+variant),"\(variant) actual foreground role")
        }}
        var node=AWCNode(id:"fab",tag:"md-fab",properties:["icon":"add"],children:[.text(" ",slot:"icon")])
        check(AWCNativeFabSlots(node:node,properties:node.properties,menuIcon:nil).glyph == "add","Raw whitespace text does not count as assigned element")
        for text in [""," ","X"] {
            node=try! AWCPreviewSlots.applying(["icon":text],to:node)
            let slots=AWCNativeFabSlots(node:node,properties:node.properties,menuIcon:nil)
            check(slots.hasIcon && slots.glyph.isEmpty && slots.children.first?.tag == "#slot-text","Authored span preserves presence, including empty/whitespace")
        }
        node=try! AWCPreviewSlots.applyingValues(["icon":["kind":"symbol","value":"favorite"]],to:node)
        check(AWCNativeFabSlots(node:node,properties:node.properties,menuIcon:nil).children.first?.tag == "#symbol","Typed Material symbol remains distinct from literal slot text")
        for glyph in ["close"," "] {
            let slots=AWCNativeFabSlots(node:node,properties:node.properties,menuIcon:glyph)
            check(slots.glyph == glyph && slots.children.isEmpty,"Method override wins over authored slot without trimming")
        }
        check(node.properties["icon"] == "add" && node.children.first?.tag == "#symbol","Temporary resolution never mutates authored icon/slot")
    }
}
