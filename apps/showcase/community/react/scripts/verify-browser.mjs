#!/usr/bin/env node
/**
 * Does the React build actually work in a browser?
 *
 * WHAT THE OTHER CHECKS CANNOT SEE. `verify-showcase-parity` compares the
 * DEFAULT state of every screen across builds, and `verify-showcase-a11y` reads
 * names off elements that are already there. Neither presses anything. This app
 * is almost entirely presses — six reactions with a switch case, a thread that
 * collapses, a friend request with two outcomes, a private group that asks
 * rather than joins, three RSVP states — and a wiring bug in any of those
 * passes both other checks.
 *
 * IT IS ALSO THE REFERENCE FOR THE FOUR PORTS. Every assertion here is a
 * behaviour the Vue, Svelte, Angular and plain-HTML builds have to reproduce,
 * so this file is the specification those ports are written against — which is
 * why it asserts on OUTCOMES a reader could see (the count went up, the row
 * changed its wording) rather than on how React happened to implement them.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-community-react build
 *   pnpm --filter @awc-ui/showcase-community-react verify
 */
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { SHOWCASE_BASE } from '@awc-ui/showcase-kit/community';

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

  /* ---- the right rail goes at 1200, the whole shell swaps at 900 ---- */
  await page.setViewport({ width: 1100, height: 1000 });
  await settle(page, 400);
  const narrow = await page.evaluate(() => ({
    railVisible: !!document.querySelector('.columns__rail')?.checkVisibility?.(),
    feed: !!document.querySelector('.columns__main'),
  }));
  ok('the right rail is dropped below 1200px', narrow.railVisible === false && narrow.feed);
  await page.setViewport({ width: 1400, height: 1000 });
  await settle(page, 300);

  /* ---- no control is nested inside a link ---- */
  /*
   * An anchor inside an anchor is invalid HTML that the DOM API builds without
   * complaint, and a button inside one fires both on a keyboard press. This
   * vertical has three places it could happen that Lyra does not: the group
   * byline beside the author link, the link-preview card, and a shared post
   * inside a post — which is why all three are deliberately NOT anchors.
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

  /* Pick `love` on the first post. */
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

  /* And taking it back returns the total to where it started. */
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

/* ------------------------------------------- 3. reactions survive a drill */
{
  console.log('\n[3] a reaction survives opening the post');
  const page = await open('/');

  const href = await page.evaluate(() => {
    document.querySelector('.post-card .react__option[data-reaction="wow"]').click();
    return document.querySelector('.post-card .when')?.getAttribute('href');
  });
  await settle(page);
  await page.evaluate((h) => document.querySelector(`a[href="${h}"]`).click(), href);
  await page.waitForFunction(() => document.querySelectorAll('.post-card').length === 1, {
    timeout: 15000,
  });
  await settle(page, 600);

  const still = await page.evaluate(() =>
    document.querySelector('.react__option[data-reaction="wow"]')?.hasAttribute('data-on'),
  );
  ok('the post opened by client-side navigation', await page.evaluate(() => !!document.querySelector('.post-card')));
  ok('and the reaction came with it', still === true);
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
    toggles: document.querySelectorAll('.thread__toggle').length,
  }));
  ok('the thread renders', shape.comments > 0, `${shape.comments} comments`);
  ok('and nests two levels', shape.depth1 > 0, `${shape.depth1} replies`);
  /*
   * "Replying to X" AT DEPTH 2 ONLY. At depth 1 the indent is unambiguous —
   * one possible parent, directly above. At depth 2 siblings may sit between,
   * so the name has to say who. A line on every reply would be redundant on
   * most of them.
   */
  ok('and names the parent only where the indent cannot',
    shape.replying === shape.depth2, `${shape.replying} labels for ${shape.depth2} deep replies`);

  if (shape.toggles > 0) {
    const before = await page.evaluate(() => document.querySelectorAll('.comment').length);
    await click(page, '.thread__toggle');
    const after = await page.evaluate(() => document.querySelectorAll('.comment').length);
    ok('a collapsed run of replies expands', after > before, `${before} -> ${after}`);
  } else {
    ok('a collapsed run of replies expands', true, '(no run long enough on this post)');
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
    accept: document.querySelectorAll('.person-row md-button').length,
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
   * A PRIVATE GROUP ASKS RATHER THAN JOINS, which is the whole point of the
   * privacy flag being data. Pressing Join on one has to leave the viewer
   * PENDING, not a member — and the snackbar has to say so.
   */
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
         role chip, which makes "one chip" the precise test — an earlier version
         only excluded member and admin, and kept matching the group that was
         already PENDING, where pressing the button cancels rather than asks. */
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
   * PRESS A CHOICE THAT TURNS ON, not whichever happens to be first.
   *
   * The first event ships as `going`, so pressing Going turned it OFF — and an
   * un-answer deliberately raises NO snackbar (taking an answer back is its own
   * confirmation, the same asymmetry the reaction button has). The test read
   * that correct silence as a failure. Choosing a state the row is not already
   * in exercises the announcing path.
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
 * A REGRESSION TEST FOR A BUG FIFTY-THREE ASSERTIONS MISSED.
 *
 * The composer's text field is rendered CONDITIONALLY, behind an `open` flag,
 * and `useCustomEvent` bound its listener once at mount — when the field did
 * not yet exist. Typing into it therefore did nothing at all: no error, no
 * warning, just a Post button that stayed disabled for ever. Every other field
 * in the app is mounted with its component, so nothing else exercised that
 * path.
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
  }));
  ok('it starts as a trigger, not a form', collapsed.trigger && !collapsed.field);

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
    collapsed: !document.querySelector('.composer__open'),
  }));
  ok('posting says so and collapses', (posted.snack ?? '').length > 0 && posted.collapsed,
    posted.snack ?? '(none)');
  await page.close();
}

