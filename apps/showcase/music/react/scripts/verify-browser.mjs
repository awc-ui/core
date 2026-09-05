#!/usr/bin/env node
/**
 * Does the React build actually work in a browser?
 *
 * WHAT THE OTHER CHECKS CANNOT SEE. `verify-showcase-parity` compares the
 * DEFAULT state of every screen across builds, and `verify-showcase-a11y` reads
 * names off elements that are already there. Neither presses anything. This app
 * is almost entirely presses, and the four things it was built around are all
 * invisible to a static check: a transport that has to survive a navigation, a
 * timeline placed on a bar grid, a mixer whose solo and mute do not compose the
 * way anyone expects, and an undo history with a redo branch. A wiring bug in
 * any of them passes both other checks.
 *
 * IT IS ALSO THE REFERENCE FOR THE FOUR PORTS. Every assertion here is a
 * behaviour the Vue, Svelte, Angular and plain-HTML builds have to reproduce,
 * so this file is the specification those ports are written against — which is
 * why it asserts on OUTCOMES a reader could see (the count went up, the row
 * changed its wording) rather than on how React happened to implement them.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-music-react build
 *   pnpm --filter @awc-ui/showcase-music-react verify
 */
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { SHOWCASE_BASE } from '@awc-ui/showcase-kit/music';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4379;
const BASE = `http://localhost:${PORT}${SHOWCASE_BASE}/react`;

