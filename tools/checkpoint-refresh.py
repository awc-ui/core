#!/usr/bin/env python3
"""Checkpoint refresh: keeps the source hashes in the components' checkpoint.json files honest against the canonical tree.

Every checkpoint.json under outputs/native-parity/<tag>/ (integration runs excluded) pins the files its evidence was produced on.
The pins come in several shapes, all recognised:
  {"<path>": "<hex>"}                                   (sources maps; md5, sha1 or sha256 by length)
  {"path"|"file"|"source": "<path>", "sha256"|"md5"|"sha1"|"hash"|"sourceSha256": "<hex>", ...}
Paths may be repo-relative, absolute, or relative to packages/native-ios, packages/native-android, the Compose library, the
Android playground or packages/core; the first existing candidate wins. Pins that resolve outside the tree (outputs, logs) are
evidence, not sources, and are left alone. Pins inside a `source*` map look in the tree first; any other pin first looks next
to its checkpoint (and the folders above it up to outputs/, and work/), where evidence files (logs, captures, web oracles,
installer scripts) live. A short path such as `main/X.kt` or `androidTest/X.kt` resolves to the unique tree file whose path
contains those components in order. Directory pins are checked against the usual directory-hash schemes; globs, descriptive
keys ("x.json (CDP mouse)" is read as x.json) and directory pins whose scheme is unknown are reported as unverifiable and do not
affect the verdict. A pin that resolves nowhere is a missing source when it looks like one (a tree path, or a source file
extension outside an evidence map), otherwise unresolved evidence.

Commands (default tree: the repository holding this script; default outputs: <tree>/../../outputs/native-parity):
  report  [--tags a,b] [--json FILE] [--markdown FILE]
          Per component: pins current / changed / missing, the evidence date, the newest change of a pinned source, the
          install job that most likely wrote it, the runs the checkpoint cites (checked against claude-runner/done), and a
          verdict: current | stale (evidence predates a source change) | unpinned (no source hashes) | stale-recorded
          (re-pinned by `refresh`, evidence not re-run yet).
  refresh [--tags a,b] [--dry-run]
          Re-pins every changed or missing pin to canonical and writes a `checkpointRefresh` record next to the pins: the date,
          the previous and current hash of each changed file, files no longer found, the runs the checkpoint cites, and
          `evidencePredatesSource: true` when anything changed; changes recorded by an unconfirmed earlier refresh stay listed
          (`carried`). The verdict stays `stale-recorded` until `confirm`.
  confirm TAG --runs JOB[,JOB…] [--note TEXT]
          After re-running the evidence on canonical: every pin must match canonical; records the backing runs and clears
          `evidencePredatesSource`.
  pin     TAG --checkpoint FILE --sources PATH[,PATH…] --runs JOB[,JOB…]
          Adds a repo-relative sha256 `sources` map to a checkpoint that has none (or extends it) and records the runs.
  selftest
Exit status: report → 1 when any component is stale (for gates), else 0; refresh/confirm/pin → 0 on success.
"""
import argparse, datetime, glob, hashlib, json, os, re, sys

HEX = re.compile(r'^[0-9a-f]{32}$|^[0-9a-f]{40}$|^[0-9a-f]{64}$')
PATH_KEYS = ('path', 'file', 'source')
HASH_KEYS = ('sha256', 'md5', 'sha1', 'hash', 'sourceSha256', 'sourceSHA256')
DATE_KEYS = ('date', 'createdAt', 'generatedAt', 'created', 'installedAt', 'updatedAt')
JOB = re.compile(r'\b((?:[a-z]{1,3}\d?[a-z]?)-A?\d{2,4}[a-z]?)\b')
BASES = ('', 'packages/native-ios', 'packages/native-android', 'packages/native-android/src/main/java/dev/awc/nativeui',
         'apps/native-android-playground', 'apps/native-android-playground/src', 'apps/native-ios-playground', 'packages/core',
         'packages/core/src/components')
# A bare file name (some checkpoints pin "NativeDialog.swift": md5) is looked up in these directories; the first hit wins.
NAME_DIRS = ('packages/native-ios/Sources/AWCUI', 'packages/native-ios/Tests', 'packages/native-android/src/main/java/dev/awc/nativeui',
             'apps/native-android-playground/src/androidTest/java/dev/awc/playground', 'apps/native-android-playground/src/debug/java/dev/awc/playground',
             'apps/native-playground', 'apps/native-ios-playground/scripts', 'packages/native-ios/Tests/Fixtures',
             'apps/native-android-playground/src/androidTest/assets')
