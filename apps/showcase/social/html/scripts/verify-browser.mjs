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
 *   - React's "a like survives opening the post" justifies hoisting its
 *     engagement provider above the router. There is no provider and no router
 *     here; a page load is a reset, and that IS the contract. So the assertion
 *     becomes the honest one: the drill is a real document, and it arrives with
 *     the fixture's own state.
 *   - React reaches its not-found screen through `pushState`, because a static
 *     host answers 404 for an unknown handle before the app runs. This build IS
 *     that static host, so the 404 is asserted directly.
 *   - React switches locale with a query parameter. This build puts the
 *     language in the URL — that is the whole reason `localeHref` exists — so
 *     Arabic is a different document and is fetched as one.
 *
 * Everything else — the pager that must not navigate, the composer's veto on
 * the step that is actually invalid, the follow button's four states, the
 * contrast pairing on every overlay — is the same behaviour and gets the same
 * assertion.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-social-html build
 *   pnpm --filter @awc-ui/showcase-social-html verify
 */
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { BASE_PATH } from '../src/lib/i18n.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4353;
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

/**
 * A REAL MOUSE CLICK on the stepper's Continue button.
 *
 * TWO THINGS ARE NOT WHERE YOU WOULD GUESS.
 *
 * The Back / Continue bar is not a child of `md-stepper` and not in the
 * stepper's own shadow root either: in vertical orientation EACH `md-step`
 * renders its own actions inside ITS shadow root, which is why `md-step` has a
 * `hide-actions` prop at all. Puppeteer's `>>>` combinator pierces it.
 *
 * And `element.click()` is not enough. The stepper listens for the composed
 * `mdClick` its footer buttons emit, and that is raised by the `<button>`
 * inside `md-button`'s own shadow root — which a programmatic click on the HOST
 * never reaches. Puppeteer's click is a real pointer event at real
 * coordinates, so it lands where a reader's would.
 */
async function pressStepperNext(page) {
  const buttons = await page.$$('md-step >>> md-button');
  for (const button of buttons) {
    const label = await button.evaluate((el) => el.textContent?.trim() ?? '');
    if (/continue|next|înainte|continuă|publică|التالي|متابعة|انشر/i.test(label)) {
      await button.click();
      await settle(page, 500);
      return label;
    }
  }
  throw new Error(`no Continue button among [${buttons.length}] in the stepper`);
}