/* ------------------------------------------------- 8. text-first, and see more */
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
      links: document.querySelectorAll('.link-card').length,
      shared: document.querySelectorAll('.shared-post').length,
    };
  });
  /* THE INVERSION FROM LYRA: prose leads, and half the feed carries no image at
     all — the case a card built around a picture gets wrong. */
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
  /* Reveal the whole feed so a share is certain to be on screen. */
  await click(page, '.feed__more md-button');
  const shape = await page.evaluate(() => {
    const shared = document.querySelector('.shared-post');
    return {
      exists: !!shared,
      hasByline: !!shared?.querySelector('.post-card__head'),
      /* The inner post must NOT carry its own actions: pressing them would
         react to a post the reader is not looking at. */
      innerActions: shared?.querySelectorAll('.post-actions').length ?? 0,
      notALink: shared?.closest('a') === null,
    };
  });
  ok('a shared post renders inside its outer post', shape.exists);
  ok('with the original author on it', shape.hasByline);
  ok('and no actions of its own', shape.innerActions === 0);
  ok('and it is not wrapped in a link', shape.notALink);
  await page.close();
}

/* ----------------------------------------------------- 10. the not-found */
{
  console.log('\n[10] an id that does not exist');
  const page = await open('/');
  await page.evaluate((base) => {
    history.pushState({}, '', `${base}/g/no-such-group/`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, BASE.replace(/^https?:\/\/[^/]+/, ''));
  await settle(page, 800);

  const shape = await page.evaluate(() => ({
    empty: !!document.querySelector('.empty'),
    heading: document.querySelector('.screen-head h1')?.textContent?.trim(),
    feed: !!document.querySelector('.post-card'),
    back: !!document.querySelector('.screen-body md-button'),
  }));
  ok('it renders the not-found screen', shape.empty && (shape.heading ?? '').length > 0, shape.heading);
  ok('rather than silently showing the feed', !shape.feed);
  ok('with a way back', shape.back);
  await page.close();
}

/* --------------------------------------------------------- 11. Arabic */
{
  console.log('\n[11] Arabic');
  const page = await open('/?lang=ar&dir=rtl');
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
  await page.close();
}

console.log('\n[12] console');
ok('no page or console errors anywhere', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));

await browser.close();
server.kill();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