RECORD = 'checkpointRefresh'
TREE_TOPS = ('packages/', 'apps/', 'tools/', 'Sources/', 'Tests/', 'src/', 'scripts/')
SOURCE_EXT = ('.swift', '.kt', '.kts', '.java', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.scss', '.gradle', '.sh', '.py', '.m', '.h')
EVIDENCE_CTX = re.compile(r'evidence|installer|patch|oracle|capture|artifact|junit|logs?$|runs?$|screenshot|result|web', re.I)
SKIP_DIRS = {'node_modules', '.build', 'build', '.gradle', '.git', '.cache', '.turbo', 'dist', 'www', '.swiftpm', 'DerivedData',
             'outputs', 'loader', '.stencil', 'coverage', 'hydrate', '.kotlin', '.idea'}


def digest(path, n):
    h = {32: hashlib.md5, 40: hashlib.sha1, 64: hashlib.sha256}[n]()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''): h.update(block)
    return h.hexdigest()


def looks_like_path(s):
    return isinstance(s, str) and ('/' in s or re.search(r'\.[A-Za-z0-9]{1,6}$', s) is not None) and not HEX.match(s) and len(s) < 400


class Pin:
    """One pinned file: where it sits in the JSON (container + hash key), the path it names and the keys leading to it."""
    def __init__(self, container, key, path, ctx):
        self.container, self.key, self.path, self.ctx = container, key, path, ctx
    @property
    def value(self): return self.container[self.key]
    @property
    def source_map(self): return any(k.lower().startswith('source') for k in self.ctx)
    @property
    def evidence_map(self): return any(EVIDENCE_CTX.search(k) for k in self.ctx)


def find_pins(node, out=None, skip_record=True, ctx=()):
    out = [] if out is None else out
    if isinstance(node, dict):
        pk = next((k for k in PATH_KEYS if looks_like_path(node.get(k))), None)
        hk = next((k for k in HASH_KEYS if isinstance(node.get(k), str) and HEX.match(node[k])), None)
        if pk and hk: out.append(Pin(node, hk, node[pk], ctx))
        for k, v in node.items():
            if skip_record and k == RECORD: continue
            if isinstance(v, str) and HEX.match(v) and looks_like_path(k): out.append(Pin(node, k, k, ctx))
            elif isinstance(v, (dict, list)): find_pins(v, out, skip_record, ctx + (str(k),))
    elif isinstance(node, list):
        for v in node: find_pins(v, out, skip_record, ctx)
    return out


def clean_path(path):
    """The file a pin names: "web.json (CDP mouse + touch)" names web.json."""
    return re.sub(r'\s+\([^)]*\)\s*$', '', path.strip())


_INDEX = {}
def tree_index(tree):
    """basename → [repo-relative paths] for every file in the tree outside build/dependency folders (built once per tree)."""
    if tree not in _INDEX:
        idx = {}
        for root, dirs, files in os.walk(tree):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
            for n in files: idx.setdefault(n, []).append(os.path.relpath(os.path.join(root, n), tree))
        _INDEX[tree] = idx
    return _INDEX[tree]


def by_components(tree, path):
    """The unique tree file named like `path` whose directories contain path's directories in order (main/X.kt, androidTest/X.kt)."""
    parts = path.split('/'); want = parts[:-1]; hits = []
    for rel in tree_index(tree).get(parts[-1], []):
        comps = rel.split('/')[:-1]; i = 0
        for c in comps:
            if i < len(want) and c == want[i]: i += 1
        if i == len(want): hits.append(rel)
    if len(hits) > 1:   # several candidates (main/AWCComponent.kt): prefer the usual source folders, in NAME_DIRS order
        for d in NAME_DIRS:
            pick = [h for h in hits if os.path.dirname(h) == d]
            if pick: hits = pick; break
    if len(hits) == 1: return os.path.join(tree, hits[0])
    return None


