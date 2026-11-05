#!/usr/bin/env python3
"""Collect iOS harness results into a checkpoint: summarize.py OUT_DIR [label=suite ...]

Reads OUT_DIR/console-<label>.log (copied by the runner wrapper after each run) and writes
OUT_DIR/checkpoint.json with, per label: the fixture summary line, passed/total checks, the FAIL
lines grouped by check kind, and the harness notes (AWC-IOS-UNSUPPORTED)."""
import json, os, re, sys, collections
out = sys.argv[1]
labels = sys.argv[2:]
res = {}
for label in labels:
    path = os.path.join(out, 'console-%s.log' % label)
    if not os.path.exists(path): res[label] = {'status': 'missing'}; continue
    text = open(path, errors='replace').read()
    start = re.search(r'^AWC-IOS-START (.*)$', text, re.M)
    summary = [l for l in text.splitlines() if re.search(r'\d+/\d+ (checks|snapshots)', l)]
    fails = [l[6:] for l in text.splitlines() if l.startswith('FAIL: ')]
    kinds = collections.Counter(re.sub(r'[-0-9.(),\[\] ]+(vs|$).*', '', ' '.join(f.split(' ')[1:3])) for f in fails)
    m = re.search(r'(\d+)/(\d+) (?:checks|snapshots)', summary[-1]) if summary else None
    res[label] = {
        'device': start.group(1) if start else None,
        'summary': summary[-1] if summary else None,
        'passed': int(m.group(1)) if m else None, 'total': int(m.group(2)) if m else None,
        'failures': len(fails), 'failureKinds': dict(kinds.most_common(12)), 'firstFailures': fails[:8],
        'notes': sorted(set(re.findall(r'^AWC-IOS-UNSUPPORTED: (.*)$', text, re.M))),
        'crashed': 'Fatal error' in text or (start is not None and 'AWC-IOS-END' not in text and not summary),
    }
json.dump(res, open(os.path.join(out, 'checkpoint-suites.json'), 'w'), indent=1, sort_keys=True)
for k, v in res.items(): print(k, v.get('passed'), '/', v.get('total'), 'fails', v.get('failures'), v.get('notes') or '')
