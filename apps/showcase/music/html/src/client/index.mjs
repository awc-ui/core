/**
 * Every enhancement, applied once the document is parsed.
 *
 * EVERY PAGE IS COMPLETE AND READABLE BEFORE THIS RUNS. The screens are static
 * markup; these listeners add the presses. The one exception is the transport,
 * which has to restore what the reader was doing out of `sessionStorage` — a
 * static site cannot keep a variable across a page load, so it writes one down.
 */
import { enhanceShell } from './shell.mjs';
import { enhanceTransport, enhanceQueueButtons } from './transport.mjs';
import { enhanceMixer, enhanceLikes, enhanceFollow } from './mixer.mjs';
import { enhanceTimeline } from './timeline.mjs';

enhanceShell();
enhanceTransport();
enhanceQueueButtons();
enhanceLikes();
enhanceFollow();
enhanceMixer();
enhanceTimeline();