def dir_digests(path, n):
    """Common directory-hash schemes (sha256/md5 by length): `shasum` listings of the sorted files (with/without ./), and the
    concatenated contents."""
    files = sorted(os.path.relpath(os.path.join(r, f), path) for r, ds, fs in os.walk(path) for f in fs if not f.startswith('.'))
    alg = {32: hashlib.md5, 40: hashlib.sha1, 64: hashlib.sha256}[n]
    per = [(f, digest(os.path.join(path, f), n)) for f in files]
    out = set()
    for prefix in ('./', ''):
        out.add(alg(''.join(f'{h}  {prefix}{f}\n' for f, h in per).encode()).hexdigest())
    out.add(alg(''.join(f'{f}\n{h}\n' for f, h in per).encode()).hexdigest())
    out.add(alg(''.join(f'{f}:{h}\n' for f, h in per).encode()).hexdigest())
    out.add(alg(''.join(f'{h}\n' for f, h in per).encode()).hexdigest())
    c = alg()
    for f, _ in per:
        with open(os.path.join(path, f), 'rb') as fh: c.update(fh.read())
    out.add(c.hexdigest())
    return out


def resolve(tree, path, dirs=False):
    """Absolute path of a pinned file (or, with dirs, directory) inside the tree, or None (outside the tree, or not found)."""
    ok = (lambda q: os.path.isfile(q) or (dirs and os.path.isdir(q)))
    path = path.rstrip('/') if dirs else path
    if not path: return None
    if os.path.isabs(path):
        real = os.path.realpath(path)
        return real if real.startswith(os.path.realpath(tree) + os.sep) and ok(real) else None
    for base in BASES:
        p = os.path.join(tree, base, path)
        if ok(p): return p
    if '/' not in path:
        for base in NAME_DIRS:
            p = os.path.join(tree, base, path)
            if os.path.isfile(p): return p
        comp = glob.glob(os.path.join(tree, 'packages/core/src/components', '*', path))
        if comp: return sorted(comp)[0]
    elif not path.startswith(('../', './')):
        return by_components(tree, path)
    return None


def evidence_bases(tree, outputs, checkpoint):
    """Where evidence named by a checkpoint lives: its folder and the folders above it up to outputs/, outputs/.., the root, work/."""
    out = []; d = os.path.dirname(os.path.abspath(checkpoint)); top = os.path.abspath(outputs)
    while d.startswith(top):
        out.append(d)
        if d == top: break
        d = os.path.dirname(d)
    root = os.path.dirname(top)
    return out + [root, os.path.dirname(root), os.path.dirname(os.path.abspath(tree))]


def is_evidence(tree, outputs, path, checkpoint=None):
    """A pin naming evidence (an oracle, a log, a capture, an installer) rather than a source: outside the tree, or found next to
    the checkpoint / under outputs / under work."""
    if os.path.isabs(path): return not os.path.realpath(path).startswith(os.path.realpath(tree) + os.sep)
    if path.startswith(('outputs/', 'work/', '../', '~')): return True
    bases = evidence_bases(tree, outputs, checkpoint) if checkpoint else [outputs, os.path.dirname(outputs)]
    if any(os.path.exists(os.path.join(b, path)) for b in bases): return True
    if checkpoint:   # evidence kept in a sibling folder of the component (md-x/web-oracle/paint.json named "paint.json")
        comp = os.path.join(os.path.abspath(outputs), component_of(outputs, checkpoint))
        for root, dirs, files in os.walk(comp):
            if path in files or os.path.exists(os.path.join(root, path)): return True
    return False


def classify(tree, outputs, checkpoint, pin):
    """(state, resolved path or reason) for one pin: evidence | file | dir | missing | unresolved | unverifiable."""
    path = clean_path(pin.path)
    if not path or path in ('.', '/'): return 'unverifiable', 'empty path'
    if any(c in path for c in '*?[') : return 'unverifiable', 'glob'
    tree_first = pin.source_map or path.startswith(TREE_TOPS) or os.path.isabs(path)
    if not tree_first and is_evidence(tree, outputs, path, checkpoint): return 'evidence', None
    p = resolve(tree, path)
    if p: return 'file', p
    p = resolve(tree, path, dirs=True)
    if p and os.path.isdir(p): return 'dir', p
    if tree_first and is_evidence(tree, outputs, path, checkpoint): return 'evidence', None
    if path.startswith(TREE_TOPS) or (path.endswith(SOURCE_EXT) and not pin.evidence_map): return 'missing', None
    return 'unresolved', 'not found in the tree or next to the checkpoint (evidence named loosely)'


def inside_tree(tree, path):
    return not os.path.isabs(path) or os.path.realpath(path).startswith(os.path.realpath(tree) + os.sep)