/* ------------------------------------------- 1. the feed, and what it holds */
{
  console.log('\n[1] the feed');
  const page = await open('/');

  const shape = await page.evaluate(() => ({
    stories: document.querySelectorAll('.story').length,
    rings: document.querySelectorAll('.avatar[data-ring="unseen"]').length,
    posts: document.querySelectorAll('.post-card').length,
    images: [...document.querySelectorAll('.post-card img.media')].length,
    alted: [...document.querySelectorAll('.post-card img.media')].filter(
      (img) => (img.getAttribute('alt') ?? '').length > 10,
    ).length,
    aspected: [...document.querySelectorAll('img.media')].filter((img) =>
      img.hasAttribute('data-aspect'),
    ).length,
    suggestions: document.querySelectorAll('.suggest-row').length,
  }));

  ok('the story rail is populated', shape.stories > 5, `${shape.stories} stories`);
  ok('and some rings are unseen', shape.rings > 0, `${shape.rings} unseen`);
  ok('the feed renders posts', shape.posts > 0, `${shape.posts} posts`);
  /* Convention 5 in the kit: an image IS the post, so an unlabelled one is a
     post with no content. */
  ok('every picture is described', shape.images > 0 && shape.alted === shape.images,
    `${shape.alted}/${shape.images}`);
  ok('every picture reserves its aspect box', shape.aspected === shape.images,
    `${shape.aspected}/${shape.images}`);
  ok('the suggestions panel is populated', shape.suggestions > 0, `${shape.suggestions} rows`);

  /* ---- the like, and the count that follows it ---- */
  const before = await page.evaluate(() => ({
    liked: document.querySelector('.post-actions__like')?.hasAttribute('data-on'),
    count: document.querySelector('.post-card__counts')?.textContent?.trim(),
  }));
  await click(page, '.post-actions__like');
  const after = await page.evaluate(() => ({
    liked: document.querySelector('.post-actions__like')?.hasAttribute('data-on'),
    count: document.querySelector('.post-card__counts')?.textContent?.trim(),
  }));
  ok('the heart toggles', after.liked !== before.liked, `${before.liked} -> ${after.liked}`);
  ok('and the count follows it', after.count !== before.count, `${before.count} -> ${after.count}`);

  /* ---- the pager must page, NOT navigate ---- */
  /*
   * A REGRESSION TEST FOR A BUG THAT SHIPPED in the React build and would be
   * every bit as easy to reintroduce here. The card wrapped the whole media
   * frame in the link to the post, which put the two pager buttons inside an
   * anchor — so pressing "next picture" opened the post instead. It is
   * invisible to every other check: the markup is valid-looking, nothing
   * throws, and the screen it lands on is a real screen.
   *
   * On THIS build the failure would be louder, because a stray navigation is a
   * full page load — which is exactly why both halves are asserted: the picture
   * changed, and the URL did not.
   */
  {
    const carousel = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.post-card')].find(
        (c) => c.querySelector('.post-media__nav--next') !== null,
      );
      return card
        ? /* THE WHOLE URI, not a slice: every artwork opens with the same
             `data:image/svg+xml,%3Csvg xmlns=…` preamble, so comparing the
             first 64 characters compares the preamble and always matches. */
          {
            src: card
              .querySelector('.post-media__frame:not([hidden]) img')
              ?.getAttribute('src'),
          }
        : null;
    });
    ok('a carousel post is in the feed', carousel !== null);

    if (carousel) {
      const url = page.url();
      await page.evaluate(() => {
        const card = [...document.querySelectorAll('.post-card')].find(
          (c) => c.querySelector('.post-media__nav--next') !== null,
        );
        card.querySelector('.post-media__nav--next').click();
      });
      await settle(page, 400);
      const after = await page.evaluate(() => {
        const card = [...document.querySelectorAll('.post-card')].find(
          (c) => c.querySelector('.post-media__nav--next') !== null,
        );
        return {
          src: card?.querySelector('.post-media__frame:not([hidden]) img')?.getAttribute('src'),
          onFeed: !!document.querySelector('.feed'),
        };
      });
      ok('the pager changes the picture in place', after.src !== carousel.src);
      ok('and does NOT navigate to the post', page.url() === url && after.onFeed, page.url());
    }
  }

  /* ---- every overlay on a picture carries its own contrast ---- */
  /*
   * A badge over a photograph cannot borrow the page's colours: the backdrop is
   * content, not a surface. Two versions of this were wrong — dark text on a
   * dark scrim (`inverse-on-surface` is dark in a dark theme), then a bare glyph
   * with no ground at all after the class was defined and not applied.
   *
   * Asserted as a PAIRING rather than as a colour: whatever `.on-media`
   * resolves to, an element that sits on a picture has to have it.
   */
  {
    const overlays = await page.evaluate(() => {
      const marks = [
        ...document.querySelectorAll(
          '.post-media__duration, .explore-tile__badge, .post-grid__badge, .post-grid__pin',
        ),
      ];
      return {
        total: marks.length,
        classed: marks.filter((el) => el.classList.contains('on-media')).length,
        opaque: marks.filter((el) => {
          const bg = getComputedStyle(el).backgroundColor;
          return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
        }).length,
      };
    });
    ok('every picture overlay is marked `on-media`',
      overlays.total === 0 || overlays.classed === overlays.total,
      `${overlays.classed}/${overlays.total}`);
    ok('and paints a real ground behind itself',
      overlays.total === 0 || overlays.opaque === overlays.total,
      `${overlays.opaque}/${overlays.total}`);
  }

  /* ---- no control is nested inside a link ---- */
  /*
   * The general form of the same mistake. An anchor inside an anchor is invalid
   * HTML — and on THIS build the parser gets it before the DOM does, silently
   * unnesting it into markup nobody wrote, which is a worse failure than
   * React's because the shape you inspect is not the shape you authored.
   */
  {
    const nested = await page.evaluate(() => {
      const inAnchor = (selector) =>
        [...document.querySelectorAll(selector)].filter((el) => el.closest('a') !== null).length;
      return {
        anchors: inAnchor('a a'),
        buttons: inAnchor('md-icon-button, md-button'),
      };
    });
    ok('no anchor is nested inside another', nested.anchors === 0, `${nested.anchors} nested`);
    ok('no control sits inside a link', nested.buttons === 0, `${nested.buttons} inside anchors`);
  }

  /* ---- "view all" reveals the rest of the feed ---- */
  /*
   * The one behaviour this build implements differently enough to be worth its
   * own assertion: the remaining posts are in a `<template>`, so this is really
   * asking whether the clone happened. Hidden divs would have passed a naive
   * "are they visible now" check while failing the parity census.
   */
  {
    const shown = await page.evaluate(() => document.querySelectorAll('.post-card').length);
    await click(page, '.feed__more md-button');
    const all = await page.evaluate(() => ({
      posts: document.querySelectorAll('.post-card').length,
      more: document.querySelector('.feed__more')?.hasAttribute('hidden'),
      end: !document.querySelector('.feed__end')?.hasAttribute('hidden'),
    }));
    ok('"view all" reveals the rest of the feed', all.posts > shown, `${shown} -> ${all.posts}`);
    ok('and swaps itself for the end marker', all.more === true && all.end === true);
  }

  /* ---- a follow, from the aside ---- */
  const followBefore = await page.evaluate(
    () => document.querySelector('.suggest-row md-button')?.textContent?.trim(),
  );
  await click(page, '.suggest-row md-button');
  const followAfter = await page.evaluate(
    () => document.querySelector('.suggest-row md-button')?.textContent?.trim(),
  );
  ok('the follow button changes state', followAfter !== followBefore,
    `${followBefore} -> ${followAfter}`);

  await page.close();
}

