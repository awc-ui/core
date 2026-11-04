import SwiftUI

/// The parity renderers present in the nearest `AWCModalScope` (the viewport, owner stack, focus trap and key routing).
/// Outside one, md-dialog, md-bottom-sheet and md-side-sheet keep the previous presentation (a platform sheet, or the
/// embedded overlay inside `AWCPreviewScope`), so applications and previews that have not installed a modal scope are
/// unchanged.
struct AWCModalPresentationFallback<Modern: View, Legacy: View>: View {
    @Environment(\.awcModalSession) private var session
    let modern: Modern
    let legacy: Legacy
    var body: some View {
        if session != nil { modern } else { legacy }
    }
}
