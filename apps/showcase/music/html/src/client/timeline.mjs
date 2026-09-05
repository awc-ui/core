/**
 * Dragging, resizing and deleting clips.
 *
 * IT REWRITES `data-start` AND `data-span`, and nothing else. The layout is a
 * CSS grid with one column per bar, so moving a clip a bar is changing one
 * integer and letting the stylesheet re-place it — which is the only technique
 * available to this build, since `style-src-attr 'none'` refuses the `style`
 * attribute a pixel offset would need and there is no CSSOM in a static page's
 * markup. It is also why this build and the four SPAs drag identically.
 *
 * THE HISTORY IS THE KIT'S. `record`, `undo`, `redo` and `invertEdit` are the
 * same functions the other four call, so the redo branch is discarded on a new
 * edit here for the same reason it is there.
 */
import {
  barsMoved,
  canRedo,
  canUndo,
  clipFits,
  emptyHistory,
  invertEdit,
  makeEdit,
  nextRedo,
  nextUndo,
  record,
  redo as redoHistory,
  undo as undoHistory,
} from '@awc-ui/showcase-kit/music';
import { raise } from './snackbar.mjs';

const ZOOMS = ['sm', 'md', 'lg'];

/*
 * THESE LISTEN FOR `click`, NOT `mdClick`.
 *
 * `mdClick` is raised by the real `<button>` inside the component's shadow
 * root, so it fires for a reader's press and NOT for `element.click()` on the
 * host. The native `click` is composed and crosses the shadow boundary, so it
 * covers both — which matters because the browser suite presses by calling
 * `click()`, and a control wired to `mdClick` alone looks completely inert to
 * it while working perfectly for a person. That asymmetry is exactly the kind
 * of thing a test suite exists to rule out, so the build takes the event both
 * can raise.
 */