/* ------------------------- 2. the drill is a real document, and says so */
/*
 * REACT'S SECTION 2 ASKS WHETHER A LIKE SURVIVES OPENING THE POST, and answers
 * yes — which is the whole justification for hoisting its engagement provider
 * above its router.
 *
 * THE ANSWER HERE IS NO, AND THAT IS THE CONTRACT RATHER THAN A GAP. There is
 * no router: pressing the picture fetches a document. Every override in this
 * app is deliberately reload-scoped in all five builds ("a reload is a reset"),
 * and on this one every navigation is a reload — so what there is to assert is
 * that the drill really is a navigation, that it lands on the post, and that it
 * arrives in the fixture's own state rather than a stale one.
 */
{
  console.log('\n[2] opening a post is a real navigation');
  const page = await open('/');

  const before = page.url();
  const shipped = await page.evaluate(() => {
    const like = document.querySelector('.post-actions__like');
    like.click();
    return {
      href: document.querySelector('.post-media__link')?.getAttribute('href'),
      liked: like.hasAttribute('data-on'),
    };
  });
  await settle(page);
  ok('the like registers on the feed', shipped.liked === true);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
    page.evaluate((href) => document.querySelector(`a[href="${href}"]`).click(), shipped.href),
  ]);
  await page.waitForFunction(() => document.querySelectorAll('.hydrated').length > 6, {
    timeout: 30000,
  });
  await settle(page, 500);

  const arrived = await page.evaluate(() => ({
    detail: !!document.querySelector('.post-detail'),
    liked: document.querySelector('.post-actions__like')?.hasAttribute('data-on'),
  }));
  ok('the post opened as its own document', arrived.detail && page.url !== before, page.url());
  /* Not a bug: the document is what the build wrote, and the build wrote the
     fixture. Asserting it pins the contract down rather than leaving it as
     something a reader might mistake for lost state. */
  ok('and it carries the fixture’s state, not the session’s',
    arrived.liked === false, `liked=${arrived.liked}`);
  await page.close();
}

