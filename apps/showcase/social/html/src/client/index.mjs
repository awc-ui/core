/**
 * Everything this build does in the browser, in one module.
 *
 * The dock, the shell behaviours, and one enhancement per interactive screen.
 * Every one of them improves a page that is already complete and readable
 * without it: the feed, the grid, the profile, the thread and the whole frame
 * are in the HTML. What arrives here is behaviour.
 *
 * The dock import is a bare side-effect import: it defines
 * `<awc-showcase-dock>` and stamps the persisted theme, density and accent onto
 * <html>. It deliberately does NOT touch lang/dir — `data-locale-route` on
 * <html> tells it the language is settled by the URL.
 *
 * NONE OF THESE SEVEN SCREENS IS STATIC, which is the difference from the three
 * consoles next door: a social app is made of controls. But four of the
 * enhancements are shared rather than per-screen — the heart and the bookmark
 * appear on two screens, the follow button on three, the pager on three — so
 * they are bound by selector across the whole document and each returns quietly
 * on a page that has none of their elements.
 *
 * NOT ONE OF THEM FORMATS A NUMBER OR TRANSLATES A WORD. Every string a control
 * can produce was written into the markup at build time in the page's own
 * language; these modules choose between strings they were handed. That is the
 * rule that makes the Romanian and Arabic pages stay Romanian and Arabic after
 * the first click, and it is worth checking against on every addition here.
 */

import '@awc-ui/showcase-kit/dock';
import { enhanceShell } from './shell.mjs';
import { enhanceEngagement } from './engagement.mjs';
import { enhancePager } from './pager.mjs';
import { enhanceStoryRail } from './story-rail.mjs';
import { enhanceFeed } from './feed.mjs';
import { enhanceExplore } from './explore.mjs';
import { enhanceProfile } from './profile.mjs';
import { enhanceActivity } from './activity.mjs';
import { enhancePost } from './post.mjs';
import { enhanceCreate } from './create.mjs';

// The frame: the rail's expand toggle and the FAB's target.
enhanceShell();

// The four things that appear on more than one screen: the heart, the
// bookmark, the share, and the follow button in its four states.
enhanceEngagement();

// A post's pictures, wherever a post is drawn with more than one.
enhancePager();

// The feed: the story rail's two chevrons, and "view all".
enhanceStoryRail();
enhanceFeed();

// Explore: the topic chips, the search, the count and the reset.
enhanceExplore();

// The profile's three tabs.
enhanceProfile();

// Activity: mark everything read, and the two badges that go with it.
enhanceActivity();

// The post drill: the comment field and the row it appends.
enhancePost();

// The composer: four steps, a veto on two of them, and the live preview.
enhanceCreate();