export function enhanceTimeline(root = document) {
  const timeline = root.querySelector('.timeline:not([data-bound])');
  if (!timeline) return;
  timeline.setAttribute('data-bound', '');

  const clips = [...root.querySelectorAll('.clip[data-clip]')];
  let history = emptyHistory;
  let selected = null;
  let editSeq = 0;
  let drag = null;
  /* Keyed to the CLIP, not a bare boolean: a click that never arrives must not
     be able to swallow the next press on a different clip. */
  let swallowClick = null;

  const historyTemplate = root.querySelector('template.studio__history-template');
  const historyList = root.querySelector('.history-list');
  const emptyNotice = root.querySelector('.empty');
  const undoButton = root.querySelector('.studio__undo');
  const redoButton = root.querySelector('.studio__redo');
  const zoomIn = root.querySelector('.studio__zoom-in');
  const zoomOut = root.querySelector('.studio__zoom-out');

  const barsOf = (el) => Number(el.closest('.lane')?.getAttribute('data-bars') ?? 0);
  const startOf = (el) => Number(el.getAttribute('data-start'));
  const spanOf = (el) => Number(el.getAttribute('data-span'));

  const laneOf = (el) =>
    [...el.closest('.lane').querySelectorAll('.clip[data-clip]')].map((c) => ({
      id: c.getAttribute('data-clip'),
      startBar: startOf(c),
      bars: spanOf(c),
    }));

  /** Rebuild the accessible name from the words the build wrote onto the clip. */
  function rename(el) {
    const name = el.getAttribute('data-name') ?? '';
    const bar = el.getAttribute('data-word-bar') ?? '';
    const bars = el.getAttribute('data-word-bars') ?? '';
    el.setAttribute('aria-label', `${name}, ${bar} ${startOf(el)}, ${spanOf(el)} ${bars}`);
  }

  /** One row, cloned from the prototype the build wrote for that edit kind. */
  function historyRow(edit, undone) {
    const prototype = historyTemplate?.content.querySelector(
      `.history-row[data-kind="${edit.kind}"]`,
    );
    if (!prototype) return null;
    const row = prototype.cloneNode(true);
    row.toggleAttribute('data-undone', undone);
    return row;
  }

  function renderTools() {
    undoButton?.toggleAttribute('soft-disabled', !canUndo(history));
    redoButton?.toggleAttribute('soft-disabled', !canRedo(history));

    /* Undo NAMES what it will reverse — the word comes off a cloned row, which
       is the only place this build holds the translated name of an edit. */
    const pendingUndo = nextUndo(history);
    if (undoButton) {
      const label = undoButton.getAttribute('data-label-undo') ?? '';
      const named = pendingUndo ? historyRow(pendingUndo, false)?.textContent?.trim() : null;
      undoButton.setAttribute('aria-label', named ? `${label}: ${named}` : label);
    }
    const pendingRedo = nextRedo(history);
    if (redoButton) {
      const label = redoButton.getAttribute('data-label-redo') ?? '';
      const named = pendingRedo ? historyRow(pendingRedo, false)?.textContent?.trim() : null;
      redoButton.setAttribute('aria-label', named ? `${label}: ${named}` : label);
    }

    if (!historyList) return;
    historyList.replaceChildren();
    for (const edit of history.done) {
      const row = historyRow(edit, false);
      if (row) historyList.append(row);
    }
    /* An undone edit is still listed — it is what redo will reapply. */
    for (const edit of history.undone) {
      const row = historyRow(edit, true);
      if (row) historyList.append(row);
    }
    emptyNotice?.toggleAttribute('hidden', history.done.length > 0 || history.undone.length > 0);
  }

  const push = (edit) => {
    history = record(history, edit);
    renderTools();
  };

  /*
   * A DELETED CLIP LEAVES THE DOCUMENT, and is kept here so undo can put it
   * back where it was. The four SPA builds unmount it, and the parity census
   * counts ELEMENTS rather than visible ones — a merely hidden clip would be
   * one element this build has and the other four do not.
   */
  const graveyard = new Map();

  function apply(edit) {
    /* Restoring comes first: `querySelector` cannot find what is not there. */
    if ('removed' in edit.after && edit.after.removed === false) {
      const buried = graveyard.get(edit.targetId);
      if (buried) {
        buried.lane.append(buried.node);
        graveyard.delete(edit.targetId);
      }
      return;
    }
    const el = root.querySelector(`.clip[data-clip="${edit.targetId}"]`);
    if (!el) return;
    if ('startBar' in edit.after) el.setAttribute('data-start', String(edit.after.startBar));
    if ('bars' in edit.after) el.setAttribute('data-span', String(edit.after.bars));
    if ('removed' in edit.after && edit.after.removed === true) {
      graveyard.set(edit.targetId, { node: el, lane: el.parentElement });
      el.remove();
      return;
    }
    rename(el);
  }

  /* ------------------------------------------------------------- pointer */

  for (const el of clips) {
    const begin = (event, mode) => {
      if (event.button !== 0) return;
      const lane = el.closest('.lane');
      if (!lane) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      drag = {
        el,
        mode,
        originX: event.clientX,
        fromStart: startOf(el),
        fromBars: spanOf(el),
        laneWidth: lane.getBoundingClientRect().width,
      };
      select(el);
    };

    const move = (event) => {
      if (!drag || drag.el !== el) return;
      /* RTL reads right to left, so a drag towards the start of the timeline is
         a drag to the RIGHT. */
      const rtl = document.documentElement.dir === 'rtl';
      const delta = (event.clientX - drag.originX) * (rtl ? -1 : 1);
      const bars = barsOf(el);
      const moved = barsMoved(delta, drag.laneWidth, bars);
      if (moved === 0) return;
      const others = laneOf(el);

      if (drag.mode === 'move') {
        const next = drag.fromStart + moved;
        if (next === startOf(el)) return;
        if (!clipFits(others, el.getAttribute('data-clip'), next, drag.fromBars, bars)) return;
        el.setAttribute('data-start', String(next));
      } else {
        const next = drag.fromBars + moved;
        if (next < 1 || next === spanOf(el)) return;
        if (!clipFits(others, el.getAttribute('data-clip'), drag.fromStart, next, bars)) return;
        el.setAttribute('data-span', String(next));
      }
      rename(el);
    };

    const end = (event) => {
      if (!drag || drag.el !== el) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const id = el.getAttribute('data-clip');
      const changed =
        drag.mode === 'move' ? startOf(el) !== drag.fromStart : spanOf(el) !== drag.fromBars;
      if (changed) {
        push(
          drag.mode === 'move'
            ? makeEdit(`e${(editSeq += 1)}`, 'clip.move', 'music.edit.clipMove', id,
                { startBar: drag.fromStart }, { startBar: startOf(el) })
            : makeEdit(`e${(editSeq += 1)}`, 'clip.resize', 'music.edit.clipResize', id,
                { bars: drag.fromBars }, { bars: spanOf(el) }),
        );
        raise(el.getAttribute(drag.mode === 'move' ? 'data-msg-moved' : 'data-msg-resized'));
      }
      swallowClick = changed ? id : null;
      drag = null;
    };

    el.addEventListener('pointerdown', (event) => begin(event, 'move'));
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    const handle = el.querySelector('.clip__resize');
    handle?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      begin(event, 'resize');
    });
    handle?.addEventListener('pointermove', move);
    handle?.addEventListener('pointerup', end);
    handle?.addEventListener('pointercancel', end);

    el.addEventListener('click', () => {
      const id = el.getAttribute('data-clip');
      if (swallowClick === id) {
        swallowClick = null;
        return;
      }
      swallowClick = null;
      select(selected === el ? null : el);
    });

    el.addEventListener('keydown', (event) => {
      const bars = barsOf(el);
      const others = laneOf(el);
      const id = el.getAttribute('data-clip');
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

      if (step !== 0) {
        event.preventDefault();
        /* Shift turns the arrows from "move" into "resize". */
        if (event.shiftKey) {
          const next = spanOf(el) + step;
          if (next < 1 || !clipFits(others, id, startOf(el), next, bars)) return;
          const before = spanOf(el);
          el.setAttribute('data-span', String(next));
          rename(el);
          push(makeEdit(`e${(editSeq += 1)}`, 'clip.resize', 'music.edit.clipResize', id, { bars: before }, { bars: next }));
          raise(el.getAttribute('data-msg-resized'));
          return;
        }
        const next = startOf(el) + step;
        if (!clipFits(others, id, next, spanOf(el), bars)) return;
        const before = startOf(el);
        el.setAttribute('data-start', String(next));
        rename(el);
        push(makeEdit(`e${(editSeq += 1)}`, 'clip.move', 'music.edit.clipMove', id, { startBar: before }, { startBar: next }));
        raise(el.getAttribute('data-msg-moved'));
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        remove(el);
      }
    });
  }

  /*
   * The toolbar is CLONED OUT OF ITS TEMPLATE on the first selection — see the
   * note in `screens/studio.mjs` for why it is not simply hidden. Cloning is
   * done once; after that the buttons are only shown and hidden.
   */
  const toolsTemplate = root.querySelector('template.studio__tools-template');
  let tools = null;

  function materialiseTools() {
    if (tools || !toolsTemplate) return tools;
    const fragment = toolsTemplate.content.cloneNode(true);
    tools = [...fragment.children];
    toolsTemplate.replaceWith(fragment);

    const act = (cls, run) =>
      tools.find((el) => el.classList.contains(cls))?.addEventListener('click', () => {
        if (selected) run(selected);
      });

    act('studio__nudge-back', (el) => nudge(el, -1));
    act('studio__nudge-forward', (el) => nudge(el, 1));
    act('studio__shrink', (el) => stretch(el, -1));
    act('studio__grow', (el) => stretch(el, 1));
    act('studio__delete', (el) => remove(el));
    return tools;
  }

  function nudge(el, delta) {
    const id = el.getAttribute('data-clip');
    const before = startOf(el);
    const next = before + delta;
    if (!clipFits(laneOf(el), id, next, spanOf(el), barsOf(el))) return;
    el.setAttribute('data-start', String(next));
    rename(el);
    push(makeEdit(`e${(editSeq += 1)}`, 'clip.move', 'music.edit.clipMove', id, { startBar: before }, { startBar: next }));
    raise(el.getAttribute('data-msg-moved'));
  }

  function stretch(el, delta) {
    const id = el.getAttribute('data-clip');
    const before = spanOf(el);
    const next = before + delta;
    if (next < 1 || !clipFits(laneOf(el), id, startOf(el), next, barsOf(el))) return;
    el.setAttribute('data-span', String(next));
    rename(el);
    push(makeEdit(`e${(editSeq += 1)}`, 'clip.resize', 'music.edit.clipResize', id, { bars: before }, { bars: next }));
    raise(el.getAttribute('data-msg-resized'));
  }

  function remove(el) {
    const id = el.getAttribute('data-clip');
    graveyard.set(id, { node: el, lane: el.parentElement });
    el.remove();
    select(null);
    push(makeEdit(`e${(editSeq += 1)}`, 'clip.remove', 'music.edit.clipRemove', id, { removed: false }, { removed: true }));
    raise(el.getAttribute('data-msg-removed'));
  }

  function select(el) {
    selected = el;
    for (const clip of clips) {
      const on = clip === el;
      clip.toggleAttribute('data-selected', on);
      clip.setAttribute('aria-pressed', String(on));
    }
    if (el) materialiseTools();
    /* Each button names the clip it will act on: the verb was translated by
       the build, the noun comes off the clip. */
    for (const button of tools ?? []) {
      button.toggleAttribute('hidden', el === null);
      if (el) {
        button.setAttribute('aria-label', `${button.getAttribute('data-verb')}: ${el.getAttribute('data-name')}`);
      }
    }
  }

  /* -------------------------------------------------------------- tools */

  undoButton?.addEventListener('click', () => {
    const step = undoHistory(history);
    history = step.history;
    if (step.edit) apply(invertEdit(step.edit));
    else raise(undoButton.getAttribute('data-msg-nothing'));
    renderTools();
  });

  redoButton?.addEventListener('click', () => {
    const step = redoHistory(history);
    history = step.history;
    if (step.edit) apply(step.edit);
    else raise(redoButton.getAttribute('data-msg-nothing'));
    renderTools();
  });

  const setZoom = (delta) => {
    const at = ZOOMS.indexOf(timeline.getAttribute('data-zoom') ?? 'md');
    const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, at + delta))];
    timeline.setAttribute('data-zoom', next);
    zoomOut?.toggleAttribute('soft-disabled', next === 'sm');
    zoomIn?.toggleAttribute('soft-disabled', next === 'lg');
  };
  zoomIn?.addEventListener('click', () => setZoom(1));
  zoomOut?.addEventListener('click', () => setZoom(-1));

  renderTools();
  enhanceLaneNames(root);
}