def parse_date(v):
    if not isinstance(v, str): return None
    m = re.match(r'(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2}))?)?', v)
    if not m: return None
    try:
        return datetime.datetime.fromisoformat(m.group(1) + 'T' + (m.group(2) or '00:00') + ':' + (m.group(3) or '00'))
    except ValueError:
        return None


def evidence_date(doc, file):
    """The newest date the checkpoint states for its evidence (top level, or a refresh record), else the file's mtime."""
    dates = []
    def take(d):
        for k in DATE_KEYS:
            t = parse_date(d.get(k)) if isinstance(d, dict) else None
            if t: dates.append(t)
    take(doc)
    for k, v in (doc.items() if isinstance(doc, dict) else []):
        if isinstance(v, dict) and (k.lower().endswith('refresh') or k.startswith('gate7')) and k != RECORD: take(v)
    if dates: return max(dates), 'stated'
    return datetime.datetime.fromtimestamp(os.path.getmtime(file)), 'file mtime'


def cited_runs(doc, done_dir):
    text = json.dumps(doc)
    jobs = sorted(set(JOB.findall(text)))
    known = {}
    if done_dir and os.path.isdir(done_dir):
        names = os.listdir(done_dir)
        for j in jobs:
            hits = [n for n in names if n == j or n.startswith(j + '-') or n.startswith(j + '.')]
            if hits:
                exits = [n for n in hits if n.endswith('.exit')]
                code = None
                if exits:
                    try: code = open(os.path.join(done_dir, exits[0])).read().strip()[:12]
                    except OSError: pass
                known[j] = code if code is not None else 'done'
    paths = sorted(set(re.findall(r'[\w./-]*(?:claude-runner/done/|/runs/|/out/)[\w./-]+', text)))
    return {'jobs': {j: known.get(j, 'unknown') for j in jobs}, 'paths': paths[:40]}


def install_jobs(done_dir):
    """(end time, job) of every install job in claude-runner/done, oldest first."""
    out = []
    for p in glob.glob(os.path.join(done_dir, '*install*.log')):
        out.append((os.path.getmtime(p), os.path.basename(p)[:-4]))
    return sorted(out)


def nearest_install(installs, mtime):
    for end, job in installs:
        if end >= mtime - 1: return job
    return None


def checkpoints(outputs, tags):
    files = sorted(glob.glob(os.path.join(outputs, '**', 'checkpoint*.json'), recursive=True))
    files = [f for f in files if os.sep + 'integration' + os.sep not in f]
    if tags:
        files = [f for f in files if os.path.relpath(f, outputs).split(os.sep)[0] in tags]
    return files


def component_of(outputs, f):
    return os.path.relpath(f, outputs).split(os.sep)[0]


def examine(tree, outputs, done_dir, f, installs):
    raw = open(f).read(); doc = json.loads(raw)
    pins = find_pins(doc)
    rows = []; newest = None; loose = []
    for pin in pins:
        kind, p = classify(tree, outputs, f, pin)
        if kind == 'evidence': continue
        if kind in ('unverifiable', 'unresolved'):
            loose.append({'path': pin.path, 'state': kind, 'why': p}); continue
        if kind == 'missing':
            rows.append({'path': pin.path, 'state': 'missing'}); continue
        n = len(pin.value)
        if kind == 'dir':
            options = dir_digests(p, n)
            if pin.value not in options:
                loose.append({'path': pin.path, 'state': 'unverifiable', 'why': 'directory hash in an unknown scheme'}); continue
            cur = pin.value; m = max([os.path.getmtime(os.path.join(r, x)) for r, _, xs in os.walk(p) for x in xs] or [os.path.getmtime(p)])
        else:
            cur = digest(p, n); m = os.path.getmtime(p)
        st = 'current' if cur == pin.value else 'changed'
        row = {'path': pin.path, 'resolved': os.path.relpath(p, tree), 'state': st, 'pinned': pin.value, 'current': cur, 'mtime': m}
        if st == 'changed':
            row['installedBy'] = nearest_install(installs, m)
            newest = m if newest is None else max(newest, m)
        rows.append(row)
    ev, how = evidence_date(doc, f)
    rec = doc.get(RECORD) if isinstance(doc, dict) else None
    changed = [r for r in rows if r['state'] != 'current']
    if not rows: verdict = 'unpinned'
    elif changed: verdict = 'stale'
    elif isinstance(rec, dict) and rec.get('evidencePredatesSource'):
        verdict = 'stale-recorded'   # the changes `refresh` recorded stay listed until `confirm`
        changed = [{'path': p, 'state': 'recorded', 'installedBy': v.get('likelyInstall'), 'changedAt': v.get('changedAt')}
                   for p, v in (rec.get('changed') or {}).items() if isinstance(v, dict)]
        when = [parse_date(c['changedAt']) for c in changed if parse_date(c.get('changedAt'))]
        if when: newest = max(when).timestamp()
    else: verdict = 'current'
    return {'component': component_of(outputs, f), 'checkpoint': os.path.relpath(f, outputs), 'verdict': verdict,
            'pins': len(rows), 'current': sum(r['state'] == 'current' for r in rows),
            'changed': sum(r['state'] == 'changed' for r in rows), 'missing': sum(r['state'] == 'missing' for r in rows),
            'unverifiable': len(loose), 'loose': loose[:60], 'allPaths': sorted({r.get('resolved') or r['path'] for r in rows}),
            'evidenceDate': ev.isoformat(timespec='minutes'), 'evidenceDateFrom': how,
            'newestSourceChange': datetime.datetime.fromtimestamp(newest).isoformat(timespec='minutes') if newest else None,
            'files': changed, 'runs': cited_runs(doc, done_dir)}, doc, raw


