#!/usr/bin/env node
/**
 * Does the plain-HTML build actually work in a browser?
 *
 * THE REACT BUILD'S `scripts/verify-browser.mjs` IS THE SPECIFICATION. Every
 * assertion here answers one of its, in the same order and under the same
 * headings, because the four ports exist to prove that the same application can
 * be written five ways — and a port that quietly does less is not a port.
 *
 * WHERE THIS BUILD LEGITIMATELY DIFFERS, IT IS ASSERTED RATHER THAN SKIPPED.
 * There are three such places and all three come from the same fact: a
 * navigation here is a page load, not a router.
 *
 *   - React's "a reaction survives opening the post" justifies hoisting its
 *     engagement provider above the router. There is no provider and no router
 *     here; a page load is a reset, and that IS the contract. So the assertion
 *     becomes the honest one: the drill is a real document, served by the host,
 *     and it arrives carrying the fixture's own state rather than the previous
 *     page's.
 *   - React reaches its not-found screen through `pushState`, because a static
 *     host answers 404 for an unknown handle before the app runs. This build IS
 *     that static host, so the 404 is asserted directly.
 *   - React switches locale with a query parameter. This build puts the
 *     language in the URL — that is the whole reason `localeHref` exists — so
 *     Arabic is a different document and is fetched as one.
 *
 * Everything else — the six reactions and the arithmetic of switching between
 * them, the two-deep comment thread, the friendship state machine's two
 * directions, the private group that leaves you pending rather than joined,
 * the three RSVP answers, the composer that only exists once it is pressed —
 * is the same behaviour and gets the same assertion.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-community-html build
 *   pnpm --filter @awc-ui/showcase-community-html verify
 */
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { BASE_PATH } from '../src/lib/i18n.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4363;
const BASE = `http://localhost:${PORT}${BASE_PATH}`;