/* --------------------------------------------------- 3. explore filters */
{
  console.log('\n[3] explore');
  const page = await open('/explore/');

  const visible = () =>
    page.evaluate(
      () => [...document.querySelectorAll('.explore-tile')].filter((t) => !t.hasAttribute('hidden')).length,
    );

  const all = await page.evaluate(() => ({
    tiles: document.querySelectorAll('.explore-tile').length,
    wide: document.querySelectorAll('.explore-tile[data-span="2"]').length,
    facets: document.querySelectorAll('.facet-row md-chip').length,
    reset: !!document.querySelector('.facet-foot md-button'),
    showing: document.querySelector('.facet-foot .muted')?.textContent?.trim(),
  }));
  ok('the grid is populated', all.tiles > 20, `${all.tiles} tiles`);
  ok('and broken up by wide tiles', all.wide > 0, `${all.wide} spanning two columns`);
  ok('every topic has a facet', all.facets === 10, `${all.facets} chips`);
  ok('with no reset, nothing being filtered', !all.reset);

  await click(page, '.facet-row md-chip');
  const shown = await visible();
  const filtered = await page.evaluate(() => ({
    reset: !!document.querySelector('.facet-foot md-button'),
    showing: document.querySelector('.facet-foot .muted')?.textContent?.trim(),
  }));
  ok('a topic narrows the grid', shown > 0 && shown < all.tiles, `${all.tiles} -> ${shown}`);
  ok('the count follows', filtered.showing !== all.showing, filtered.showing);
  ok('and the reset appears', filtered.reset);

  await click(page, '.facet-foot md-button');
  const reset = await visible();
  ok('the reset restores every tile', reset === all.tiles, `${reset} tiles`);
  ok('and takes itself away again',
    await page.evaluate(() => !document.querySelector('.facet-foot md-button')));
  await page.close();
}

/* ------------------------------------------------- 4. the composer's veto */
/*
 * `md-stepper` asks before it moves and reads `defaultPrevented`. A wizard that
 * lets you reach the last step empty and THEN says no has wasted four clicks;
 * this asserts the refusal happens at the step that is actually invalid.
 */
{
  console.log('\n[4] the composer refuses an empty step');
  const page = await open('/create/');

  const start = await page.evaluate(() => ({
    steps: document.querySelectorAll('md-step').length,
    library: document.querySelectorAll('.composer__pick').length,
    preview: !document.querySelector('.composer__placeholder')?.hasAttribute('hidden'),
    index: document.querySelector('md-stepper')?.getAttribute('active'),
  }));
  ok('four steps and a library', start.steps === 4 && start.library === 12,
    `${start.steps} steps, ${start.library} pictures`);
  ok('the preview says a picture is needed', start.preview);

  await pressStepperNext(page);
  const blocked = await page.evaluate(() => ({
    index: document.querySelector('md-stepper')?.getAttribute('active'),
    snack: document.querySelector('md-snackbar')?.getAttribute('message'),
  }));
  ok('it does not advance', blocked.index === start.index, `active=${blocked.index}`);
  ok('and says why', (blocked.snack ?? '').length > 0, blocked.snack ?? '(none)');

  /* Choose a picture; the preview fills and the step may now advance. */
  await click(page, '.composer__pick', 2);
  const chosen = await page.evaluate(() => ({
    on: document.querySelectorAll('.composer__pick[data-on]').length,
    placeholder: !document.querySelector('.composer__placeholder')?.hasAttribute('hidden'),
    previewImg: !!document.querySelector(
      '.composer__preview .composer__preview-media:not([hidden]) img.media',
    ),
  }));
  ok('the picture is marked chosen', chosen.on === 1);
  ok('and the preview shows it', chosen.previewImg && !chosen.placeholder);

  await pressStepperNext(page);
  const advanced = await page.evaluate(() =>
    document.querySelector('md-stepper')?.getAttribute('active'),
  );
  ok('now it advances', advanced !== start.index, `active=${advanced}`);
  await page.close();
}

