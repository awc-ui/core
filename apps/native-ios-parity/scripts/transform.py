#!/usr/bin/env python3
"""Rewrite one macOS parity fixture (packages/native-ios/Tests/<Name>.swift) for the iOS host app.

usage: transform.py [--support] SOURCE.swift OUT_DIR FIXTURES_DIR   (--support: no entry point; adds to fixtures.txt)
Writes OUT_DIR/<Name>.swift and OUT_DIR/fixtures.txt (the Tests/Fixtures entries the source names).
Only mechanical substitutions are made; the fixture's checks and tolerances are untouched:
  import AppKit -> import UIKit (the AppKit surface comes from Shim/AppKitShim.swift)
  @main removed; AWCParityFixture.run() calls the fixture's static main()
  #filePath -> a path inside the app bundle, where the referenced oracles are copied
  .accessibilityIdentifier() -> .awcShimAccessibilityIdentifier() (UIKit exposes a property)
  NSViewRepresentable / makeNSView / updateNSView -> UIKit spellings
"""
import os, re, sys
support = len(sys.argv) > 1 and sys.argv[1] == '--support'  # support source: substitutions only, no entry point
if support: sys.argv.pop(1)
src, out, fixtures = sys.argv[1:4]
name = os.path.splitext(os.path.basename(src))[0]
s = open(src).read()
m = re.search(r'@main\s+(?:@MainActor\s+)?(?:enum|struct|final class|class)\s+(\w+)', s)
if not m and not support: sys.exit('no @main type in ' + src)
entry = m.group(1) if m else None
s = re.sub(r'^import AppKit\s*$', 'import UIKit', s, flags=re.M)
s = re.sub(r'^import Carbon(\.HIToolbox)?\s*$', '', s, flags=re.M)
if not support: s = re.sub(r'@main(\s+)', r'\1', s, count=1)
# Keep the source's position under packages/native-ios (Tests/… or Tests/AWCUITests/…) so relative oracle paths resolve.
rel = src[src.rindex('/Tests/') + 1:] if '/Tests/' in src else 'Tests/%s.swift' % name
s = s.replace('#filePath', '(Bundle.main.bundlePath + "/%s")' % rel)
s = s.replace('.accessibilityIdentifier()', '.awcShimAccessibilityIdentifier()')
# AppKit window coordinates have a bottom-left origin; the shim's window coordinates are UIKit's (top-left), so the
# AppKit flip idiom for an event location, `NSPoint(x: x, y: <view>.bounds.height - y)`, is the plain top-left y.
s = re.sub(r'NSPoint\(x: ([^,()]+), y: \w+(?:\.contentView!)?\.bounds\.height - (\w+)\)', r'NSPoint(x: \1, y: \2)', s)
# precondition-style fixtures stop at their first failed check; the simulator build is -O, where the trap prints no
# message, so the shim versions print it (as a FAIL line) before trapping exactly like the original.
s = re.sub(r'(?<![.\w])precondition\(', 'awcShimPrecondition(', s)
s = re.sub(r'(?<![.\w])preconditionFailure\(', 'awcShimPreconditionFailure(', s)
# NSAccessibility getters whose names are UIKit properties: route them to shim methods.
for prop in ('Label', 'Value', 'Help', 'RoleDescription', 'CustomActions'):
    s = s.replace('.accessibility%s()' % prop, '.awcShimAccessibility%s()' % prop)
s = s.replace('.isAccessibilityElement()', '.awcShimIsAccessibilityElement()')
s = re.sub(r'\bNSViewRepresentable\b', 'UIViewRepresentable', s)
s = s.replace('makeNSView', 'makeUIView').replace('updateNSView', 'updateUIView').replace('dismantleNSView', 'dismantleUIView')
# The entry may be `throws` and/or `async` (the macOS executables run it as their @main entry).
sig = re.search(r'static func main\(\)\s*(async)?\s*(throws)?', s) if not support else None
is_async, throws = bool(sig and sig.group(1)), bool(sig and sig.group(2))
if is_async:
    call = ('try await ' if throws else 'await ') + entry + '.main()'
    body = ('let box = AWCParityAsyncBox(); Task { @MainActor in do { %s } catch { print("FAIL: fixture threw \\(error)") }; box.done = true }; '
            'while !box.done { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) }') % call
elif throws: body = 'do { try %s.main() } catch { print("FAIL: fixture threw \\(error)") }' % entry
else: body = '%s.main()' % entry
if not support: s += '\n\nfinal class AWCParityAsyncBox { var done = false }\nenum AWCParityFixture { static let name = "%s"; @MainActor static func run() { %s } }\n' % (name, body)
os.makedirs(out, exist_ok=True)
open(os.path.join(out, name + '.swift'), 'w').write(s)
entries = set(os.listdir(fixtures)) if os.path.isdir(fixtures) else set()
used = set()
for lit in re.findall(r'"([A-Za-z0-9_./\-]+)"', s):
    lit = lit[len('Fixtures/'):] if lit.startswith('Fixtures/') else lit
    for cand in (lit, lit + '.json', lit.split('/')[0]):
        if cand in entries: used.add(cand)
# Interpolated names ("meter-web-\(scheme).json"): bundle every oracle entry with that literal prefix.
for prefix in re.findall(r'"([A-Za-z0-9_./\-]{4,})\\\(', s):
    prefix = prefix[len('Fixtures/'):] if prefix.startswith('Fixtures/') else prefix
    used |= {e for e in entries if e.startswith(prefix)}
for extra in os.environ.get('AWC_IOS_FIXTURES', '').split():
    if extra in entries: used.add(extra)
listing = os.path.join(out, 'fixtures.txt')
if support and os.path.exists(listing): used |= set(l.strip() for l in open(listing) if l.strip())
open(listing, 'w').write('\n'.join(sorted(used)) + '\n')
print('support' if support else '', name, entry, 'fixtures:', ' '.join(sorted(used)) or '-')