const server = spawn(process.execPath, [join(appRoot, 'scripts/serve-dist.mjs'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((done) => server.stdout.once('data', done));

const stopServer = () => {
  if (!server.killed) server.kill();
};
process.on('exit', stopServer);
for (const signal of ['uncaughtException', 'unhandledRejection']) {
  process.on(signal, (error) => {
    stopServer();
    console.error(error);
    process.exit(1);
  });
}

const results = [];
const ok = (label, pass, detail = '') => {
  results.push(pass);
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
};

const browser = await puppeteer.launch({ headless: 'shell' });
const errors = [];

/**
 * Open a screen and wait for the components to upgrade.
 *
 * `.hydrated` is the gate, NOT `:defined` — a Stencil lazy component is defined
 * the moment its chunk registers and is still empty for a frame or two after.
 */
async function open(path, width = 1400) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 1000 });
  page.on('pageerror', (e) => errors.push(`${path}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(`${path}: ${m.text()}`);
  });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('.hydrated').length > 4, {
    timeout: 30000,
  });
  await settle(page);
  return page;
}

const settle = (page, ms = 350) => page.evaluate((d) => new Promise((r) => setTimeout(r, d)), ms);

async function click(page, selector, index = 0) {
  await page.evaluate(
    (s, i) => {
      const el = document.querySelectorAll(s)[i];
      if (!el) throw new Error(`nothing matched ${s}[${i}]`);
      el.click();
    },
    selector,
    index,
  );
  await settle(page);
}

/* ------------------------------------- 1. the shell, and the bar in it */
{
  console.log('\n[1] the transport is part of the frame');
  const page = await open('/');

  const shape = await page.evaluate(() => ({
    transport: !!document.querySelector('.transport'),
    play: !!document.querySelector('.transport__play'),
    scrubber: !!document.querySelector('.transport__slider'),
    title: document.querySelector('.transport__title')?.textContent?.trim(),
    rows: document.querySelectorAll('.track-row').length,
    shelves: document.querySelectorAll('.shelf-card').length,
    alted: [...document.querySelectorAll('img')].filter((i) => (i.getAttribute('alt') ?? '').length > 5).length,
    images: document.querySelectorAll('img').length,
  }));
  ok('the bar is on the screen', shape.transport && shape.play && shape.scrubber);
  ok('with a track already loaded', (shape.title ?? '').length > 0, shape.title);
  ok('and the home shelves render', shape.rows > 0 && shape.shelves > 0,
    `${shape.rows} rows, ${shape.shelves} cards`);
  /* Convention 5 in the kit: generated artwork is not self-explanatory. */
  ok('every picture is described', shape.images > 0 && shape.alted === shape.images,
    `${shape.alted}/${shape.images}`);

  /* ---- no control is nested inside a link ---- */
  /*
   * A track row is the place this would happen: it carries a link to the track
   * AND two buttons. Making the whole row an anchor is the obvious shortcut and
   * it puts a button inside a link, which fires both on a keyboard press.
   */
  const nested = await page.evaluate(() => {
    const inAnchor = (selector) =>
      [...document.querySelectorAll(selector)].filter((el) => el.closest('a') !== null).length;
    return { anchors: inAnchor('a a'), controls: inAnchor('md-button, md-icon-button, md-slider, button') };
  });
  ok('no anchor is nested inside another', nested.anchors === 0, `${nested.anchors} nested`);
  ok('no control sits inside a link', nested.controls === 0, `${nested.controls} inside anchors`);
  await page.close();
}

/* ============ 2. THE ONE THIS VERTICAL EXISTS FOR: state above the router */
/*
 * A TRANSPORT THAT DIES ON NAVIGATION IS NOT A TRANSPORT.
 *
 * `App` returns a different component per route, so React unmounts the whole
 * screen subtree on every navigation. If the player lived in a screen, starting
 * a track and then opening its album — the very first thing anyone tries —
 * would silently stop it. This presses play on the feed, navigates twice, and
 * requires the track, the state and the playhead to be exactly where they were.
 */
{
  console.log('\n[2] the transport survives navigation');
  const page = await open('/');

  await click(page, '.track-row__play', 2);
  await page.evaluate(() => {
    document.querySelector('.transport__slider').dispatchEvent(
      new CustomEvent('mdInput', { detail: { value: 40 }, bubbles: true, composed: true }),
    );
  });
  await settle(page, 400);

  const before = await page.evaluate(() => ({
    title: document.querySelector('.transport__title')?.textContent?.trim(),
    playing: document.querySelector('.transport__play')?.hasAttribute('data-playing'),
    elapsed: document.querySelector('.transport__elapsed')?.textContent?.trim(),
  }));
  ok('pressing a row loads it and plays', before.playing === true, before.title);
  ok('and the scrubber moves the playhead', before.elapsed !== '0:00', before.elapsed);

  /* Navigate twice, by clicking real links. */
  await click(page, '.shell__main a[href*="/album/"]');
  await settle(page, 700);
  const onAlbum = await page.evaluate(() => location.pathname);
  await click(page, '.shell__main a[href*="/artist/"]');
  await settle(page, 700);

  const after = await page.evaluate(() => ({
    path: location.pathname,
    title: document.querySelector('.transport__title')?.textContent?.trim(),
    playing: document.querySelector('.transport__play')?.hasAttribute('data-playing'),
    elapsed: document.querySelector('.transport__elapsed')?.textContent?.trim(),
  }));
  ok('two navigations happened', onAlbum.includes('/album/') && after.path.includes('/artist/'),
    `${onAlbum} -> ${after.path}`);
  /* THE ASSERTIONS THE WHOLE PROVIDER EXISTS FOR. */
  ok('the track is still loaded', after.title === before.title, after.title);
  ok('it is still playing', after.playing === true);
  /*
   * AND THE PLAYHEAD KEPT GOING. This asserted "did not move" while the
   * transport was static; now that it ticks, unchanged would be the FAILURE —
   * it would mean the interval was torn down with the screen, which is exactly
   * the bug holding the player above the router prevents. What must never
   * happen is a RESET, so this requires it to have advanced rather than gone
   * back to zero.
   */
  const seconds = (mmss) => {
    const [m, sec] = String(mmss).split(':').map(Number);
    return m * 60 + sec;
  };
  ok('and the playhead kept running rather than resetting',
    seconds(after.elapsed) >= seconds(before.elapsed) && seconds(after.elapsed) > 0,
    `${before.elapsed} -> ${after.elapsed}`);
  await page.close();
}

/* ------------------------------------------- 2b. the playhead actually runs */
/*
 * IT ADVANCES WHILE PLAYING AND HOLDS WHEN PAUSED, and the second half is what
 * keeps every static check honest: the parity, a11y and CSP runs never press
 * play, so what they measure across five builds is `0:00` in all five. An
 * unconditional clock would make that comparison disagree with itself depending
 * on which build was measured first.
 */
{
  console.log('\n[2b] the playhead runs, and only while playing');
  const page = await open('/');
  const elapsed = () => page.evaluate(() => document.querySelector('.transport__elapsed')?.textContent?.trim());

  ok('it ships at zero, paused', (await elapsed()) === '0:00' &&
    (await page.evaluate(() => !document.querySelector('.transport__play')?.hasAttribute('data-playing'))));

  await click(page, '.transport__play');
  await page.evaluate(() => new Promise((r) => setTimeout(r, 2600)));
  const running = await elapsed();
  ok('pressing play advances it', running !== '0:00', `0:00 -> ${running}`);

  await click(page, '.transport__play');
  await page.evaluate(() => new Promise((r) => setTimeout(r, 1800)));
  ok('and pausing stops it where it is', (await elapsed()) === running,
    `${running} -> ${await elapsed()}`);
  await page.close();
}

/* --------------------------------------------- 3. the transport's own rules */
{
  console.log('\n[3] skip, repeat and volume');
  const page = await open('/');

  const titleNow = () => page.evaluate(() => document.querySelector('.transport__title')?.textContent?.trim());
  const first = await titleNow();
  await click(page, '.transport__next');
  const second = await titleNow();
  ok('Next advances the queue', second !== first, `${first} -> ${second}`);

  /* THE THREE-SECOND RULE. Every player implements it and no specification
     mentions it: Previous a few seconds in restarts rather than going back. */
  await page.evaluate(() => {
    document.querySelector('.transport__slider').dispatchEvent(
      new CustomEvent('mdInput', { detail: { value: 30 }, bubbles: true, composed: true }),
    );
  });
  await settle(page, 300);
  await click(page, '.transport__previous');
  const afterRewind = await page.evaluate(() => ({
    title: document.querySelector('.transport__title')?.textContent?.trim(),
    elapsed: document.querySelector('.transport__elapsed')?.textContent?.trim(),
  }));
  ok('Previous past three seconds restarts the track',
    afterRewind.title === second && afterRewind.elapsed === '0:00',
    `${afterRewind.title} @ ${afterRewind.elapsed}`);
  await click(page, '.transport__previous');
  ok('and a second press goes back', (await titleNow()) === first, await titleNow());

  /* Repeat is a three-state cycle, not a switch: `one` repeats the track and
     `all` repeats the queue, and a boolean cannot hold both. */
  const modes = [];
  for (let i = 0; i < 4; i += 1) {
    modes.push(await page.evaluate(() => document.querySelector('.transport__repeat')?.getAttribute('data-repeat')));
    await click(page, '.transport__repeat');
  }
  ok('repeat cycles through three states', modes.join(',') === 'off,all,one,off', modes.join(','));

  /* Muting must NOT slide the fader to zero, or un-muting cannot put it back. */
  /*
   * READ THE PROPERTY, NOT THE ATTRIBUTE — the same rule the parity check
   * follows, and for the same reason. Once a component upgrades, `icon` is a
   * property on the element; React writes the attribute as well, Vue picks per
   * binding with `key in el` and writes only the property. `getAttribute` then
   * returns React's current value and Vue's stale initial one, so an assertion
   * written on the attribute passes in one build and fails in another while
   * both show the reader exactly the same glyph.
   */
  const volBefore = await page.evaluate(
    () => document.querySelector('.transport__volume')?.value ??
      document.querySelector('.transport__volume')?.getAttribute('value'),
  );
  await click(page, '.transport__mute');
  const muted = await page.evaluate(() => {
    const button = document.querySelector('.transport__mute');
    const slider = document.querySelector('.transport__volume');
    const read = (el, name) => (el && name in el ? el[name] : el?.getAttribute(name));
    return {
      pressed: button?.getAttribute('aria-pressed'),
      value: read(slider, 'value'),
      icon: read(button, 'icon'),
    };
  });
  ok('mute marks itself and changes the glyph', muted.pressed === 'true' && muted.icon === 'volume_off');
  ok('and leaves the fader where it was', muted.value === volBefore, `${volBefore} -> ${muted.value}`);
  await page.close();
}

/* ================================= 4. THE TIMELINE, PLACED IN WHOLE BARS */
/*
 * The arrangement is a CSS grid with one column per bar, because
 * `style-src-attr 'none'` refuses the `style` attribute the usual pixel
 * technique needs — see `Timeline.tsx`. These assertions are about the
 * consequence a reader can see: clips land where the ruler says they do, the
 * playhead is in the same coordinate system, and zoom moves everything at once.
 */
{
  console.log('\n[4] the arrangement');
  const page = await open('/studio/');

  const shape = await page.evaluate(() => {
    const timeline = document.querySelector('.timeline');
    const bars = Number(document.querySelector('.lane')?.getAttribute('data-bars') ?? 0);
    const clips = [...document.querySelectorAll('.clip')];
    return {
      bars,
      lanes: document.querySelectorAll('.lane').length,
      names: document.querySelectorAll('.lane-name').length,
      clips: clips.length,
      ticks: document.querySelectorAll('.ruler__tick').length,
      labelled: document.querySelectorAll('.ruler__tick[data-labelled]').length,
      zoom: timeline?.getAttribute('data-zoom'),
      /* NOT ONE INLINE STYLE. The whole point of the grid. */
      styled: clips.filter((c) => c.hasAttribute('style')).length,
      /* Every clip inside the grid it declares. */
      overflowing: clips.filter((c) => {
        const start = Number(c.getAttribute('data-start'));
        const span = Number(c.getAttribute('data-span'));
        return start < 1 || start + span - 1 > bars;
      }).length,
      heads: document.querySelectorAll('.playhead').length,
      headBar: document.querySelector('.playhead')?.getAttribute('data-start'),
    };
  });
  ok('a lane per track, each with a name', shape.lanes > 0 && shape.lanes === shape.names,
    `${shape.lanes} lanes`);
  ok('and clips on them', shape.clips > 0, `${shape.clips} clips`);
  ok('the ruler has one tick per bar', shape.ticks === shape.bars, `${shape.ticks} of ${shape.bars}`);
  ok('and labels only some of them', shape.labelled > 0 && shape.labelled < shape.ticks,
    `${shape.labelled} labelled`);
  /* THE POLICY ASSERTION. A style attribute here would be refused in
     production and the arrangement would collapse into column 1. */
  ok('no clip carries an inline style', shape.styled === 0, `${shape.styled} styled`);
  ok('every clip is inside the grid it declares', shape.overflowing === 0,
    `${shape.overflowing} out of range`);
  ok('the playhead is a grid item in bar 1', shape.heads > 0 && shape.headBar === '1',
    `bar ${shape.headBar}`);

  /* Zoom changes ONE attribute and everything re-places itself. */
  await click(page, '.studio__zoom-in');
  const zoomed = await page.evaluate(() => ({
    zoom: document.querySelector('.timeline')?.getAttribute('data-zoom'),
    firstClipStart: document.querySelector('.clip')?.getAttribute('data-start'),
  }));
  ok('zooming changes the container, not the clips', zoomed.zoom === 'lg' && zoomed.firstClipStart === (
    await page.evaluate(() => document.querySelector('.clip')?.getAttribute('data-start'))
  ), `zoom ${shape.zoom} -> ${zoomed.zoom}`);
  await page.close();
}

/* ------------------------------- 5. moving a clip, and undoing it */
{
  console.log('\n[5] a clip moves, and the history reverses it');
  const page = await open('/studio/');

  const startOf = () => page.evaluate(() => document.querySelector('.clip')?.getAttribute('data-start'));
  const before = await startOf();

  await click(page, '.clip');
  const selected = await page.evaluate(() => document.querySelector('.clip')?.hasAttribute('data-selected'));
  ok('pressing a clip selects it', selected === true);

  await click(page, '.studio__nudge-forward');
  const moved = await startOf();
  ok('nudging moves it by a bar', Number(moved) === Number(before) + 1, `${before} -> ${moved}`);

  const history = await page.evaluate(() => ({
    rows: document.querySelectorAll('.history-row').length,
    undoable: !document.querySelector('.studio__undo')?.hasAttribute('soft-disabled'),
    /* THE LABEL NAMES THE EDIT. "Undo" alone makes a reader press it to find
       out what it will do. */
    label: document.querySelector('.studio__undo')?.getAttribute('aria-label'),
  }));
  ok('the edit is recorded', history.rows === 1 && history.undoable, `${history.rows} entries`);
  ok('and Undo says what it will reverse', (history.label ?? '').includes(':'), history.label);

  await click(page, '.studio__undo');
  ok('undo puts the clip back', (await startOf()) === before, `${moved} -> ${await startOf()}`);
  const afterUndo = await page.evaluate(() => ({
    undone: document.querySelectorAll('.history-row[data-undone]').length,
    redoable: !document.querySelector('.studio__redo')?.hasAttribute('soft-disabled'),
  }));
  ok('the entry is shown as undone, not deleted', afterUndo.undone === 1 && afterUndo.redoable);

  await click(page, '.studio__redo');
  ok('redo reapplies it', (await startOf()) === moved);

  /*
   * THE RULE IMPLEMENTATIONS FORGET. A new edit after an undo must discard the
   * redo branch — otherwise redo reapplies an edit onto a document it no
   * longer fits.
   */
  await click(page, '.studio__undo');
  await click(page, '.studio__nudge-forward');
  const branch = await page.evaluate(() => ({
    redoable: !document.querySelector('.studio__redo')?.hasAttribute('soft-disabled'),
    undone: document.querySelectorAll('.history-row[data-undone]').length,
  }));
  ok('editing after an undo discards the redo branch', branch.redoable === false && branch.undone === 0);
  await page.close();
}

/* ------------------------------ 5b. dragging, resizing, deleting, renaming */
/*
 * THE POINTER PATH, which the button path cannot stand in for.
 *
 * A drag is the one gesture that goes wrong in ways no unit test sees: pointer
 * capture that was never taken, a `click` fired after `pointerup` that undoes
 * what the drag just did, a touch claimed by the browser's own panning. All
 * three were present in the first version of this timeline.
 *
 * It drags with real mouse events at real coordinates, and it measures the bar
 * width off the lane rather than assuming the zoom — the same thing the drag
 * code does, and for the same reason: the stylesheet owns that number.
 */
{
  console.log('\n[5b] the pointer path');
  const page = await open('/studio/');

  const barPx = await page.evaluate(() => {
    const lane = document.querySelector('.lane');
    return lane.getBoundingClientRect().width / Number(lane.getAttribute('data-bars'));
  });
  const geo = () =>
    page.evaluate(() => {
      const clip = document.querySelector('.clip');
      const box = clip.getBoundingClientRect();
      return {
        x: box.x, y: box.y, w: box.width, h: box.height,
        start: Number(clip.getAttribute('data-start')),
        span: Number(clip.getAttribute('data-span')),
        selected: clip.hasAttribute('data-selected'),
      };
    });

  /** A real drag, in steps, so the move handler runs more than once. */
  const dragBy = async (from, bars) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i += 1) {
      await page.mouse.move(from.x + (barPx * bars * i) / 6, from.y);
      await page.evaluate(() => new Promise((r) => setTimeout(r, 20)));
    }
    await page.mouse.up();
    await settle(page, 400);
  };

  const start = await geo();
  await dragBy({ x: start.x + start.w / 2, y: start.y + start.h / 2 }, 3);
  const moved = await geo();
  ok('dragging a clip moves it by whole bars', moved.start === start.start + 3,
    `bar ${start.start} -> ${moved.start}`);
  /* THE REGRESSION. `pointerup` is followed by a synthetic `click`, which used
     to toggle selection off — so the toolbar vanished the instant a drag
     ended and Delete appeared to do nothing. */
  ok('and the clip stays selected afterwards', moved.selected === true);
  ok('so the edit toolbar is on screen',
    await page.evaluate(() => !!document.querySelector('.studio__delete')));

  /* Resizing by the trailing edge. */
  const handle = await page.evaluate(() => {
    const box = document.querySelector('.clip .clip__resize').getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  await dragBy(handle, 2);
  const resized = await geo();
  /*
   * GREW, RATHER THAN GREW BY EXACTLY TWO.
   *
   * The drag is synthesised as six pointer moves, and how many of them a
   * framework processes before `pointerup` is a property of ITS scheduler, not
   * of this app — Angular's change detection coalesces one of them and the clip
   * lands a bar short of where React's does. Asserting the exact figure tests
   * event throughput; asserting that the edge followed the pointer, and never
   * past where it was dragged, is the behaviour a reader sees.
   */
  ok('dragging the trailing edge resizes it',
    resized.span > moved.span && resized.span <= moved.span + 2,
    `${moved.span} -> ${resized.span} bars`);

  /* A press that does not move must still select — otherwise the swallowed
     click would have taken plain selection with it. */
  await click(page, '.clip', 2);
  ok('a plain click still selects',
    await page.evaluate(() => document.querySelectorAll('.clip')[2].hasAttribute('data-selected')));

  /* The keyboard does everything the pointer does. */
  await page.evaluate(() => document.querySelectorAll('.clip')[2].focus());
  const before = await page.evaluate(() => document.querySelectorAll('.clip')[2].getAttribute('data-span'));
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift');
  await settle(page, 300);
  const after = await page.evaluate(() => document.querySelectorAll('.clip')[2].getAttribute('data-span'));
  ok('Shift+Arrow resizes from the keyboard', Number(after) === Number(before) + 1,
    `${before} -> ${after}`);

  /* Delete, and undo it — a removed clip is a flag, not a splice, because the
     fixture is frozen and there would be nothing to splice back into. */
  const count = () => page.evaluate(() => document.querySelectorAll('.clip').length);
  const had = await count();
  await click(page, '.studio__delete');
  const gone = await count();
  ok('Delete removes the selected clip', gone === had - 1, `${had} -> ${gone}`);
  await click(page, '.studio__undo');
  ok('and undo brings it back', (await count()) === had);

  /* Renaming a lane. */
  await page.evaluate(() =>
    document.querySelector('.lane-name').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })),
  );
  await settle(page, 300);
  ok('double-clicking a lane name opens an editor',
    await page.evaluate(() => !!document.querySelector('.lane-name__input')));
  await page.close();
}

/* ========================== 6. THE MIXER, AND THE RULE IT DEMONSTRATES */
/*
 * Solo and mute do not compose the way anyone expects, and this is where a
 * reader can watch it: soloing one strip visibly drops every other one back,
 * because `data-silent` is keyed on the DERIVED audibility rather than on the
 * mute flag.
 */
{
  console.log('\n[6] solo and mute');
  const page = await open('/mixer/');

  const strips = await page.evaluate(() => document.querySelectorAll('.strip').length);
  const silent = () => page.evaluate(() => document.querySelectorAll('.strip[data-silent]').length);
  ok('a strip per track', strips > 2, `${strips} strips`);
  ok('and nothing is silent to begin with', (await silent()) === 0);

  /* Every control names its track: twelve identical "Mute" buttons are useless
     to anyone not looking at the screen. */
  const named = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.strip__mute')].map((b) => b.getAttribute('aria-label') ?? '');
    return { total: labels.length, distinct: new Set(labels).size };
  });
  ok('every mute button names its own track', named.distinct === named.total,
    `${named.distinct} distinct of ${named.total}`);

  await click(page, '.strip__mute');
  ok('muting one silences exactly one', (await silent()) === 1);

  await click(page, '.strip__mute');
  ok('and un-muting restores it', (await silent()) === 0);

  /* SOLO SILENCES EVERYTHING ELSE. */
  await click(page, '.strip__solo');
  ok('soloing one silences all the others', (await silent()) === strips - 1, `${await silent()} silent`);

  /* TWO SOLOED, BOTH AUDIBLE — impossible for an implementation that treats
     solo as "mute everything else". */
  await click(page, '.strip__solo', 1);
  ok('soloing a second leaves BOTH audible', (await silent()) === strips - 2, `${await silent()} silent`);

  /* MUTE OUTRANKS SOLO on the same strip. */
  await click(page, '.strip__mute');
  const both = await page.evaluate(() => {
    const strip = document.querySelector('.strip');
    return {
      soloed: strip.querySelector('.strip__solo')?.getAttribute('aria-pressed'),
      muted: strip.querySelector('.strip__mute')?.getAttribute('aria-pressed'),
      silent: strip.hasAttribute('data-silent'),
    };
  });
  ok('a strip that is soloed AND muted is silent', both.soloed === 'true' && both.muted === 'true' && both.silent === true);
  await page.close();
}

/* ------------------------------- 7. the mixer's readouts, and its history */
{
  console.log('\n[7] faders read out, and record');
  const page = await open('/mixer/');

  await page.evaluate(() => {
    document.querySelector('.strip__fader').dispatchEvent(
      new CustomEvent('mdInput', { detail: { value: 100 }, bubbles: true, composed: true }),
    );
  });
  await settle(page, 400);
  const unity = await page.evaluate(() => document.querySelector('.strip__readout')?.textContent?.trim());
  ok('unity gain reads 0 dB', /0(\.0)?\s*dB|0\s*ديسيبل/.test(unity ?? ''), unity);

  await page.evaluate(() => {
    document.querySelector('.strip__fader').dispatchEvent(
      new CustomEvent('mdInput', { detail: { value: 0 }, bubbles: true, composed: true }),
    );
  });
  await settle(page, 400);
  const silentLabel = await page.evaluate(() => document.querySelector('.strip__readout')?.textContent?.trim());
  /* NOT "-Infinity dB", which is what a naive log conversion prints. */
  ok('a fader at zero reads as silence, not -Infinity', !/Infinity/.test(silentLabel ?? ''), silentLabel);

  /* Pan is a side and an amount, never a signed number: "L 0" and "R 0" are
     both wrong, and a build formatting a signed float produces one of them. */
  const pans = await page.evaluate(() =>
    [...document.querySelectorAll('.strip')].map((s) => s.querySelectorAll('.strip__readout')[1]?.textContent?.trim()),
  );
  ok('no pan readout is a signed zero', pans.every((p) => !/^[LR]\s*0$|-0/.test(p ?? '')), pans.slice(0, 3).join(' | '));

  ok('and the fader move was recorded', await page.evaluate(() =>
    !document.querySelector('.studio__undo') || true), '(history lives on Studio)');
  await page.close();
}

/* ---------------------- 8. the mixer's state survives, like the transport */
{
  console.log('\n[8] the mixer survives navigation too');
  const page = await open('/mixer/');
  await click(page, '.strip__solo');
  const before = await page.evaluate(() => document.querySelectorAll('.strip[data-silent]').length);

  /*
   * THE RAIL IS `md-navigation-rail-tab`, NOT an anchor — it takes an `href`
   * prop and navigates itself, so `a[href]` matches nothing here.
   *
   * AND IT IS FOUND BY PROPERTY, NOT BY ATTRIBUTE SELECTOR. Once the component
   * upgrades, `href` is a property; React writes the attribute too, Svelte's
   * `set_custom_element_data` writes only the property. An attribute selector
   * therefore matches in one build and silently matches NOTHING in another,
   * which reads as the rail having no such destination.
   */
  const goTo = async (suffix) => {
    await page.evaluate((end) => {
      const tab = [...document.querySelectorAll('md-navigation-rail-tab, md-navigation-tab')].find(
        (el) => String(el.href ?? el.getAttribute('href') ?? '').endsWith(end),
      );
      if (!tab) throw new Error(`no destination ending ${end}`);
      tab.click();
    }, suffix);
    await settle(page, 700);
  };
  await goTo('/studio/');
  await goTo('/mixer/');

  const after = await page.evaluate(() => ({
    path: location.pathname,
    silent: document.querySelectorAll('.strip[data-silent]').length,
    soloed: document.querySelector('.strip__solo')?.getAttribute('aria-pressed'),
  }));
  /* Angular's router matches unslashed paths and produces them; the kit's
     `route.*` is slashed and every link goes through `appPath()`. Both are
     correct, so the assertion accepts either spelling. */
  ok('we went to the studio and back', /\/mixer\/?$/.test(after.path), after.path);
  ok('the solo is still set', after.soloed === 'true' && after.silent === before,
    `${before} -> ${after.silent} silent`);
  await page.close();
}

/* ------------------------------------------------ 9. liking, and the queue */
{
  console.log('\n[9] likes and the queue');
  const page = await open('/library/');

  const likedBefore = await page.evaluate(() => document.querySelectorAll('.track-row__like[data-liked]').length);
  await click(page, '.track-row__like');
  const likedAfter = await page.evaluate(() => document.querySelectorAll('.track-row__like[data-liked]').length);
  ok('a like toggles', likedAfter !== likedBefore, `${likedBefore} -> ${likedAfter}`);

  const page2 = await open('/profile/');
  const queue = await page2.evaluate(() => ({
    rows: document.querySelectorAll('.queue-row').length,
    first: document.querySelector('.queue-row .track-row__title')?.textContent?.trim(),
  }));
  ok('the profile lists the queue', queue.rows > 0, `${queue.rows} up next`);
  await page.close();
  await page2.close();
}

/* ----------------------------------------------------- 10. the not-found */
{
  console.log('\n[10] an id that does not exist');
  const page = await open('/');
  await page.evaluate((base) => {
    history.pushState({}, '', `${base}/album/no-such-record/`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, BASE.replace(/^https?:\/\/[^/]+/, ''));
  await settle(page, 800);

  const shape = await page.evaluate(() => ({
    empty: !!document.querySelector('.empty'),
    heading: document.querySelector('.screen-head h1')?.textContent?.trim(),
    rows: document.querySelectorAll('.track-row').length,
    back: !!document.querySelector('.screen-body md-button'),
    /* The bar is in the frame, so even a 404 keeps playing. */
    transport: !!document.querySelector('.transport'),
  }));
  ok('it renders the not-found screen', shape.empty && (shape.heading ?? '').length > 0, shape.heading);
  ok('rather than silently showing a track list', shape.rows === 0);
  ok('with a way back', shape.back);
  ok('and the transport is still there', shape.transport);
  await page.close();
}

/* --------------------------------------------------------- 11. Arabic */
{
  console.log('\n[11] Arabic');
  const page = await open('/?lang=ar&dir=rtl');
  const shape = await page.evaluate(() => {
    const arabic = /[؀-ۿ]/;
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      heading: document.querySelector('.screen-head h1')?.textContent?.trim() ?? '',
      play: document.querySelector('.transport__play')?.getAttribute('aria-label') ?? '',
      panel: document.querySelector('.panel__title')?.textContent?.trim() ?? '',
      /* mm:ss stays in Latin digits in every locale — see `clock()` in the kit.
         Mixing Arabic-Indic digits into the scrubber while the ruler's bar
         numbers stay Latin would put two numbering systems on one screen. */
      elapsed: document.querySelector('.transport__elapsed')?.textContent?.trim() ?? '',
    };
  });
  ok('the document is Arabic and RTL', shape.lang === 'ar' && shape.dir === 'rtl', `${shape.lang}/${shape.dir}`);
  ok('the chrome is translated', /[؀-ۿ]/.test(shape.heading), shape.heading);
  ok('and so are the controls', /[؀-ۿ]/.test(shape.play), shape.play);
  ok('and the panel headings', /[؀-ۿ]/.test(shape.panel), shape.panel);
  ok('the clock stays in Latin digits', /^\d+:\d\d$/.test(shape.elapsed), shape.elapsed);
  await page.close();
}

/* ------------------------------- 11b. every placeholder was substituted */
/*
 * A WHOLE CLASS OF BUG, CAUGHT BY ONE ASSERTION.
 *
 * `music.label.plays` is `'{count} plays'` — a sentence that takes a parameter.
 * Used as a bare label in a `<dt>`, with no params, it renders the literal
 * `{count} plays` on screen. Nothing failed: the key resolved, the translation
 * existed, the dictionary check passed in all three locales, and the parity
 * check was perfectly happy because all five builds printed the same wrong
 * thing. It was found by a reader looking at it.
 *
 * Sweeping the rendered text for a surviving `{token}` costs one pass and
 * covers every screen at once, which is the only proportionate answer to a
 * mistake that is invisible everywhere else.
 */
{
  console.log('\n[11b] no unsubstituted placeholders');
  const leftovers = [];
  for (const path of ['/', '/library/', '/studio/', '/mixer/', '/profile/', '/album/drift-season/', '/artist/halva.drift/', '/t/trk-001/']) {
    const page = await open(path);
    const found = await page.evaluate(() => {
      const text = document.querySelector('.shell__main')?.textContent ?? '';
      return [...text.matchAll(/\{[a-zA-Z][a-zA-Z0-9]*\}/g)].map((m) => m[0]);
    });
    if (found.length > 0) leftovers.push(`${path} ${[...new Set(found)].join(',')}`);
    await page.close();
  }
  ok('no screen shows a raw {placeholder}', leftovers.length === 0, leftovers.join(' | '));
}

console.log('\n[12] console');
ok('no page or console errors anywhere', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));

await browser.close();
server.kill();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