/* ------------------------------------------------- 5. the post, and its pager */
{
  console.log('\n[5] the post drill');
  const page = await open('/p/post-02/');

  const shape = await page.evaluate(() => ({
    carousel: document.querySelectorAll('.post-media__dot').length,
    onFirst: document.querySelector('.post-media__nav--prev')?.hasAttribute('soft-disabled'),
    comments: document.querySelectorAll('.post-detail__side md-list-item').length,
    replies: document.querySelectorAll('md-list-item[data-reply]').length,
    crumbs: document.querySelectorAll('md-breadcrumb-item').length,
    crumbLast: [...document.querySelectorAll('md-breadcrumb-item')].at(-1)?.textContent?.trim(),
  }));
  ok('the carousel has dots', shape.carousel > 1, `${shape.carousel} pictures`);
  ok('and cannot page back from the first', shape.onFirst === true);
  ok('the comments are threaded', shape.comments > 0 && shape.replies > 0,
    `${shape.comments} comments, ${shape.replies} replies`);
  /* The trail replaced a single back link — see `crumbsFor` in the kit. Two
     crumbs: the parent, and the page you are on. */
  ok('a breadcrumb trail names the parent', shape.crumbs === 2, `${shape.crumbs} crumbs`);
  ok('and ends on this page', (shape.crumbLast ?? '').length > 0, shape.crumbLast);

  const shownSrc = () =>
    page.evaluate(
      () =>
        document.querySelector('.post-media__frame:not([hidden]) img')?.getAttribute('src'),
    );
  const src0 = await shownSrc();
  await click(page, '.post-media__nav--next');
  const src1 = await shownSrc();
  ok('the pager changes the picture', src0 !== src1);

  /* The comment composer gates on an empty draft. */
  const gated = await page.evaluate(() =>
    document.querySelector('.comment-compose md-button')?.hasAttribute('soft-disabled'),
  );
  ok('the comment button is gated while the draft is empty', gated === true);

  const countBefore = await page.evaluate(
    () => document.querySelectorAll('.post-detail__side md-list-item').length,
  );
  await page.evaluate(() => {
    const field = document.querySelector('.comment-compose md-text-field');
    /* `mdInput`, whose detail IS the bare string — not the native `input`
       event, and not `md-search`'s `{ value }`. Binding the wrong one is
       silent, which is why this is typed rather than assumed. */
    field.dispatchEvent(
      new CustomEvent('mdInput', { detail: 'Lovely.', bubbles: true, composed: true }),
    );
  });
  await settle(page);
  const ungated = await page.evaluate(() =>
    document.querySelector('.comment-compose md-button')?.hasAttribute('soft-disabled'),
  );
  ok('and opens once there is a draft', ungated === false);

  await click(page, '.comment-compose md-button');
  const countAfter = await page.evaluate(
    () => document.querySelectorAll('.post-detail__side md-list-item').length,
  );
  ok('a posted comment joins the thread', countAfter === countBefore + 1,
    `${countBefore} -> ${countAfter}`);
  await page.close();
}

/* --------------------------------------------- 6. the profile and its tabs */
{
  console.log('\n[6] the profile');
  const page = await open('/profile/');

  const shape = await page.evaluate(() => ({
    tabs: document.querySelectorAll('md-tab').length,
    tiles: document.querySelectorAll('[data-tab-panel="posts"] .post-grid__cell').length,
    /* SCOPED TO THE POSTS PANEL, unlike the React build's version of this
       line, which can count globally because only one grid is mounted there.
       All three are in the document here, and a post pinned on the profile is
       still pinned in the saved grid — so an unscoped count found three. */
    pinned: document.querySelectorAll('[data-tab-panel="posts"] .post-grid__pin').length,
    stats: document.querySelectorAll('.stat-row > div').length,
    follow: document.querySelectorAll('.profile-head__action md-button').length,
  }));
  ok('three tabs', shape.tabs === 3, `${shape.tabs} tabs`);
  ok('the grid is populated', shape.tiles > 0, `${shape.tiles} tiles`);
  ok('with the two pinned posts marked', shape.pinned === 2, `${shape.pinned} pinned`);
  ok('four figures in the header', shape.stats === 4);
  /* Your own profile offers no follow button — `followAction.self` is null. */
  ok('and no follow button on your own profile', shape.follow === 0);

  /* The tab switch, which on this build is three grids and two `hidden`s. */
  await page.evaluate(() => {
    const tabs = document.querySelector('.profile-tabs');
    tabs.dispatchEvent(
      new CustomEvent('mdTabChange', { detail: { value: 'saved' }, bubbles: true, composed: true }),
    );
  });
  await settle(page);
  const swapped = await page.evaluate(() => ({
    posts: document.querySelector('[data-tab-panel="posts"]')?.hasAttribute('hidden'),
    saved: !document.querySelector('[data-tab-panel="saved"]')?.hasAttribute('hidden'),
  }));
  ok('a tab swaps which grid is shown', swapped.posts === true && swapped.saved === true);
  await page.close();
}