def write_json(path, doc, raw):
    m = re.search(r'\n( +)"', raw); indent = len(m.group(1)) if m else 2
    text = json.dumps(doc, indent=indent, ensure_ascii=False) + ('\n' if raw.endswith('\n') else '')
    tmp = path + '.tmp'
    with open(tmp, 'w') as f: f.write(text)
    os.replace(tmp, path)


def now():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')


SHARED = 4   # a file pinned by this many components or more is shared (support policies, registries, AWCComponent.kt …)


def mark_shared(res):
    """Flags pins of shared files and checkpoints whose only changes are in shared files ("stale (shared files only)")."""
    owners = {}
    for r in res:
        for p in r.get('allPaths', []): owners.setdefault(p, set()).add(r['component'])
    count = {p: len(c) for p, c in owners.items()}
    for r in res:
        for f in r['files']: f['shared'] = count.get(f.get('resolved') or f['path'], 0) >= SHARED
        r['sharedOnly'] = r['verdict'] in ('stale', 'stale-recorded') and bool(r['files']) and all(f['shared'] for f in r['files'])
    return res


def cmd_report(a):
    installs = install_jobs(a.done)
    res = mark_shared([examine(a.tree, a.outputs, a.done, f, installs)[0] for f in checkpoints(a.outputs, a.tags)])
    if a.json:
        with open(a.json, 'w') as f: json.dump(res, f, indent=1)
    lines = ['| Component | Checkpoint | Verdict | Source pins (current/changed/missing) | Unverifiable | Evidence | Newest source change (likely install) | Runs cited |',
             '| --- | --- | --- | --- | --- | --- | --- | --- |']
    for r in res:
        inst = sorted({x.get('installedBy') for x in r['files'] if x.get('installedBy')})
        jobs = {j: s for j, s in r['runs']['jobs'].items() if s != 'unknown'}
        cited = ', '.join(f"{j}{'' if s in ('done', '0') else ' (exit ' + s + ')'}" for j, s in list(jobs.items())[:8]) + (' …' if len(jobs) > 8 else '')
        lines.append(f"| `{r['component']}` | {r['checkpoint']} | {r['verdict']}{' (shared files only)' if r['sharedOnly'] else ''} | {r['pins']} ({r['current']}/{r['changed']}/{r['missing']}) | {r['unverifiable'] or '—'} | "
                     f"{r['evidenceDate']} ({r['evidenceDateFrom']}) | {r['newestSourceChange'] or '—'}{' (' + ', '.join(inst) + ')' if inst else ''} | {cited or '—'} |")
    text = '\n'.join(lines) + '\n'
    if a.markdown:
        with open(a.markdown, 'w') as f: f.write(text)
    else:
        sys.stdout.write(text)
    by = {}
    for r in res: by[r['verdict']] = by.get(r['verdict'], 0) + 1
    comps = {}
    for r in res: comps.setdefault(r['component'], set()).add(r['verdict'])
    stale = sorted(c for c, v in comps.items() if v & {'stale', 'stale-recorded'})
    print(f"checkpoints {len(res)}: " + ', '.join(f'{k} {v}' for k, v in sorted(by.items())), file=sys.stderr)
    print('stale components: ' + (', '.join(stale) or 'none'), file=sys.stderr)
    return 1 if stale else 0


