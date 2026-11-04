export async function exerciseSearchQueries(supplied?: HTMLElement) {
  const search = (supplied ?? document.querySelector('md-search')) as HTMLMdSearchElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  await search.componentOnReady();
  search.layout = 'docked'; search.debounce = 80; search.throttle = 160;
  search.innerHTML = '<button slot="leading" aria-label="Choose search category">Category</button><button slot="trailing" aria-label="Search options">Options</button><div slot="results"><button data-search-result>Apple</button><button data-search-result>Pear</button></div>';
  await tick();
  const input = () => search.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const key = async (target: Element, key: string, extras: KeyboardEventInit = {}) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...extras })); await tick();
  };
  const events: Array<{ type: string; detail: any }> = [];
  const record = (event: Event) => events.push({ type: event.type, detail: (event as CustomEvent).detail });
  const names = ['mdInput', 'mdSearch', 'mdSubmit', 'mdClear', 'mdChange', 'mdLeadingIconClick', 'mdTrailingIconClick'];
  names.forEach((name) => search.addEventListener(name, record));
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  };
  try {
    input().focus();
    await key(input(), ' '); await tick(350);
    check(search.open, 'Space in the closed search field must open its view');
    type(' ap'); type(' apple ');
    check(events.filter((entry) => entry.type === 'mdInput').length === 2, 'mdInput must remain immediate');
    check(events.every((entry) => entry.type !== 'mdSearch'), 'mdSearch must wait for debounce');
    await tick(110);
    check(events.filter((entry) => entry.type === 'mdSearch').map((entry) => entry.detail.value).join() === 'apple', 'search must debounce and trim the query');
    type('apple'); await tick(110);
    check(events.filter((entry) => entry.type === 'mdSearch').length === 1, 'whitespace-equivalent queries must not emit duplicate searches');
    type('pear'); await key(input(), 'Enter');
    check(events.slice(-2).map((entry) => entry.type).join() === 'mdSearch,mdSubmit', 'Enter must flush the pending query before submission');
    check(events.at(-1)!.detail.value === 'pear', 'submission must contain the current query');
    const results = Array.from(search.querySelectorAll<HTMLElement>('[data-search-result]'));
    input().focus(); await key(input(), 'ArrowDown'); check(document.activeElement === results[0], 'Down must enter the first result');
    await key(results[0], 'ArrowDown'); check(document.activeElement === results[1], 'Down must advance to the next result');
    await key(results[1], 'ArrowDown'); check(document.activeElement === results[1], 'Down must clamp at the final result');
    await key(results[1], 'ArrowUp'); check(document.activeElement === results[0], 'Up must return to the preceding result');
    await key(results[0], 'ArrowUp'); check(search.shadowRoot!.activeElement === input(), 'Up from the first result must return to the input');
    search.querySelector<HTMLElement>('[slot="leading"]')!.click(); await tick();
    check(search.open && events.some((entry) => entry.type === 'mdLeadingIconClick' && entry.detail.open), `a consumer leading action must emit without dismissing: ${JSON.stringify({ open: search.open, events, assigned: (search.shadowRoot!.querySelector('slot[name="leading"]') as HTMLSlotElement).assignedElements().map((element) => element.outerHTML) })}`);
    search.querySelector<HTMLElement>('[slot="trailing"]')!.click(); await tick();
    check(search.open && events.filter((entry) => entry.type === 'mdTrailingIconClick').length === 1, 'the trailing action must emit once without toggling');
    search.shadowRoot!.querySelector<HTMLElement>('[part="clear-button"]')!.click(); await tick();
    check(search.value === '' && events.some((entry) => entry.type === 'mdClear'), 'clear must reset the query and emit its dedicated event');
    check(events.filter((entry) => entry.type === 'mdTrailingIconClick').length === 1, 'clear must not duplicate a generic trailing event');
    search.loading = true; await tick();
    check(search.shadowRoot!.textContent!.includes(search.loadingLabel), 'loading must be announced');
    search.loading = false; search.querySelector('[slot="results"]')!.remove(); search.value = 'missing'; await tick(350);
    check(search.shadowRoot!.textContent!.includes(search.noResultsLabel), 'a query without rows must expose the empty state');
    search.escapeCloses = false; await key(input(), 'Escape'); check(search.open, 'Escape opt-out must keep the search open');
    search.escapeCloses = true; await key(input(), 'Escape'); await search.whenClosed();
    check(!search.open, 'Escape must close when enabled');
    search.disabled = true; await tick(); search.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!.click();
    check(!search.open, 'disabled search must ignore bar activation');
  } finally {
    names.forEach((name) => search.removeEventListener(name, record));
    search.disabled = false; search.loading = false; await search.close(); await search.whenClosed();
  }
}

/** A deterministic Web Speech platform adapter: real microphone/network recognition
 * cannot be used in CI. Component calls and emitted public transcription events remain real. */
