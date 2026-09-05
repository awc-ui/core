/**
 * Everything this build does in the browser, in one module.
 *
 * Every enhancement improves a page that is already complete and readable: the
 * feed, the threads, the profiles and the whole frame are in the HTML. What
 * arrives here is behaviour.
 *
 * NOT ONE OF THEM FORMATS A NUMBER OR TRANSLATES A WORD. Every string a control
 * can produce was written into the markup at build time in the page's own
 * language; these modules choose between strings they were handed. That is the
 * rule that keeps the Romanian and Arabic pages themselves after the first
 * press, and it is worth checking against on every addition here.
 */

import '@awc-ui/showcase-kit/dock';
import { enhanceShell } from './shell.mjs';
import { enhanceEngagement } from './engagement.mjs';
import { enhanceThread } from './thread.mjs';
import { enhanceBodies } from './body.mjs';
import { enhanceFeed } from './feed.mjs';
import { enhanceComposer } from './composer.mjs';

/** Every binder, over whatever is in the document now. All are idempotent. */
function sweep() {
  enhanceEngagement();
  /* `sweep` is handed to the thread binder so a thread cloned out of its
     template gets its own controls bound — and passing the whole sweep rather
     than one binder is what makes a cloned card work as well as a cloned
     thread. */
  enhanceThread(document, sweep);
  enhanceBodies();
}

// The frame: the rail's expand toggle.
enhanceShell();

// The four things that appear on more than one screen: reactions, friendship,
// group membership and RSVP.
sweep();

// The feed's "view all" — and a re-sweep over the cards it clones in.
enhanceFeed(document, sweep);

// The composer at the top of the feed.
enhanceComposer();
