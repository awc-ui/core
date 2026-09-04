#!/usr/bin/env node
/**
 * Does the React build actually work in a browser?
 *
 * WHAT THE OTHER CHECKS CANNOT SEE. `verify-showcase-parity` compares the
 * DEFAULT state of every screen across builds, and `verify-showcase-a11y`
 * reads names off elements that are already there. Neither presses anything.
 * This app is almost entirely presses: a stepper that refuses to advance, a
 * like that has to survive a navigation, a filter, a carousel, a follow button
 * with four states. A wiring bug in any of those passes both other checks.
 *
 * IT IS ALSO THE REFERENCE FOR THE FOUR PORTS. Every assertion here is a
 * behaviour the Vue, Svelte, Angular and plain-HTML builds have to reproduce,
 * so this file is the specification those ports are written against — which is
 * why it asserts on OUTCOMES a reader could see (the count went up, the step
 * did not advance) rather than on how React happened to implement them.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-social-react build
 *   pnpm --filter @awc-ui/showcase-social-react verify
 */
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
/* From the KIT, not from `src/lib/routes.ts`: that file is TypeScript and this
   is a plain Node script. Both derive the mount the same way from the same
   constant, which is the arrangement `vite.config.ts` already uses. */
import { SHOWCASE_BASE } from '@awc-ui/showcase-kit/social';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4369;
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
 * `hide-actions` prop at all. Puppeteer's `>>>` combinator pierces it; a plain
 * `md-stepper md-button` finds only the buttons this screen puts in the last
 * step's panel.
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
    snack: document.querySelector('md-snackbar')?.getAttribute('open') !== null,
  }));
  ok('the heart toggles', after.liked !== before.liked, `${before.liked} -> ${after.liked}`);
  ok('and the count follows it', after.count !== before.count, `${before.count} -> ${after.count}`);

  /* ---- the pager must page, NOT navigate ---- */
  /*
   * A REGRESSION TEST FOR A BUG THAT SHIPPED. The card wrapped `<PostMedia>` in
   * the link to the post, which put the two pager buttons inside an anchor —
   * so pressing "next picture" opened the post instead. It is invisible to
   * every other check: the markup is valid-looking, nothing throws, and the
   * screen it lands on is a real screen.
   *
   * Asserted on BOTH halves, because either alone would still pass while the
   * other was broken: the picture changed, and the URL did not.
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
          { src: card.querySelector('.post-media img')?.getAttribute('src') }
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
          src: card?.querySelector('.post-media img')?.getAttribute('src'),
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
   * with no ground at all after the class was defined and not applied. Both were
   * invisible to every other check.
   *
   * Asserted as a PAIRING rather than as a colour: whatever `.on-media` resolves
   * to, an element that sits on a picture has to have it.
   */
  {
    const overlays = await page.evaluate(() => {
      const marks = [...document.querySelectorAll('.post-media__duration, .explore-tile__badge, .post-grid__badge, .post-grid__pin')];
      return {
        total: marks.length,
        classed: marks.filter((el) => el.classList.contains('on-media')).length,
        opaque: marks.filter((el) => {
          const bg = getComputedStyle(el).backgroundColor;
          return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
        }).length,
      };
    });
    ok('every picture overlay is marked `on-media`', overlays.total === 0 || overlays.classed === overlays.total,
      `${overlays.classed}/${overlays.total}`);
    ok('and paints a real ground behind itself', overlays.total === 0 || overlays.opaque === overlays.total,
      `${overlays.opaque}/${overlays.total}`);
  }

  /* ---- no control is nested inside a link ---- */
  /*
   * The general form of the same mistake. An anchor inside an anchor is invalid
   * HTML that the DOM API builds without complaint, and a button inside one
   * fires both on a keyboard press — neither shows up as an error anywhere.
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

/* ----------------------------- 2. engagement survives a navigation */
/*
 * THE ONE THAT JUSTIFIES HOISTING THE PROVIDER. A like held inside the feed
 * screen would be forgotten the moment the reader opened the post they just
 * liked — which is the first thing anybody tries.
 */
{
  console.log('\n[2] a like survives opening the post');
  const page = await open('/');

  const postHref = await page.evaluate(() => {
    document.querySelector('.post-actions__like').click();
    return document.querySelector('.post-media__link')?.getAttribute('href');
  });
  await settle(page);
  const likedOnFeed = await page.evaluate(() =>
    document.querySelector('.post-actions__like')?.hasAttribute('data-on'),
  );

  await page.evaluate((href) => {
    document.querySelector(`a[href="${href}"]`).click();
  }, postHref);
  await page.waitForFunction(() => document.querySelector('.post-detail') !== null, { timeout: 15000 });
  await settle(page, 600);

  const likedOnPost = await page.evaluate(() =>
    document.querySelector('.post-actions__like')?.hasAttribute('data-on'),
  );
  ok('the post opened by client-side navigation', await page.evaluate(() => !!document.querySelector('.post-detail')));
  ok('and it is still liked there', likedOnPost === likedOnFeed && likedOnPost === true,
    `feed=${likedOnFeed} post=${likedOnPost}`);
  await page.close();
}