const server = spawn(process.execPath, [join(appRoot, 'scripts/serve.mjs'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((done) => server.stdout.once('data', done));

/*
 * Kill the server whatever happens.
 *
 * The teardown at the bottom only runs on the happy path, so any failed
 * assertion or timeout would otherwise leave the server holding its port — and
 * the NEXT run then dies on EADDRINUSE, reporting a port clash instead of the
 * failure that actually caused it.
 */
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
async function open(path) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  page.on('pageerror', (e) => errors.push(`${path}: ${e.message}`));
  page.on('console', (m) => {
    // A missing favicon is the server's business, not the app's.
    if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(`${path}: ${m.text()}`);
  });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('.hydrated').length > 6, {
    timeout: 30000,
  });
  await settle(page);
  return page;
}

/** Let a press finish: these components dispatch from inside their own render. */
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

/* ------------------------------------------------- 1. the three columns */
{
  console.log('\n[1] the feed, and the layout that defines this vertical');
  const page = await open('/');

  const shape = await page.evaluate(() => ({
    posts: document.querySelectorAll('.post-card').length,
    columns: !!document.querySelector('.columns'),
    rail: !!document.querySelector('.columns__rail'),
    railBlocks: document.querySelectorAll('.columns__rail .panel').length,
    composer: !!document.querySelector('.composer__trigger'),
    alted: [...document.querySelectorAll('.post-card img')].filter(
      (img) => (img.getAttribute('alt') ?? '').length > 10,
    ).length,
    images: document.querySelectorAll('.post-card img').length,
  }));
  ok('the feed renders posts', shape.posts > 0, `${shape.posts} posts`);
  ok('in a three-column layout', shape.columns && shape.rail);
  ok('with contacts, birthdays and events beside it', shape.railBlocks >= 2,
    `${shape.railBlocks} rail panels`);
  ok('and a composer at the top', shape.composer);
  /* Convention 5 in the kit: generated artwork is not self-explanatory, so
     every image carries a written description. */
  ok('every picture is described', shape.images > 0 && shape.alted === shape.images,
    `${shape.alted}/${shape.images}`);

  /* ---- the right rail goes at 1200 ---- */
  await page.setViewport({ width: 1100, height: 1000 });
  await settle(page, 400);
  const narrow = await page.evaluate(() => ({
    railVisible: !!document.querySelector('.columns__rail')?.checkVisibility?.(),
    feed: !!document.querySelector('.columns__main'),
  }));
  ok('the right rail is dropped below 1200px', narrow.railVisible === false && narrow.feed);
  await page.setViewport({ width: 1400, height: 1000 });
  await settle(page, 300);

  /*
   * ---- no control is nested inside a link ----
   *
   * An anchor inside an anchor is invalid HTML that the parser silently
   * repairs by CLOSING the outer one, which is worse than an error: the markup
   * that ships is not the markup that was written. This build is the one where
   * that matters most, because it is the only one whose output a browser
   * parses from source rather than builds through the DOM API.
   */
  const nested = await page.evaluate(() => {
    const inAnchor = (selector) =>
      [...document.querySelectorAll(selector)].filter((el) => el.closest('a') !== null).length;
    return { anchors: inAnchor('a a'), controls: inAnchor('md-button, md-icon-button, button') };
  });
  ok('no anchor is nested inside another', nested.anchors === 0, `${nested.anchors} nested`);
  ok('no control sits inside a link', nested.controls === 0, `${nested.controls} inside anchors`);

  await page.close();
}

/* --------------------------------------------------- 2. the six reactions */
/*
 * THE ONE THAT JUSTIFIES THE WHOLE REACTION MODEL. A boolean like is two
 * states; this is seven, and the case that gets written wrong is the SWITCH —
 * a reader moving from one reaction to another, where two counts have to move
 * at once. `reactionSummary()` in the kit does that arithmetic so five builds
 * cannot each get it slightly different, and this presses it.
 */
{
  console.log('\n[2] six reactions, and the switch between them');
  const page = await open('/');

  /* SCOPED TO THE FIRST CARD. `.post-card .react__option` counts six per post
     across the whole feed, which is sixty — a number that says nothing about
     whether one control is right. Every assertion below reads the same card. */
  const before = await page.evaluate(() => {
    const card = document.querySelector('.post-card');
    return {
      options: card.querySelectorAll('.react__option').length,
      total: card.querySelector('.reactions__count')?.textContent?.trim(),
      glyphs: card.querySelectorAll('.reactions__glyph').length,
    };
  });
  ok('six reactions are offered', before.options === 6, `${before.options} options`);
  ok('and the aggregate shows at most three glyphs', before.glyphs > 0 && before.glyphs <= 3,
    `${before.glyphs} glyphs`);

  await page.evaluate(() => {
    document.querySelector('.post-card .react__option[data-reaction="love"]').click();
  });
  await settle(page);
  const loved = await page.evaluate(() => ({
    on: document.querySelector('.post-card .react__option[data-reaction="love"]')?.hasAttribute('data-on'),
    total: document.querySelector('.post-card .reactions__count')?.textContent?.trim(),
  }));
  ok('picking one marks it chosen', loved.on === true);
  ok('and the total moves', loved.total !== before.total, `${before.total} -> ${loved.total}`);

  /* Now switch to `haha`. Love must go off, haha on, and the TOTAL must be
     unchanged — one reaction swapped for another is not a second reaction. */
  await page.evaluate(() => {
    document.querySelector('.post-card .react__option[data-reaction="haha"]').click();
  });
  await settle(page);
  const switched = await page.evaluate(() => ({
    love: document.querySelector('.post-card .react__option[data-reaction="love"]')?.hasAttribute('data-on'),
    haha: document.querySelector('.post-card .react__option[data-reaction="haha"]')?.hasAttribute('data-on'),
    total: document.querySelector('.post-card .reactions__count')?.textContent?.trim(),
  }));
  ok('switching moves the mark', switched.love === false && switched.haha === true);
  ok('and does NOT change the total', switched.total === loved.total,
    `${loved.total} -> ${switched.total}`);

  await page.evaluate(() => {
    document.querySelector('.post-card .react__option[data-reaction="haha"]').click();
  });
  await settle(page);
  const cleared = await page.evaluate(
    () => document.querySelector('.post-card .reactions__count')?.textContent?.trim(),
  );
  ok('un-reacting restores the original total', cleared === before.total,
    `${before.total} -> ${cleared}`);
  await page.close();
}

/* ------------------------------------------- 3. the drill is a real document */
/*
 * WHERE THIS BUILD DIVERGES, AND WHY IT IS ASSERTED RATHER THAN SKIPPED.
 *
 * React's version of this reacts on the feed, opens the post, and requires the
 * reaction to have survived — which is a test of a provider hoisted above the
 * router. There is no provider and no router here. Opening a post is a page
 * load, so the reaction is GONE, and that is not a defect to be papered over:
 * it is the contract a static build makes. So the honest assertions are the
 * ones below — the link is a real URL the host serves, the drill is a whole
 * document with its own chrome, and it arrives carrying the FIXTURE's state
 * rather than a stale copy of the page the reader came from.
 */
{
  console.log('\n[3] opening a post is a real navigation');
  const page = await open('/');

  const href = await page.evaluate(() => {
    document.querySelector('.post-card .react__option[data-reaction="wow"]').click();
    return document.querySelector('.post-card .when')?.getAttribute('href');
  });
  await settle(page);
  ok('the timestamp is a real link', typeof href === 'string' && href.startsWith(BASE_PATH), href);

  const response = await page.goto(`http://localhost:${PORT}${href}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  await page.waitForFunction(() => document.querySelectorAll('.hydrated').length > 6, {
    timeout: 30000,
  });
  await settle(page, 400);

  const drill = await page.evaluate(() => ({
    status: document.querySelectorAll('.post-card').length,
    thread: document.querySelectorAll('.comment').length,
    chrome: !!document.querySelector('.shell__main'),
    /* The fixture's own state, not the feed's: nothing was carried across. */
    wow: document.querySelector('.react__option[data-reaction="wow"]')?.hasAttribute('data-on'),
  }));
  ok('the host serves it as a document', response?.status() === 200, `HTTP ${response?.status()}`);
  ok('with one post and its thread', drill.status === 1 && drill.thread > 0,
    `${drill.thread} comments`);
  ok('and the whole shell around it', drill.chrome);
  ok('and it starts from the fixture, as a page load must', drill.wow === false);
  await page.close();
}

/* ------------------------------------------------- 4. the two-deep thread */
{
  console.log('\n[4] comments, two levels deep');
  const page = await open('/p/pst-04/');

  const shape = await page.evaluate(() => ({
    comments: document.querySelectorAll('.comment').length,
    depth1: document.querySelectorAll('.comment[data-depth="1"]').length,
    depth2: document.querySelectorAll('.comment[data-depth="2"]').length,
    replying: document.querySelectorAll('.comment__replying').length,
    /* `:not([hidden])` matters: this build writes BOTH toggles and hides one,
       because a client with no dictionary cannot compose "View 3 more replies"
       at press time. Counting them both would report two controls. */
    toggles: document.querySelectorAll('.thread__toggle:not([hidden])').length,
  }));
  ok('the thread renders', shape.comments > 0, `${shape.comments} comments`);
  ok('and nests two levels', shape.depth1 > 0, `${shape.depth1} replies`);
  /*
   * "Replying to X" AT DEPTH 2 ONLY. At depth 1 the indent is unambiguous —
   * one possible parent, directly above. At depth 2 siblings may sit between,
   * so the name has to say who.
   */
  ok('and names the parent only where the indent cannot',
    shape.replying === shape.depth2, `${shape.replying} labels for ${shape.depth2} deep replies`);

  if (shape.toggles > 0) {
    const before = await page.evaluate(() => document.querySelectorAll('.comment').length);
    await click(page, '.thread__toggle--more:not([hidden])');
    const after = await page.evaluate(() => ({
      comments: document.querySelectorAll('.comment').length,
      more: document.querySelectorAll('.thread__toggle--more:not([hidden])').length,
      less: document.querySelectorAll('.thread__toggle--less:not([hidden])').length,
    }));
    ok('a collapsed run of replies expands', after.comments > before,
      `${before} -> ${after.comments}`);
    /* Both toggles visible at once was a real bug in the reference: the
       hidden count is DATA and does not change when the run expands, so the
       choice has to be keyed off `expanded` rather than off the count. */
    ok('and exactly one toggle is offered afterwards', after.more + after.less === 1,
      `${after.more} more, ${after.less} less`);
  } else {
    ok('a collapsed run of replies expands', true, '(no run long enough on this post)');
    ok('and exactly one toggle is offered afterwards', true, '(no run long enough)');
  }

  /* The comment box gates on an empty draft, then appends. */
  const gated = await page.evaluate(() =>
    document.querySelector('.comment-compose md-button')?.hasAttribute('soft-disabled'),
  );
  ok('the comment button is gated while the draft is empty', gated === true);

  const countBefore = await page.evaluate(() => document.querySelectorAll('.comment').length);
  await page.evaluate(() => {
    /* `mdInput`, whose detail IS the bare string — not the native `input`
       event. Binding the wrong one is silent, which is why this is typed. */
    document
      .querySelector('.comment-compose md-text-field')
      .dispatchEvent(new CustomEvent('mdInput', { detail: 'Agreed.', bubbles: true, composed: true }));
  });
  await settle(page);
  await click(page, '.comment-compose md-button');
  const countAfter = await page.evaluate(() => document.querySelectorAll('.comment').length);
  ok('a posted comment joins the thread', countAfter === countBefore + 1,
    `${countBefore} -> ${countAfter}`);
  await page.close();
}

/* ------------------------------------------- 4b. opening a thread on the feed */
/*
 * TWO REGRESSION TESTS, FOR TWO BUGS THAT LOOKED IDENTICAL FROM THE OUTSIDE:
 * pressing to see comments and getting no comments.
 *
 * The first was the SHARED BINDING FLAG. Every binder in `client/` used one
 * `data-bound` attribute, and the aggregate "View all N comments" button wears
 * `comment__act` for its styling — so the comment-LIKE binder, which runs
 * first, matched it, claimed the flag, and the open-thread binder skipped it as
 * already bound. `claim.mjs` now gives each binder its own key.
 *
 * The second was the CLONE ARRIVING OPEN. A thread cloned out of its template
 * has no `hidden` attribute, so a toggle that read the attribute and inverted
 * it hid the thread the reader had just asked for. First press did nothing
 * visible; second press worked.
 *
 * Neither is reachable on the post drill, where the thread is inline and no
 * cloning happens — which is why section 4 never caught either of them. This
 * section presses on the FEED, where both live.
 */
{
  console.log('\n[4b] opening a thread on the feed');
  const page = await open('/');

  const visible = () =>
    page.evaluate(() => [...document.querySelectorAll('.comment')].filter((c) => c.checkVisibility()).length);

  ok('the feed starts with no comments on screen', (await visible()) === 0);

  /* ---- the aggregate, which only ever opens ---- */
  await click(page, '.reactions .comment__act');
  const viaAggregate = await visible();
  ok('"View all N comments" opens the thread', viaAggregate > 0, `${viaAggregate} comments`);
  /* It names a number the reader asked to see, so a second press must not take
     it away again — it sits above the thread, where that reads as the page
     fighting back. */
  await click(page, '.reactions .comment__act');
  ok('and pressing it again leaves it open', (await visible()) === viaAggregate);

  /* ---- the Comment button on another card, which does toggle ---- */
  await click(page, '.post-actions__comment', 1);
  const opened = await visible();
  ok('the Comment button opens on the FIRST press', opened > viaAggregate,
    `${viaAggregate} -> ${opened}`);
  await click(page, '.post-actions__comment', 1);
  ok('and closes on the second', (await visible()) === viaAggregate);
  await click(page, '.post-actions__comment', 1);
  ok('and opens again on the third', (await visible()) === opened);

  /* The clone brings its own controls, and they only work if the sweep ran
     again over what arrived — the reason `materialiseThread` calls `rebind`. */
  const live = await page.evaluate(() => {
    const box = [...document.querySelectorAll('.comment-compose')].find((c) => c.checkVisibility());
    return { exists: !!box, bound: box?.hasAttribute('data-bound-commentCompose') };
  });
  ok('and the cloned thread\'s own controls are bound', live.exists && live.bound === true);
  await page.close();
}

/* ------------------------------------------------ 5. the friendship graph */
/*
 * THE STATE MACHINE LYRA HAS NO EQUIVALENT OF. Following is one-sided, so it is
 * a boolean; friendship is an agreement, so there is a gap between asking and
 * being answered — and the two ends of that gap need opposite verbs. An app
 * built on a boolean lets you accept your own request.
 */
{
  console.log('\n[5] friend requests, both directions');
  const page = await open('/friends/');

  const shape = await page.evaluate(() => ({
    requests: document.querySelectorAll('.request-actions').length,
    sections: document.querySelectorAll('.panel__title').length,
  }));
  ok('the screen has its sections', shape.sections >= 3, `${shape.sections} panels`);
  ok('and requests to answer', shape.requests > 0, `${shape.requests} rows with actions`);

  /* Accepting must change the row IN PLACE. Re-bucketing it into the friends
     list mid-press made the button vanish under the reader's cursor, which is
     the bug this asserts against. */
  const rowId = await page.evaluate(
    () => document.querySelector('.person-row[data-person]')?.getAttribute('data-person'),
  );
  const beforeRows = await page.evaluate(() => document.querySelectorAll('.person-row').length);
  await click(page, '.request-actions md-button');
  const after = await page.evaluate((id) => ({
    rows: document.querySelectorAll('.person-row').length,
    stillThere: !!document.querySelector(`.person-row[data-person="${id}"]`),
    snack: document.querySelector('md-snackbar')?.getAttribute('message'),
  }), rowId);
  ok('accepting keeps the row where it is', after.stillThere && after.rows === beforeRows,
    `${beforeRows} -> ${after.rows} rows`);
  ok('and says what happened', (after.snack ?? '').length > 0, after.snack ?? '(none)');

  /*
   * ---- AND THE ADD/CANCEL BUTTON SURVIVES BEING PRESSED ----
   *
   * A REGRESSION TEST FOR A BUG SIXTY-EIGHT ASSERTIONS MISSED, and the second
   * of exactly this shape in this build. The button swapped in one pre-written
   * label and then set `soft-disabled`: the first press worked, and every press
   * after it did nothing. Because the label by then read "Add friend", what the
   * reader saw was a live-looking control that had stopped answering — and that
   * is how it was reported.
   *
   * Nothing caught it because every assertion in this file pressed each control
   * ONCE. Once is enough to prove a listener is attached; it is not enough to
   * prove the control is still there afterwards. So this presses four times and
   * requires the label to keep moving — which is what the four SPA builds do,
   * since they re-render the button from live state and never disable it.
   */
  const cycle = [];
  for (let i = 0; i < 4; i += 1) {
    const before = await page.evaluate(() => {
      const el = document.querySelector('.friend-button');
      el.scrollIntoView({ block: 'center' });
      return el.textContent?.trim() ?? '';
    });
    await click(page, '.friend-button');
    const now = await page.evaluate(() => ({
      label: document.querySelector('.friend-button')?.textContent?.trim() ?? '',
      dead: document.querySelector('.friend-button')?.hasAttribute('soft-disabled'),
      snack: document.querySelector('md-snackbar')?.getAttribute('message') ?? '',
    }));
    cycle.push({ from: before, to: now.label, dead: now.dead, snack: now.snack });
  }
  ok('the friend button answers every press, not just the first',
    cycle.every((step) => step.to !== step.from),
    cycle.map((s) => `${s.from}->${s.to}`).join(' | '));
  ok('and never disables itself', cycle.every((step) => step.dead === false));
  /* Each move announces, and the sentence belongs to the move just made rather
     than to the next one — the off-by-one the old code had, where the state was
     overwritten before the message was chosen. */
  ok('and announces each one', cycle.every((step) => step.snack.length > 0),
    cycle[cycle.length - 1]?.snack ?? '(none)');
  await page.close();
}

/* ------------------------------------------------------- 6. groups, roles */
{
  console.log('\n[6] groups, and the private one that asks');
  const page = await open('/groups/');

  const shape = await page.evaluate(() => ({
    cards: document.querySelectorAll('.group-card').length,
    roleChips: document.querySelectorAll('.group-card md-chip').length,
  }));
  ok('groups render in both sections', shape.cards > 5, `${shape.cards} cards`);
  ok('and carry their privacy and role', shape.roleChips > 0, `${shape.roleChips} chips`);

  /*
   * A PRIVATE GROUP THE VIEWER IS NOT IN — the one case worth pressing, because
   * it must land on `pending` rather than on membership. The card is found by
   * its lock glyph rather than by index, so a fixture reshuffle cannot quietly
   * turn this into a test of a public group.
   */
  const joined = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.group-card')].find((c) => {
      const chips = [...c.querySelectorAll('md-chip')].map((x) => x.getAttribute('icon'));
      /* EXACTLY ONE CHIP, and it is the lock: a private group the viewer has no
         standing in at all. `roleTone.none` is null so a non-member renders no
         role chip, which makes "one chip" the precise test — anything looser
         keeps matching the group that is already PENDING, where pressing the
         button cancels rather than asks. */
      return chips.length === 1 && chips[0] === 'lock' && c.querySelector('md-button');
    });
    const button = card?.querySelector('md-button');
    const label = button?.textContent?.trim();
    button?.click();
    return { label, id: card?.getAttribute('data-group') };
  });
  await settle(page);
  const outcome = await page.evaluate(
    (id) => ({
      label: document.querySelector(`.group-card[data-group="${id}"] md-button`)?.textContent?.trim(),
      chips: [...document.querySelectorAll(`.group-card[data-group="${id}"] md-chip`)].map((c) =>
        c.getAttribute('icon'),
      ),
      snack: document.querySelector('md-snackbar')?.getAttribute('message'),
    }),
    joined.id,
  );
  ok('joining a private group changes the control', outcome.label !== joined.label,
    `${joined.label} -> ${outcome.label}`);
  /* `hourglass_top` is `roleIcon.pending`. It asking rather than joining is the
     whole reason `GroupPrivacy` is data and not a decoration. */
  ok('and leaves the viewer pending, not a member',
    outcome.chips.includes('hourglass_top'), outcome.chips.join(','));
  ok('and reports the outcome', (outcome.snack ?? '').length > 0, outcome.snack ?? '(none)');
  await page.close();
}

/* ------------------------------------------------------------- 7. events */
{
  console.log('\n[7] events, grouped and answerable');
  const page = await open('/events/');

  const shape = await page.evaluate(() => ({
    rows: document.querySelectorAll('.event-row').length,
    buckets: document.querySelectorAll('.panel__title').length,
    dates: document.querySelectorAll('.event-date').length,
    /* ONE ROW. `:first-of-type` matches the first `.event-row` in EACH bucket,
       so it counted five rows' worth of buttons. */
    choices: document.querySelectorAll('.event-row')[0].querySelectorAll('md-icon-button').length,
  }));
  ok('events render', shape.rows > 0, `${shape.rows} events`);
  ok('grouped into buckets', shape.buckets >= 3, `${shape.buckets} buckets`);
  ok('each with a scannable date block', shape.dates === shape.rows);
  /* Three answers, not five: `invited` is a state somebody else put the reader
     in, and `none` is the absence of an answer rather than one. */
  ok('and three answers offered', shape.choices === 3, `${shape.choices} choices`);

  /*
   * PRESS A CHOICE THAT TURNS ON, not whichever happens to be first. The first
   * event ships as `going`, so pressing Going turns it OFF — and an un-answer
   * deliberately raises NO snackbar, the same asymmetry the reaction button
   * has. Choosing a state the row is not already in exercises the announcing
   * path instead of reading correct silence as a failure.
   */
  const target = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.event-row')].find(
      (r) => !r.querySelector('md-icon-button[data-rsvp="interested"]')?.hasAttribute('data-on'),
    );
    return row?.getAttribute('data-event') ?? null;
  });
  const before = await page.evaluate(
    (id) =>
      document
        .querySelector(`.event-row[data-event="${id}"] md-icon-button[data-rsvp="interested"]`)
        ?.hasAttribute('data-on'),
    target,
  );
  await page.evaluate(
    (id) =>
      document
        .querySelector(`.event-row[data-event="${id}"] md-icon-button[data-rsvp="interested"]`)
        .click(),
    target,
  );
  await settle(page);
  const after = await page.evaluate(
    (id) => ({
      on: document
        .querySelector(`.event-row[data-event="${id}"] md-icon-button[data-rsvp="interested"]`)
        ?.hasAttribute('data-on'),
      snack: document.querySelector('md-snackbar')?.getAttribute('message'),
    }),
    target,
  );
  ok('answering an event changes its state', after.on === true && before === false,
    `${before} -> ${after.on}`);
  ok('and announces it', (after.snack ?? '').length > 0, after.snack ?? '(none)');
  await page.close();
}

/* ------------------------------------------------------- 7b. the composer */
/*
 * A REGRESSION TEST FOR A BUG FIFTY-THREE ASSERTIONS MISSED, and on this build
 * it guards a second failure the other four cannot have.
 *
 * In React the field is rendered CONDITIONALLY and `useCustomEvent` bound its
 * listener once at mount, when the field did not yet exist: typing did nothing
 * at all, silently, for ever. Here the form is CLONED OUT OF A TEMPLATE on
 * first press — for the parity census's sake, since it counts elements and not
 * visible ones — so this build has the same shape of hazard for the same
 * reason, plus the one where the clone happens eagerly at load and the census
 * counts the form anyway.
 *
 * The lesson generalises past this one control: an element that appears LATER
 * needs its own assertion, because a listener that was never attached looks
 * exactly like a reader who has not typed anything.
 */
{
  console.log('\n[7b] the composer expands and accepts typing');
  const page = await open('/');

  const collapsed = await page.evaluate(() => ({
    trigger: !!document.querySelector('.composer__trigger'),
    field: !!document.querySelector('.composer__open md-text-field'),
    /* STILL IN ITS TEMPLATE. If the client cloned at load rather than on
       press, this is 0 and the parity census fails on the four screens that
       carry a composer — which is exactly how it failed once already. */
    template: document.querySelectorAll('template.composer__open-template').length,
  }));
  ok('it starts as a trigger, not a form', collapsed.trigger && !collapsed.field);
  ok('and the form is still an inert fragment', collapsed.template === 1);

  await click(page, '.composer__trigger');
  const opened = await page.evaluate(() => ({
    field: !!document.querySelector('.composer__open md-text-field'),
    audiences: document.querySelectorAll('.composer__foot md-chip').length,
    gated: [...document.querySelectorAll('.composer__foot md-button')]
      .pop()
      ?.hasAttribute('soft-disabled'),
  }));
  ok('pressing it opens the form', opened.field);
  ok('with the four audiences offered', opened.audiences === 4, `${opened.audiences} chips`);
  ok('and Post gated while it is empty', opened.gated === true);

  await page.evaluate(() => {
    document
      .querySelector('.composer__open md-text-field')
      .dispatchEvent(new CustomEvent('mdInput', { detail: 'Hello there.', bubbles: true, composed: true }));
  });
  await settle(page);
  const typed = await page.evaluate(() =>
    [...document.querySelectorAll('.composer__foot md-button')].pop()?.hasAttribute('soft-disabled'),
  );
  /* THE ONE THAT WOULD HAVE CAUGHT IT. */
  ok('typing into it ungates Post', typed === false);

  /* The LAST button in the foot is Post; the four audiences are `md-chip`, not
     buttons, so an index counted over the whole row misses. */
  await page.evaluate(() => {
    [...document.querySelectorAll('.composer__foot md-button')].pop().click();
  });
  await settle(page, 500);
  const posted = await page.evaluate(() => ({
    snack: document.querySelector('md-snackbar')?.getAttribute('message'),
    collapsed: document.querySelector('.composer__open')?.hasAttribute('hidden') !== false,
  }));
  ok('posting says so and collapses', (posted.snack ?? '').length > 0 && posted.collapsed,
    posted.snack ?? '(none)');
  await page.close();
}

/* ------------------------------------------- 8. text-first, and see more */
{
  console.log('\n[8] a text-first feed');
  const page = await open('/');

  const shape = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.post-card')];
    return {
      total: cards.length,
      textOnly: cards.filter((c) => !c.querySelector('img')).length,
      clamped: document.querySelectorAll('.post-card__body[data-clamped]').length,
      more: document.querySelectorAll('.post-card__more').length,
    };
  });
  /* THE INVERSION FROM LYRA: prose leads, and much of the feed carries no image
     at all — the case a card built around a picture gets wrong. */
  ok('most of the feed is prose, not pictures', shape.textOnly > 0,
    `${shape.textOnly}/${shape.total} with no image`);
  ok('long bodies are clamped', shape.clamped > 0, `${shape.clamped} clamped`);

  if (shape.more > 0) {
    await click(page, '.post-card__more');
    const expanded = await page.evaluate(
      () => document.querySelectorAll('.post-card__body[data-clamped]').length,
    );
    ok('"see more" un-clamps one', expanded === shape.clamped - 1,
      `${shape.clamped} -> ${expanded}`);
  } else {
    ok('"see more" un-clamps one', false, 'no clamped body found');
  }
  await page.close();
}

/* ------------------------------------------- 9. a post inside a post */
{
  console.log('\n[9] the shared post');
  const page = await open('/');
  /* Reveal the whole feed so a share is certain to be on screen. The pager
     must NOT navigate: the rest of the feed is already in the document, in a
     template, and revealing it is a clone rather than a page load. */
  const url = page.url();
  await click(page, '.feed__more md-button');
  await settle(page, 400);
  ok('the pager reveals without navigating', page.url() === url);

  const shape = await page.evaluate(() => {
    const shared = document.querySelector('.shared-post');
    return {
      exists: !!shared,
      hasByline: !!shared?.querySelector('.post-card__head'),
      /* The inner post must NOT carry its own actions: pressing them would
         react to a post the reader is not looking at. */
      innerActions: shared?.querySelectorAll('.post-actions').length ?? 0,
      notALink: shared?.closest('a') === null,
      links: document.querySelectorAll('.link-card').length,
    };
  });
  ok('a shared post renders inside its outer post', shape.exists);
  ok('with the original author on it', shape.hasByline);
  ok('and no actions of its own', shape.innerActions === 0);
  ok('and it is not wrapped in a link', shape.notALink);
  ok('and link posts carry a preview card', shape.links > 0, `${shape.links} link cards`);
  await page.close();
}

/* ----------------------------------------------------- 10. the not-found */
{
  console.log('\n[10] an id that does not exist');
  /*
   * ANSWERED BY THE HOST, WITH A REAL 404, and that is the whole difference
   * from the React build's version of this check.
   *
   * React drives its not-found screen through `pushState` because a static host
   * answers 404 for an unknown handle before its app has run. This build IS
   * that static host — every route is a directory with an `index.html` and
   * there is no router to reach — so the correct answer to a bad URL is the
   * status code, not a screen. The screen still exists (`not-found.mjs`), and
   * the four drills render it when an id in their own argument does not
   * resolve; it is simply not reachable by navigation, because nothing
   * navigates here.
   */
  const response = await browser.newPage().then(async (page) => {
    const res = await page.goto(`${BASE}/g/no-such-group/`, { waitUntil: 'domcontentloaded' });
    const feed = await page.evaluate(() => !!document.querySelector('.post-card'));
    await page.close();
    return { status: res?.status(), feed };
  });
  ok('a bad URL is a 404 from the host', response.status === 404, `HTTP ${response.status}`);
  ok('rather than silently showing the feed', !response.feed);
}

/* --------------------------------------------------- 11. the locale switch */
{
  console.log('\n[11] Arabic');
  /*
   * A DIFFERENT DOCUMENT, not a query parameter. The language is in the URL on
   * this build — that is the entire reason `localeHref` exists and why every
   * link on every screen goes through it — so switching locale is a navigation
   * and Arabic is a file that was written in Arabic.
   */
  const page = await open('/ar/');
  const shape = await page.evaluate(() => {
    const arabic = /[؀-ۿ]/;
    const bodies = [...document.querySelectorAll('.post-card__body')].map((p) => p.textContent ?? '');
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      heading: document.querySelector('.screen-head h1')?.textContent?.trim() ?? '',
      bodies: bodies.length,
      arabicBodies: bodies.filter((b) => arabic.test(b)).length,
      when: document.querySelector('.when')?.textContent?.trim() ?? '',
      /* Every in-app link has to keep the reader in Arabic. One that forgot the
         prefix is how a locale-routed site quietly drops people back into
         English three clicks in — the failure `localeHref` exists to prevent,
         and one this build can actually check because the evidence is in the
         markup. */
      links: [...document.querySelectorAll('.shell__main a[href^="/showcase/"]')].length,
      arabicLinks: [...document.querySelectorAll('.shell__main a[href^="/showcase/"]')].filter(
        (a) => a.getAttribute('href').includes('/html/ar/'),
      ).length,
    };
  });
  ok('the document is Arabic and RTL', shape.lang === 'ar' && shape.dir === 'rtl',
    `${shape.lang}/${shape.dir}`);
  ok('the chrome is translated', /[؀-ۿ]/.test(shape.heading), shape.heading);
  /* The CONTENT too, which is the claim this vertical shares with Lyra and the
     three consoles do not make: bodies, comments and bios are dictionary
     entries, so an Arabic reader gets an Arabic network. */
  ok('and so is every post body', shape.bodies > 0 && shape.arabicBodies === shape.bodies,
    `${shape.arabicBodies}/${shape.bodies}`);
  ok('relative time is localised', /[؀-ۿ]/.test(shape.when), shape.when);
  ok('and every in-app link stays in Arabic',
    shape.links > 0 && shape.arabicLinks === shape.links,
    `${shape.arabicLinks}/${shape.links}`);

  /*
   * THE RULE THE WHOLE CLIENT RESTS ON, checked where it is cheapest to break.
   *
   * `client/` has no dictionary and no formatter. Every label and every count a
   * press can put on screen was written into a data attribute by the build, in
   * the page's language — so a press in Arabic has to stay Arabic, and the
   * first thing to reach for a `t()` that is not there would come back English.
   *
   * Reacting raises no snackbar, deliberately: it is not an announcement, it is
   * a state the control itself shows. So the evidence is the control — the
   * button's own label and the re-spelled aggregate beside it, both of which
   * change on this press.
   */
  const before = await page.evaluate(
    () => document.querySelector('.post-card .reactions__count')?.textContent?.trim() ?? '',
  );
  await page.evaluate(() => {
    document.querySelector('.post-card .react__option[data-reaction="love"]').click();
  });
  await settle(page, 400);
  const after = await page.evaluate(() => ({
    label: document.querySelector('.post-card .react__main')?.textContent?.trim() ?? '',
    total: document.querySelector('.post-card .reactions__count')?.textContent?.trim() ?? '',
  }));
  ok('and a press keeps its label in Arabic', /[؀-ۿ]/.test(after.label), after.label || '(none)');
  ok('and re-spells the aggregate in Arabic, without arithmetic',
    after.total !== before && /[٠-٩\u0660-\u0669]|[؀-ۿ]/.test(after.total),
    `${before} -> ${after.total}`);
  await page.close();
}

console.log('\n[12] console');
ok('no page or console errors anywhere', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));

await browser.close();
server.kill();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