def cmd_refresh(a):
    installs = install_jobs(a.done); n = 0
    for f in checkpoints(a.outputs, a.tags):
        r, doc, raw = examine(a.tree, a.outputs, a.done, f, installs)
        if r['verdict'] not in ('stale',): continue
        record = {'date': now(), 'tree': os.path.realpath(a.tree), 'changed': {}, 'missing': [],
                  'runsCited': r['runs']['jobs'], 'evidenceDate': r['evidenceDate'], 'evidencePredatesSource': True,
                  'note': 'Pins re-set to canonical by tools/checkpoint-refresh.py; the cited runs were produced on the previous '
                          'content of the changed files: re-run the evidence, then `checkpoint-refresh.py confirm`.'}
        for pin in find_pins(doc):
            kind, p = classify(a.tree, a.outputs, f, pin)
            if kind == 'missing':
                if pin.path not in record['missing']: record['missing'].append(pin.path)
                continue
            if kind != 'file': continue
            cur = digest(p, len(pin.value))
            if cur != pin.value:
                record['changed'][pin.path] = {'pinned': pin.value, 'current': cur,
                                               'changedAt': datetime.datetime.fromtimestamp(os.path.getmtime(p)).isoformat(timespec='minutes'),
                                               'likelyInstall': nearest_install(installs, os.path.getmtime(p))}
                pin.container[pin.key] = cur
        prev = doc.get(RECORD)
        if isinstance(prev, dict):
            record['previous'] = {k: prev.get(k) for k in ('date', 'confirmedRuns', 'evidencePredatesSource') if k in prev}
            # Not confirmed since the previous refresh: its changes still postdate the evidence, so they stay listed (carried).
            if prev.get('evidencePredatesSource') and isinstance(prev.get('changed'), dict):
                for path, v in prev['changed'].items():
                    if path not in record['changed'] and isinstance(v, dict):
                        record['changed'][path] = {**v, 'carried': True}
                        if v.get('pinned'): record['changed'][path]['pinned'] = v['pinned']
        doc[RECORD] = record
        n += 1
        print(f"{'would refresh' if a.dry_run else 'refreshed'} {os.path.relpath(f, a.outputs)}: {len(record['changed'])} changed, {len(record['missing'])} missing")
        if not a.dry_run: write_json(f, doc, raw)
    print(f'{n} checkpoint(s) {"to refresh" if a.dry_run else "refreshed"}')
    return 0


def cmd_confirm(a):
    files = checkpoints(a.outputs, [a.tag]); installs = install_jobs(a.done)
    if not files: print(f'no checkpoint for {a.tag}', file=sys.stderr); return 2
    runs = [j for j in a.runs.split(',') if j]
    for f in files:
        r, doc, raw = examine(a.tree, a.outputs, a.done, f, installs)
        if r['changed'] or r['missing']:
            print(f"{r['checkpoint']}: {r['changed']} changed / {r['missing']} missing pins — refresh first and re-run on this content", file=sys.stderr)
            return 3
    for f in files:
        raw = open(f).read(); doc = json.loads(raw)
        rec = doc.get(RECORD) if isinstance(doc.get(RECORD), dict) else {}
        rec.update({'confirmedAt': now(), 'confirmedRuns': runs, 'evidencePredatesSource': False})
        if a.note: rec['confirmNote'] = a.note
        doc[RECORD] = rec; write_json(f, doc, raw); print(f'confirmed {os.path.relpath(f, a.outputs)}')
    return 0


def cmd_pin(a):
    f = a.checkpoint
    raw = open(f).read(); doc = json.loads(raw)
    src = doc.setdefault('sources', {})
    if not isinstance(src, dict): print('`sources` is not a map; pin by hand', file=sys.stderr); return 2
    for path in [p for p in a.sources.split(',') if p]:
        p = resolve(a.tree, path)
        if p is None: print(f'not found in the tree: {path}', file=sys.stderr); return 3
        src[os.path.relpath(p, a.tree)] = digest(p, 64)
    rec = doc.get(RECORD) if isinstance(doc.get(RECORD), dict) else {}
    rec.update({'pinnedAt': now(), 'confirmedRuns': [j for j in a.runs.split(',') if j], 'evidencePredatesSource': False})
    doc[RECORD] = rec; write_json(f, doc, raw); print(f'pinned {len(src)} sources in {f}')
    return 0