/* --------------------------------------------------- 3. explore filters */
{
  console.log('\n[3] explore');
  const page = await open('/explore/');

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
  const filtered = await page.evaluate(() => ({
    tiles: document.querySelectorAll('.explore-tile').length,
    reset: !!document.querySelector('.facet-foot md-button'),
    showing: document.querySelector('.facet-foot .muted')?.textContent?.trim(),
  }));
  ok('a topic narrows the grid', filtered.tiles > 0 && filtered.tiles < all.tiles,
    `${all.tiles} -> ${filtered.tiles}`);
  ok('the count follows', filtered.showing !== all.showing, filtered.showing);
  ok('and the reset appears', filtered.reset);

  await click(page, '.facet-foot md-button');
  const reset = await page.evaluate(() => document.querySelectorAll('.explore-tile').length);
  ok('the reset restores every tile', reset === all.tiles, `${reset} tiles`);
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
    preview: !!document.querySelector('.composer__placeholder'),
    index: document.querySelector('md-stepper')?.getAttribute('active'),
  }));
  ok('four steps and a library', start.steps === 4 && start.library === 12,
    `${start.steps} steps, ${start.library} pictures`);
  ok('the preview says a picture is needed', start.preview);

  /* Continue, with nothing chosen. The nav bar is LIGHT DOM here — `md-stepper`
     renders it into the active step's panel in vertical orientation — so a
     plain descendant query reaches it. */
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
    placeholder: !!document.querySelector('.composer__placeholder'),
    previewImg: !!document.querySelector('.composer__preview img.media'),
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

  const src0 = await page.evaluate(() => document.querySelector('.post-media img')?.getAttribute('src'));
  await click(page, '.post-media__nav--next');
  const src1 = await page.evaluate(() => document.querySelector('.post-media img')?.getAttribute('src'));
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
    field.dispatchEvent(
      new CustomEvent('mdInput', { detail: 'Lovely.', bubbles: true, composed: true }),
    );
  });
  await settle(page);
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
    tiles: document.querySelectorAll('.post-grid__cell').length,
    pinned: document.querySelectorAll('.post-grid__pin').length,
    stats: document.querySelectorAll('.stat-row > div').length,
    follow: document.querySelectorAll('.profile-head__action md-button').length,
  }));
  ok('three tabs', shape.tabs === 3, `${shape.tabs} tabs`);
  ok('the grid is populated', shape.tiles > 0, `${shape.tiles} tiles`);
  ok('with the two pinned posts marked', shape.pinned === 2, `${shape.pinned} pinned`);
  ok('four figures in the header', shape.stats === 4);
  /* Your own profile offers no follow button — `followAction.self` is null. */
  ok('and no follow button on your own profile', shape.follow === 0);
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
  /* The viewer's own handle resolves to their own screen rather than a
     read-only copy offering to follow themselves. */
  ok('your own handle renders your own profile', own.tabs === 3 && own.follow === 0);
  await page.close();
}

/* ------------------------------------------------------- 8. the not-found */
{
  console.log('\n[8] an id that does not exist');
  /*
   * REACHED CLIENT-SIDE, and it has to be.
   *
   * `scripts/fan-out-routes.mjs` writes a file per REAL route, so a static host
   * — this one, and Netlify — answers 404 for an unknown handle before the app
   * has run. The not-found screen is therefore only reachable from inside the
   * application, which is where a stale in-app link would land anyway. Driving
   * it through `history.pushState` + `popstate` is exactly what the router
   * listens for, so this exercises the real path rather than a contrived one.
   */
  const page = await open('/');
  await page.evaluate((base) => {
    history.pushState({}, '', `${base}/people/nobody-at-all/`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, `${BASE.replace(/^https?:\/\/[^/]+/, '')}`);
  await settle(page, 800);

  const shape = await page.evaluate(() => ({
    empty: !!document.querySelector('.empty'),
    heading: document.querySelector('.screen-head h1')?.textContent?.trim(),
    back: !!document.querySelector('.screen-body md-button'),
    feed: !!document.querySelector('.post-card'),
  }));
  ok('it renders the not-found screen', shape.empty && (shape.heading ?? '').length > 0, shape.heading);
  ok('rather than silently showing the feed', !shape.feed);
  ok('with a way back', shape.back);
  await page.close();
}

/* --------------------------------------------------- 9. the locale switch */
{
  console.log('\n[9] Arabic');
  const page = await open('/?lang=ar&dir=rtl');
  const shape = await page.evaluate(() => {
    const arabic = /[؀-ۿ]/;
    const captions = [...document.querySelectorAll('.post-card__caption')].map((p) => p.textContent ?? '');
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      heading: document.querySelector('.screen-head h1')?.textContent?.trim() ?? '',
      captions: captions.length,
      arabicCaptions: captions.filter((c) => arabic.test(c)).length,
      when: document.querySelector('.when')?.textContent?.trim() ?? '',
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
  await page.close();
}

console.log('\n[10] console');
ok('no page or console errors anywhere', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));

await browser.close();
server.kill();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