/**
 * A lane's name, renameable in place.
 *
 * A double-click opens it and so does Enter — a rename reachable only by
 * double-click is one most people never find and some cannot perform at all.
 *
 * A BARE `<input>`, NOT `md-text-field`: the field has to fit a 56px lane row
 * and sit exactly where the label was, and a text field carries its own label
 * slot and a 56px minimum, so opening one would push every lane below it down
 * by a row. It is also the only control this build creates at runtime, and a
 * lazily-hydrated custom element created on a press would arrive un-upgraded.
 */
function enhanceLaneNames(root) {
  for (const name of root.querySelectorAll('.lane-name[data-track]')) {
    const text = name.querySelector('.lane-name__text');
    if (!text) continue;

    const open = () => {
      if (name.querySelector('.lane-name__input')) return;
      const original = text.textContent ?? '';
      const field = document.createElement('input');
      field.className = 'lane-name__input';
      field.value = original;
      field.setAttribute('aria-label', name.getAttribute('aria-label') ?? '');

      const close = (commit) => {
        const next = field.value.trim();
        field.remove();
        for (const child of name.children) child.hidden = false;
        if (commit && next !== '' && next !== original) text.textContent = next;
      };

      for (const child of name.children) child.hidden = true;
      name.append(field);
      field.focus();
      field.addEventListener('blur', () => close(true));
      field.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') close(true);
        /* Escape abandons rather than committing a half-typed name, which is
           what a blur would otherwise do. */
        if (event.key === 'Escape') close(false);
      });
    };

    name.addEventListener('dblclick', open);
    name.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') open();
    });
  }
}