def cmd_selftest(_):
    import tempfile, shutil
    d = tempfile.mkdtemp(); ok = True
    try:
        tree = os.path.join(d, 'work', 'awc-native'); out = os.path.join(d, 'outputs', 'native-parity'); done = os.path.join(d, 'work', 'claude-runner', 'done')
        for p in (os.path.join(tree, 'packages/native-ios/Sources/AWCUI'), os.path.join(out, 'md-x/native'), os.path.join(out, 'md-y'), done): os.makedirs(p)
        a_swift = os.path.join(tree, 'packages/native-ios/Sources/AWCUI/A.swift'); open(a_swift, 'w').write('one')
        open(os.path.join(done, 'zz-001-run.exit'), 'w').write('0\n'); open(os.path.join(out, 'md-x/web.json'), 'w').write('{}')
        cp = os.path.join(out, 'md-x/native/checkpoint.json')
        json.dump({'component': 'md-x', 'date': '2026-01-01', 'jobs': ['zz-001'],
                   'sources': {'Sources/AWCUI/A.swift': hashlib.sha256(b'one').hexdigest()},
                   'oracles': {'web': {'sha256': '0' * 64}}, 'list': [{'path': 'packages/native-ios/Sources/AWCUI/A.swift', 'md5': hashlib.md5(b'one').hexdigest()}],
                   'byName': {'A.swift': hashlib.md5(b'one').hexdigest()}, 'oracleFiles': [{'file': 'md-x/web.json', 'sha256': '1' * 64}]},
                  open(cp, 'w'), indent=2)
        json.dump({'component': 'md-y', 'results': {}}, open(os.path.join(out, 'md-y/checkpoint.json'), 'w'))
        ns = argparse.Namespace(tree=tree, outputs=out, done=done, tags=None, json=None, markdown=os.path.join(d, 'r.md'))
        def verdicts():
            return {r['component']: r['verdict'] for r in (examine(tree, out, done, f, [])[0] for f in checkpoints(out, None))}
        ok &= verdicts() == {'md-x': 'current', 'md-y': 'unpinned'}
        open(a_swift, 'w').write('two')
        ok &= verdicts()['md-x'] == 'stale'
        ok &= cmd_report(ns) == 1
        cmd_refresh(argparse.Namespace(tree=tree, outputs=out, done=done, tags=None, dry_run=False))
        doc = json.load(open(cp))
        ok &= doc['sources']['Sources/AWCUI/A.swift'] == hashlib.sha256(b'two').hexdigest() and doc['list'][0]['md5'] == hashlib.md5(b'two').hexdigest()
        ok &= doc['byName']['A.swift'] == hashlib.md5(b'two').hexdigest() and doc['oracleFiles'][0]['sha256'] == '1' * 64
        ok &= doc['oracles']['web']['sha256'] == '0' * 64 and doc[RECORD]['evidencePredatesSource'] is True and doc[RECORD]['runsCited'] == {'zz-001': '0'}
        ok &= verdicts()['md-x'] == 'stale-recorded'
        ok &= sorted(f['path'] for f in examine(tree, out, done, cp, [])[0]['files']) == ['A.swift', 'Sources/AWCUI/A.swift', 'packages/native-ios/Sources/AWCUI/A.swift']
        b_swift = os.path.join(tree, 'packages/native-ios/Sources/AWCUI/B.swift'); open(b_swift, 'w').write('b1')
        doc = json.load(open(cp)); doc['sources']['Sources/AWCUI/B.swift'] = hashlib.sha256(b'b0').hexdigest(); json.dump(doc, open(cp, 'w'), indent=2)
        cmd_refresh(argparse.Namespace(tree=tree, outputs=out, done=done, tags=None, dry_run=False))
        rec = json.load(open(cp))[RECORD]
        ok &= set(rec['changed']) == {'Sources/AWCUI/B.swift', 'Sources/AWCUI/A.swift', 'packages/native-ios/Sources/AWCUI/A.swift', 'A.swift'} and rec['changed']['A.swift'].get('carried') is True
        ok &= cmd_confirm(argparse.Namespace(tree=tree, outputs=out, done=done, tag='md-x', runs='zz-002', note=None)) == 0
        ok &= verdicts()['md-x'] == 'current'
        ok &= cmd_pin(argparse.Namespace(tree=tree, checkpoint=os.path.join(out, 'md-y/checkpoint.json'), sources='packages/native-ios/Sources/AWCUI/A.swift', runs='zz-002')) == 0
        ok &= verdicts()['md-y'] == 'current'
        # evidence next to the checkpoint, short component paths, globs, directory pins, loose evidence, missing sources
        _INDEX.clear()
        k = os.path.join(tree, 'packages/native-android/src/main/java/dev/awc/nativeui/K.kt'); os.makedirs(os.path.dirname(k)); open(k, 'w').write('k')
        fx = os.path.join(tree, 'packages/native-ios/Tests/Fixtures/z-oracle'); os.makedirs(fx); open(os.path.join(fx, 'a.json'), 'w').write('a')
        os.makedirs(os.path.join(out, 'md-z/web-oracle')); open(os.path.join(out, 'md-z/web-oracle/paint.json'), 'w').write('p')
        open(os.path.join(out, 'md-z/run.log'), 'w').write('log')
        listing = hashlib.sha256(f"{hashlib.sha256(b'a').hexdigest()}  ./a.json\n".encode()).hexdigest()
        zp = os.path.join(out, 'md-z/checkpoint.json')
        json.dump({'date': '2026-01-02', 'sourceSha256': {'main/K.kt': hashlib.sha256(b'k').hexdigest()},
                   'evidence': {'run.log': '2' * 64, 'gone.log': '3' * 64, 'patch.py': '4' * 64},
                   'oracle': {'web-oracle/paint.json': '5' * 64, 'web-oracle/paint.json (CDP mouse)': '5' * 64},
                   'fixtures': {'packages/native-ios/Tests/Fixtures/z-oracle': listing, 'packages/native-ios/Tests/Fixtures/x/*': '6' * 64}},
                  open(zp, 'w'), indent=1)
        z = examine(tree, out, done, zp, [])[0]
        ok &= (z['verdict'], z['current'], z['changed'], z['missing'], z['unverifiable']) == ('current', 2, 0, 0, 3)
        open(os.path.join(fx, 'a.json'), 'w').write('b')
        z = examine(tree, out, done, zp, [])[0]
        ok &= (z['verdict'], z['current'], z['unverifiable']) == ('current', 1, 4)   # changed directory → unknown scheme, not stale
        doc = json.load(open(zp)); doc['sourceSha256']['packages/native-ios/Sources/AWCUI/Gone.swift'] = '7' * 64; json.dump(doc, open(zp, 'w'))
        z = examine(tree, out, done, zp, [])[0]
        ok &= (z['verdict'], z['missing']) == ('stale', 1)
        fake = [{'component': f'c{i}', 'verdict': 'stale', 'allPaths': ['S.json'] + (['own.swift'] if i == 0 else []),
                 'files': [{'path': 'S.json'}] + ([{'path': 'own.swift'}] if i == 0 else [])} for i in range(SHARED)]
        mark_shared(fake); ok &= [x['sharedOnly'] for x in fake] == [False] + [True] * (SHARED - 1)
    finally:
        shutil.rmtree(d)
    print('selftest', 'ok' if ok else 'FAILED'); return 0 if ok else 1


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--tree', default=here); ap.add_argument('--outputs'); ap.add_argument('--done')
    sub = ap.add_subparsers(dest='cmd', required=True)
    r = sub.add_parser('report'); r.add_argument('--tags'); r.add_argument('--json'); r.add_argument('--markdown')
    f = sub.add_parser('refresh'); f.add_argument('--tags'); f.add_argument('--dry-run', action='store_true')
    c = sub.add_parser('confirm'); c.add_argument('tag'); c.add_argument('--runs', required=True); c.add_argument('--note')
    p = sub.add_parser('pin'); p.add_argument('tag'); p.add_argument('--checkpoint', required=True); p.add_argument('--sources', required=True); p.add_argument('--runs', required=True)
    sub.add_parser('selftest')
    a = ap.parse_args()
    a.tree = os.path.abspath(a.tree)
    a.outputs = a.outputs or os.path.normpath(os.path.join(a.tree, '..', '..', 'outputs', 'native-parity'))
    a.done = a.done or os.path.normpath(os.path.join(a.tree, '..', 'claude-runner', 'done'))
    if getattr(a, 'tags', None): a.tags = [t.strip() for t in a.tags.split(',') if t.strip()]
    return {'report': cmd_report, 'refresh': cmd_refresh, 'confirm': cmd_confirm, 'pin': cmd_pin, 'selftest': cmd_selftest}[a.cmd](a)


if __name__ == '__main__':
    sys.exit(main())
