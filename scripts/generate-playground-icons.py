#!/usr/bin/env python3
"""Regenerate the playground-only variable icon font; see apps/shared/fonts/README.md."""
import argparse
import hashlib
import io
import itertools
import json
from pathlib import Path
import re
import subprocess
import sys

from fontTools import subset
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
import uharfbuzz as hb

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "apps/shared/fonts"
SOURCE = ROOT / "apps/test-html/node_modules/material-symbols/material-symbols-outlined.woff2"
SOURCE_SHA = "9ce39572570b5af3719ea4d0673329a4052a62595caf274dd47148d75927b2a4"
CATALOGS = ("html", "react", "vue", "svelte", "angular")
EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".vue", ".svelte", ".json"}
TEST_DIRECTORIES = {"test", "tests", "__tests__", "__fixtures__"}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def subtables(font):
    for lookup in font["GSUB"].table.LookupList.Lookup:
        for table in lookup.SubTable:
            yield getattr(table, "ExtSubTable", table)


def ligatures(font):
    letters = {glyph: chr(code) for code, glyph in font.getBestCmap().items() if code < 128}
    result = {}
    for table in subtables(font):
        for first, rules in getattr(table, "ligatures", {}).items():
            for rule in rules:
                name = "".join(letters[g] for g in [first] + rule.Component)
                assert name not in result or result[name] == rule.LigGlyph
                result[name] = rule.LigGlyph
    return result


def runtime_sources(directory):
    for path in directory.rglob("*"):
        if (path.suffix in EXTENSIONS and not path.name.endswith(".d.ts")
                and not TEST_DIRECTORIES.intersection(path.relative_to(directory).parts[:-1])
                and not re.search(r"\.(?:spec|test|e2e)\.", path.name)):
            yield path.relative_to(ROOT).as_posix()


def source_coverage(available):
    catalogs = {"apps/shared/catalog-samples.css"}
    for app in CATALOGS:
        directory = ROOT / f"apps/test-{app}"
        catalogs.update(runtime_sources(directory / "src"))
        if (directory / "index.html").is_file():
            catalogs.add(f"apps/test-{app}/index.html")
    core = set(runtime_sources(ROOT / "packages/core/src"))
    files = catalogs | core
    # Keep complete catalog tokens, and collect literals from production Core
    # regardless of the component that renders them. JSX text, icon defaults,
    # quoted CSS values and each conditional branch can all supply ligatures.
    # The JS helper uses the workspace's TypeScript parser for syntax/escapes.
    extracted = json.loads(subprocess.check_output(
        ["node", "scripts/playground-icon-literals.mjs"], cwd=ROOT,
        input=json.dumps(sorted(files)), text=True,
    ))
    names, codepoints = {}, set()
    for path in sorted(files):
        text = (ROOT / path).read_text()
        candidates = set(extracted[path]["names"])
        if path in catalogs:
            candidates.update(re.findall(r"[A-Za-z0-9_]+", text))
        for name in sorted(candidates & available):
            names.setdefault(name, []).append(path)
        codepoints.update(extracted[path]["codepoints"])
        codepoints.update(ord(char) for char in text if 0xE000 <= ord(char) <= 0xF8FF)
        for match in re.finditer(r"\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|&#x([0-9a-fA-F]+);", text):
            value = int(next(group for group in match.groups() if group), 16)
            if 0xE000 <= value <= 0xF8FF:
                codepoints.add(value)
    assert names, "No icon names found"
    return names, codepoints, len(files)


def axes(font):
    return [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in font["fvar"].axes]


def harfbuzz_font(font):
    previous = font.flavor
    font.flavor = None
    stream = io.BytesIO()
    font.save(stream)
    font.flavor = previous
    result = hb.Font(hb.Face(stream.getvalue()))
    hb.ot_font_set_funcs(result)
    return result


def shape(font, hbfont, text):
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    hb.shape(hbfont, buffer, {"rlig": True, "liga": True})
    return [(font.getGlyphName(info.codepoint), position.x_advance, position.y_advance,
             position.x_offset, position.y_offset) for info, position in zip(buffer.glyph_infos, buffer.glyph_positions)]


