import SwiftUI
import QuartzCore

#if canImport(AppKit)
import AppKit

final class AWCFabMenuHostView:NSView {
    weak var registry:AWCFabMenuRegistry?
    private var monitor:Any?
    override var isFlipped:Bool {true}
    override func hitTest(_ point:NSPoint)->NSView? {nil}
    override func layout() {
        super.layout()
        if let content=window?.contentView {registry?.windowBounds=convert(content.bounds,from:content)}
    }
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if let monitor {NSEvent.removeMonitor(monitor);self.monitor=nil}
        guard window != nil else {registry?.unmount();return}
        registry?.mounted { [weak self] in await self?.renderBoundary() }
        monitor=NSEvent.addLocalMonitorForEvents(matching:.leftMouseUp) { [weak self] event in
            guard let self,event.window === self.window else{return event}
            self.registry?.outsideClick(self.convert(event.locationInWindow,from:nil))
            return event
        }
    }
    /// Commit two real native update/display passes. These do not depend on
    /// Laboratory capture requests, including while streaming is paused.
    @MainActor func renderBoundary() async {
        for _ in 0..<2 {
            await withCheckedContinuation {continuation in
                DispatchQueue.main.async { [weak self] in
                    self?.window?.contentView?.layoutSubtreeIfNeeded()
                    self?.window?.contentView?.displayIfNeeded()
                    CATransaction.flush()
                    continuation.resume()
                }
            }
        }
    }
    func dispose() {if let monitor {NSEvent.removeMonitor(monitor);self.monitor=nil};registry?.unmount()}
}
struct AWCFabMenuNativeHost:NSViewRepresentable {
    let registry:AWCFabMenuRegistry
    func makeNSView(context:Context)->AWCFabMenuHostView {let view=AWCFabMenuHostView();view.registry=registry;return view}
    func updateNSView(_ view:AWCFabMenuHostView,context:Context) {view.registry=registry}
    static func dismantleNSView(_ view:AWCFabMenuHostView,coordinator:()) {view.dispose()}
}
#elseif canImport(UIKit)
import UIKit

final class AWCFabMenuHostView:UIView,UIGestureRecognizerDelegate {
    weak var registry:AWCFabMenuRegistry?
    private var tap:UITapGestureRecognizer?
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool {false}
    override func layoutSubviews() {
        super.layoutSubviews()
        if let window {registry?.windowBounds=convert(window.bounds,from:window)}
    }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        if let tap {tap.view?.removeGestureRecognizer(tap);self.tap=nil}
        guard let window else {registry?.unmount();return}
        registry?.mounted { [weak self] in await self?.renderBoundary() }
        let recognizer=UITapGestureRecognizer(target:self,action:#selector(tapped(_:)))
        recognizer.cancelsTouchesInView=false;recognizer.delegate=self
        window.addGestureRecognizer(recognizer);tap=recognizer
    }
    @objc private func tapped(_ gesture:UITapGestureRecognizer) {registry?.outsideClick(gesture.location(in:self))}
    func gestureRecognizer(_ gestureRecognizer:UIGestureRecognizer,shouldRecognizeSimultaneouslyWith otherGestureRecognizer:UIGestureRecognizer)->Bool {true}
    @MainActor func renderBoundary() async {
        for _ in 0..<2 {
            await withCheckedContinuation {continuation in
                DispatchQueue.main.async { [weak self] in
                    self?.window?.setNeedsLayout();self?.window?.layoutIfNeeded()
                    CATransaction.flush();continuation.resume()
                }
            }
        }
    }
    func dispose() {if let tap {tap.view?.removeGestureRecognizer(tap);self.tap=nil};registry?.unmount()}
}
struct AWCFabMenuNativeHost:UIViewRepresentable {
    let registry:AWCFabMenuRegistry
    func makeUIView(context:Context)->AWCFabMenuHostView {let view=AWCFabMenuHostView();view.registry=registry;return view}
    func updateUIView(_ view:AWCFabMenuHostView,context:Context) {view.registry=registry}
    static func dismantleUIView(_ view:AWCFabMenuHostView,coordinator:()) {view.dispose()}
}
#endif
