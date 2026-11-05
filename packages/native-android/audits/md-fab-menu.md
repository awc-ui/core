# Android `md-fab-menu` and `md-fab-menu-item` parity record

Source: both components’ TSX/CSS, plus the actual Chrome geometry and anchor-event oracles in workspace `outputs/native-parity/md-fab-menu/`.

## Implemented contract

- Menu properties `anchor`, `open`, `placement`, `variant`, `menuLabel`, `quick` and `density` operate on a separate authored anchor and a retained native menu. `AWCFabMenuScope` provides the actual containing viewport, authored-ID lookup, current transformed anchor geometry and a nonmodal overlay. Put the scope around the native screen/viewport so outside input anywhere in that viewport can dismiss the menu without consuming the underlying action.
- `AWCFabMenuControllerScope` attaches one remembered `AWCFabMenuController`. `show()` waits for initial readiness, cancels pending closing and opens; `close()` starts closing and returns before the 180ms close lifecycle completes; `whenClosed()` waits for the current cycle’s actual closed frame. Reopening retains that cycle. Disconnect resolves outstanding lifecycle waits. Initially open menus mount silently, without `mdOpen` or autofocus.
- Pointer and keyboard capture on the authored anchor toggle the menu before normal anchor activation. The anchor’s own `mdClick`, selection and navigation are suppressed, matching the separately recorded Chrome pointer/Enter/Space oracle. FAB width and label remain intact while its corners become elliptical, its palette changes and its icon fades to `close`; closing restores authored native presentation.
- Up/down/auto placement uses the actual anchor and viewport, keeps an 8dp anchor gap and respects logical inline-end alignment. Up reverses spatial item order, without reversing authored keyboard/typeahead order. Five density rungs drive actual item height, padding, icon size, typography, inner gap and stack gap.
- Retained item slots remain mounted while the menu is closed. Arrow keys, Home/End, Tab/Shift-Tab, Escape and a 300ms live-label typeahead use real native focus. Source traversal includes disabled items; they can receive explicit roving focus but cannot activate. The visible focus ring remains available independently of DOM focus equivalents.
- Item properties `icon`, `label`, `disabled`, `softDisabled`, `rovingFocusVisible` and `density` drive the dedicated renderer. A nonempty label masks but does not unmount the authored default slot. Search uses the trimmed label, then registered authored text. `AWCSlotText` renders and registers actual text; `AWCSearchableLabelScope` supplies a searchable label for custom native compositions. An explicit empty icon slot suppresses the fallback and retains its real icon box.
- `AWCFabMenuAppearance` exposes itemContainerColor, itemLabelColor and itemGap. `AWCFabMenuItemAppearance` exposes containerColor, labelColor, iconColor, iconSize and cornerRadius. Parent/local cascade, disabled ink/container precedence and authored icon-color precedence are implemented. Opt-in inspection reports actual root, state-layer, icon and label bounds and applied native measurements.
- Menu `mdOpen`/`mdClose` and item `mdClick` carry null callback/transport detail. Scoped native actions retain separate actual activation provenance and propagation; stopping item propagation prevents menu dismissal. Live events retain the actual emitting menu/item/anchor tag and authored node ID.
- The host correlates public method calls by callId, accepts them without blocking later input and polls results independently of streaming. It retains at most 32 unacknowledged records, handles repeated IDs idempotently, rejects mismatches/busy calls without killing the session and reports unknown IDs explicitly. Existing FAB setter acknowledgments remain separate.

## Verification

- [Final device report](evidence/md-fab-menu/device-results.xml): **9 methods passed**, zero failures/errors/skips. Five component methods exercise all 22 Chrome geometry fixtures, retained slots, lifecycle transitions, pointer/keyboard capture, outside-control activation, focus/typeahead, disabled behavior, propagation and real appearance pixels. One live-host method verifies real captured geometry, lifecycle/event attribution, printable native-key delivery, paused-stream completion, call retention and gutter dismissal. Three existing Button/IconButton/FAB activation regressions also passed.
- The native unit suite passed **75 cases**, including [six Menu contract cases](evidence/md-fab-menu/unit-contract-results.xml). These cover pending requests, reopen/close-cycle ownership, disconnect, controller ownership, ordered focus/typeahead and density/style values. Fixture combinations are subcases, not additional JUnit methods.
- All 117 captured native source/build inputs were unchanged during the final run: [hashes](evidence/md-fab-menu/source-sha256.json), [verification and exact command](evidence/md-fab-menu/verification.json), [Gradle log](evidence/md-fab-menu/device-run.log).
- The [initial run](evidence/md-fab-menu/initial-device-results.xml) remains available with its two failures. One used the wrong accessibility test locator. The other exposed Android’s default hinted text width: the Web and Android Roboto tables are identical, but hinted TextPaint measured “Authored label” at 89.9048dp versus Web92.523px. Linear/subpixel text measured 92.5714dp. The renderer now uses Compose’s supported `TextMotion.Animated` policy; the original 2dp source width bound was retained. A regression also checks identical native property-label and authored-slot typography. Font tables and device diagnostics are preserved in workspace `outputs/native-parity/md-fab-menu/android/font-investigation/`.
- Twenty-one production-generated Kotlin Usage/API examples compiled successfully. Exact snippets, hashes and compile evidence are preserved in workspace `outputs/native-parity/md-fab-menu/examples/`. The temporary source was removed after compilation.
- Final Laboratory browser verification is a separate integration step. These native results do not assert identical text rasterization or shadow pixels across operating systems.

## Inspector surface follow-up

The measured Android menu root is explicitly named `md-fab-menu overlay`: it is
the actual fixed overlay viewport, with actual item bounds beneath it. Closed
or hidden menus do not publish that root. The strengthened real host test verifies
initial closed and post-close frames have no inspection, then verifies the open
surface's name. Bounds and IDs were not replaced with the demo fixture bounds.
The [passing follow-up report](evidence/md-split-button/final-menu-host-results.xml)
and [build record](evidence/md-split-button/verification.json) are retained.

## Native boundaries

Compose content has no DOM `textContent`; arbitrary custom compositions use the explicit searchable-label scope. Native menu accessibility uses a named pane/collection, ordered focus and actionable item semantics rather than a DOM role string. Authored anchors are resolved within a native viewport scope, not a global document. Immutable native appearance is restored on close; the Web implementation deletes temporary inline styles and cannot preserve an overwritten inline declaration in the same way. There are no synthetic DOM MouseEvent, document or CSS-media objects.