def verify(original, reduced, selected, codepoints):
    assert axes(original) == axes(reduced), "Variable axes changed"
    assert ligatures(reduced) == {name: ligatures(original)[name] for name in selected}, "Ligature coverage changed"
    original_hb, reduced_hb = harfbuzz_font(original), harfbuzz_font(reduced)
    tags = [axis[0] for axis in axes(original)]
    coordinates = list(itertools.product(*(sorted(set(axis[1:])) for axis in axes(original))))
    texts = sorted(selected) + [chr(code) for code in sorted(codepoints)]
    for values in coordinates:
        location = dict(zip(tags, values))
        original_hb.set_variations(location)
        reduced_hb.set_variations(location)
        original_glyphs, reduced_glyphs = original.getGlyphSet(location=location), reduced.getGlyphSet(location=location)
        checked = set()
        for text in texts:
            expected = shape(original, original_hb, text)
            actual = shape(reduced, reduced_hb, text)
            assert len(expected) == 1 and expected == actual, f"Shaping changed: {text!r}, {location}: {expected} != {actual}"
            glyph = expected[0][0]
            if glyph in checked:
                continue
            checked.add(glyph)
            before, after = RecordingPen(), RecordingPen()
            original_glyphs[glyph].draw(before)
            reduced_glyphs[glyph].draw(after)
            assert before.value == after.value, f"Outline changed: {glyph}, {location}"
    return len(coordinates), len(texts) * len(coordinates)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Regenerate and verify without writing; fail on stale checked-in assets")
    options = parser.parse_args()
    source_bytes = SOURCE.read_bytes()
    assert digest(source_bytes) == SOURCE_SHA, "Unexpected material-symbols font; review source version/hash before regenerating"
    original = TTFont(io.BytesIO(source_bytes), recalcTimestamp=False)
    available = ligatures(original)
    selected, codepoints, file_count = source_coverage(set(available))
    missing = codepoints - set(original.getBestCmap())
    assert not missing, f"Source uses unsupported icon codepoints: {missing}"
    reduced = TTFont(io.BytesIO(source_bytes), recalcTimestamp=False)
    # Prune before closure. Without this, retaining the input letters would keep
    # all 4,167 ligatures. Keep variation substitutions so FILL retains its glyphs.
    letters = {glyph: chr(code) for code, glyph in original.getBestCmap().items() if code < 128}
    for table in subtables(reduced):
        if hasattr(table, "ligatures"):
            table.ligatures = {first: [rule for rule in rules if "".join(letters[g] for g in [first] + rule.Component) in selected]
                               for first, rules in table.ligatures.items()}
            table.ligatures = {first: rules for first, rules in table.ligatures.items() if rules}
    config = subset.Options()
    config.layout_features = ["*"]
    config.glyph_names = True
    config.name_IDs = ["*"]
    config.name_legacy = True
    config.name_languages = ["*"]
    config.recalc_timestamp = False
    subsetter = subset.Subsetter(options=config)
    cmap = original.getBestCmap()
    inputs = {cmap[ord(char)] for name in selected for char in name}
    subsetter.populate(glyphs=inputs | {available[name] for name in selected} | {cmap[code] for code in codepoints}, unicodes=[32] + sorted(codepoints))
    subsetter.subset(reduced)
    stream = io.BytesIO()
    reduced.save(stream)
    output = stream.getvalue()
    # Read the actual serialized artifact, not just the in-memory subset.
    reduced = TTFont(io.BytesIO(output), recalcTimestamp=False)
    locations, comparisons = verify(original, reduced, selected, codepoints)
    manifest = {
        "source": "material-symbols@0.40.2/material-symbols-outlined.woff2",
        "sourceSha256": SOURCE_SHA,
        "sourceBytes": len(source_bytes), "subsetBytes": len(output), "subsetSha256": digest(output),
        "sourceGlyphs": len(original.getGlyphOrder()), "subsetGlyphs": len(reduced.getGlyphOrder()),
        "sourceLigatures": len(available), "selectedLigatures": len(selected), "sourceFilesScanned": file_count,
        "axes": axes(reduced), "verifiedAxisLocations": locations, "verifiedShapesAndOutlines": comparisons,
        "codepoints": [f"U+{code:04X}" for code in sorted(codepoints)],
        "icons": {name: {"glyph": available[name], "sourceExamples": paths[:3], "sourceFileCount": len(paths)} for name, paths in sorted(selected.items())},
    }
    artifacts = {
        "material-symbols-outlined-subset.woff2": output,
        "coverage.json": (json.dumps(manifest, indent=2) + "\n").encode(),
        "LICENSE": SOURCE.with_name("LICENSE").read_bytes(),
    }
    for name, data in artifacts.items():
        target = DEST / name
        if options.check:
            assert target.read_bytes() == data, f"Stale {target.relative_to(ROOT)}; regenerate"
        else:
            DEST.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    print(f"{'Verified' if options.check else 'Generated'} {len(selected)} ligatures / {len(reduced.getGlyphOrder())} glyphs: "
          f"{len(source_bytes):,} -> {len(output):,} bytes ({100 * (1 - len(output) / len(source_bytes)):.1f}% smaller); "
          f"{comparisons:,} shape/outline comparisons across {locations} axis locations")


if __name__ == "__main__":
    main()