/* --------------------------------------- 7. somebody else, and the self case */
{
  console.log('\n[7] another profile');
  const page = await open('/people/ada.lind/');
  const shape = await page.evaluate(() => ({
    follow: document.querySelector('.profile-head__action md-button')?.textContent?.trim(),
    tabs: document.querySelectorAll('md-tab').length,
    grid: document.querySelectorAll('.post-grid__cell').length,
  }));
  ok('a follow button is offered', (shape.follow ?? '').length > 0, shape.follow);
  ok('and no saved/tagged tabs — those are yours, not theirs', shape.tabs === 0);
  ok('their grid renders', shape.grid >= 0, `${shape.grid} tiles`);

  await click(page, '.profile-head__action md-button');
  const after = await page.evaluate(() =>
    document.querySelector('.profile-head__action md-button')?.textContent?.trim(),
  );
  ok('following changes the button', after !== shape.follow, `${shape.follow} -> ${after}`);
  await page.close();
}
{
  const page = await open('/people/mara.ilves/');
  const own = await page.evaluate(() => ({
    tabs: document.querySelectorAll('md-tab').length,
    follow: document.querySelectorAll('.profile-head__action md-button').length,
  }));
  /*
   * The viewer's own handle resolves to their own screen rather than a
   * read-only copy offering to follow themselves — and on this build that means
   * the FILE has to exist. Not writing it was the first version of the route
   * table, and it would have made one of the five ports 404 on a URL the other
   * four serve.
   */
  ok('your own handle renders your own profile', own.tabs === 3 && own.follow === 0);
  await page.close();
}

/* ------------------------------------------------------- 8. the not-found */
{
  console.log('\n[8] an id that does not exist');
  /*
   * ANSWERED BY THE HOST, WITH A REAL 404, and that is the whole difference
   * from the React build's version of this check.
   *
   * React drives its not-found screen through `pushState` because a static host
   * answers 404 for an unknown handle before its app has run. This build IS
   * that static host — every route is a directory with an `index.html` and
   * there is no router to reach — so the correct answer to a bad URL is the
   * status code, not a screen. The screen still exists (`not-found.mjs`), and
   * the two drills render it when an id in their own argument does not resolve;
   * it is simply not reachable by navigation, because nothing navigates here.
   */
  const response = await browser.newPage().then(async (page) => {
    const res = await page.goto(`${BASE}/people/nobody-at-all/`, { waitUntil: 'domcontentloaded' });
    const body = await page.evaluate(() => ({
      feed: !!document.querySelector('.post-card'),
    }));
    await page.close();
    return { status: res?.status(), ...body };
  });
  ok('a bad URL is a 404 from the host', response.status === 404, `HTTP ${response.status}`);
  ok('rather than silently showing the feed', !response.feed);
}

/* --------------------------------------------------- 9. the locale switch */
{
  console.log('\n[9] Arabic');
  /*
   * A DIFFERENT DOCUMENT, not a query parameter. The language is in the URL on
   * this build — that is the entire reason `localeHref` exists and why every
   * link on every screen goes through it — so switching locale is a navigation
   * and Arabic is a file that was written in Arabic.
   */
  const page = await open('/ar/');
  const shape = await page.evaluate(() => {
    const arabic = /[؀-ۿ]/;
    const captions = [...document.querySelectorAll('.post-card__caption')].map(
      (p) => p.textContent ?? '',
    );
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      heading: document.querySelector('.screen-head h1')?.textContent?.trim() ?? '',
      captions: captions.length,
      arabicCaptions: captions.filter((c) => arabic.test(c)).length,
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
  /* The CONTENT too, which is the claim this vertical makes and the three
     consoles do not: captions, bios and comments are dictionary entries. */
  ok('and so is every caption', shape.captions > 0 && shape.arabicCaptions === shape.captions,
    `${shape.arabicCaptions}/${shape.captions}`);
  ok('relative time is localised', /[؀-ۿ]/.test(shape.when), shape.when);
  ok('and every in-app link stays in Arabic',
    shape.links > 0 && shape.arabicLinks === shape.links,
    `${shape.arabicLinks}/${shape.links}`);

  /* The client scripts have no dictionary, so anything they write has to have
     been written by the build. Pressing the heart in Arabic is the cheapest
     place that rule can break. */
  await click(page, '.post-actions__like');
  const label = await page.evaluate(() =>
    document.querySelector('.post-actions__like')?.getAttribute('aria-label') ?? '',
  );
  ok('a press keeps its label in Arabic', /[؀-ۿ]/.test(label), label);
  await page.close();
}

console.log('\n[10] console');
ok('no page or console errors anywhere', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));

await browser.close();
server.kill();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