export async function exerciseSearchVoice(supplied?: HTMLElement) {
  const search = (supplied ?? document.querySelector('md-search')) as HTMLMdSearchElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 40));
  const global = window as any;
  const original = Object.getOwnPropertyDescriptor(global, 'SpeechRecognition');
  const sessions: any[] = [];
  class Recognition {
    lang = ''; interimResults = false; continuous = true; maxAlternatives = 0;
    starts = 0; stops = 0; aborts = 0;
    onresult: any; onerror: any; onend: any;
    constructor() { sessions.push(this); }
    start() { this.starts++; }
    stop() { this.stops++; }
    abort() { this.aborts++; }
  }
  Object.defineProperty(global, 'SpeechRecognition', { configurable: true, writable: true, value: Recognition });
  await search.componentOnReady(); search.voiceSearch = true; search.layout = 'docked'; search.setAttribute('lang', 'fr-FR');
  search.debounce = 250; await tick();
  const events: Array<{ type: string; detail: any }> = [];
  const record = (event: Event) => events.push({ type: event.type, detail: (event as CustomEvent).detail });
  ['mdVoice', 'mdSearch'].forEach((name) => search.addEventListener(name, record));
  try {
    await search.startVoice(); await tick();
    check(sessions.length === 1 && sessions[0].starts === 1 && search.open, 'voice must create and start one recognition session and open the view');
    check(sessions[0].lang === 'fr-FR' && sessions[0].interimResults && !sessions[0].continuous && sessions[0].maxAlternatives === 1, 'recognition must use the host language and streaming configuration');
    await search.startVoice(); check(sessions.length === 1, 'a listening session must not be started twice');
    const interim = Object.assign([{ transcript: ' bonjour' }], { isFinal: false });
    sessions[0].onresult({ results: [interim] }); await tick();
    check(search.value === 'bonjour' && events[0].type === 'mdVoice' && !events[0].detail.final, 'interim recognition must update the input with a non-final voice event');
    const final = Object.assign([{ transcript: ' le monde' }], { isFinal: true });
    sessions[0].onresult({ results: [interim, final] }); await tick();
    check(search.value === 'bonjour le monde', 'multiple recognition segments must form one query');
    check(events.some((event) => event.type === 'mdVoice' && event.detail.final) && events.at(-1)!.type === 'mdSearch', 'final recognition must emit voice and immediately flush search');
    check(sessions[0].stops === 1, 'final recognition must stop listening');
    await search.startVoice(); check(sessions[0].aborts === 1 && sessions.length === 2, 'a new session must retire the previous recognizer');
    sessions[1].onerror(); await tick(); await search.startVoice();
    check(sessions.length === 3, 'recognition must recover after a platform error');
    sessions[2].onend(); await tick();
    search.disabled = true; await tick(); await search.startVoice(); check(sessions.length === 3, 'disabled search must not start recognition');
  } finally {
    await search.stopVoice(); search.disabled = false; search.voiceSearch = false;
    ['mdVoice', 'mdSearch'].forEach((name) => search.removeEventListener(name, record));
    await search.close(); await search.whenClosed();
    if (original) Object.defineProperty(global, 'SpeechRecognition', original); else delete global.SpeechRecognition;
  }
}
export async function exerciseSearchExternalTrigger(supplied?: HTMLElement) {
  const search = (supplied ?? document.querySelector('md-search')) as HTMLMdSearchElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const first = document.createElement('button'); first.textContent = 'Search catalogue';
  const second = document.createElement('button'); second.textContent = 'Replacement search opener';
  search.before(first, second);
  await search.componentOnReady(); search.layout = 'full-screen'; search.triggerElement = first;
  search.initialFocus = 'leading'; search.innerHTML = '<span slot="leading" tabindex="-1"><button>Choose category</button></span>';
  await tick();
  const overflow = document.body.style.overflow;
  try {
    first.focus(); first.click(); await tick(350);
    check(search.open && first.getAttribute('aria-expanded') === 'true', 'external trigger must open and expose expanded state');
    check(document.body.style.overflow === 'hidden', 'full-screen search must lock document scrolling');
    check(document.activeElement === search.querySelector('[slot="leading"] button'), 'leading initial focus must resolve a focusable child of a slotted wrapper');
    first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true })); await tick();
    check(search.open, 'the external trigger must not be mistaken for an outside press');
    first.click(); await search.whenClosed();
    check(!search.open && first.getAttribute('aria-expanded') === 'false' && document.body.style.overflow === overflow, 'trigger toggle must close and release the scroll lock');
    search.triggerElement = second; await tick();
    check(!first.hasAttribute('aria-expanded') && second.getAttribute('aria-expanded') === 'false', 'replacing the trigger must transfer its ARIA state');
    first.click(); await tick(); check(!search.open, 'the previous trigger must no longer toggle search');
    search.disabled = true; await tick(); second.click(); await tick(); check(!search.open, 'disabled external activation must be ignored');
    search.disabled = false; search.dismissOnOutsideClick = false; await tick(); second.click(); await tick(350);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await tick(); check(search.open, 'outside-dismiss opt-out must retain full-screen search');
    await search.close(); await search.whenClosed();
    search.dismissOnOutsideClick = true; await search.show(); await tick(350);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await search.whenClosed();
    check(!search.open, 'outside press must dismiss when enabled');
    search.triggerElement = undefined; search.triggerFor = '['; await tick();
    await search.show(); await tick(100); await search.close(); await search.whenClosed();
    check(!search.open && !second.hasAttribute('aria-expanded'), 'invalid selector configuration must release the prior trigger without breaking imperative control');
  } finally {
    search.disabled = false; search.triggerElement = undefined; search.triggerFor = '';
    await search.close(); await search.whenClosed(); first.remove(); second.remove();
  }
}
