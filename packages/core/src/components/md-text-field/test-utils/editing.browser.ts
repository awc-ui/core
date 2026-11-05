export async function exerciseTextEditing(supplied?: HTMLElement) {
  const field = (supplied ?? document.querySelector('md-text-field')) as HTMLMdTextFieldElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  await field.componentOnReady();
  const input = () => field.shadowRoot!.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea')!;
  const edit = async (value: string, caret = value.length) => {
    input().value = value; input().setSelectionRange(caret, caret);
    input().dispatchEvent(new Event('input', { bubbles: true, composed: true })); await tick();
  };
  const events: Array<{ type: string; detail: any }> = [];
  const record = (event: Event) => events.push({ type: event.type, detail: (event as CustomEvent).detail });
  const names = ['mdInput', 'mdChange', 'mdSearch', 'mdClear']; names.forEach((name) => field.addEventListener(name, record));
  try {
    field.restrict = 'numeric'; field.maxLength = 4; await tick(); await field.setFocus();
    await edit('(12) 345'); check(field.value === '1234' && input().value === '1234', 'restriction must filter before limiting the raw value');
    await edit('1x23', 2); check(field.value === '123' && input().selectionStart === 1, 'filtering before the caret must preserve its logical position');
    input().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    await edit('9漢'); check(field.value === '123', 'active composition must not publish intermediate text');
    input().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); await tick();
    check(field.value === '9' && input().value === '9', 'composition end must run the restriction pipeline once');
    field.restrict = ''; field.maxLength = 4; field.formatOn = 'input';
    field.parser = (text: string) => text.replace(/-/g, '');
    field.formatter = (value: string) => value.replace(/(.{2})(?=.)/g, '$1-');
    await tick(); await edit('12345');
    check(field.value === '1234' && input().value === '12-34', 'live formatting must limit raw content, then add separators');
    await edit('-34', 0); check(field.value === '34' && input().selectionStart === 0, 'deleting the first group must leave the caret at the beginning');
    field.formatOn = 'blur'; field.maxLength = undefined; field.value = '1234'; await tick(); input().blur(); await tick();
    check(input().value === '12-34', 'blur formatting must display formatted text');
    await field.setFocus(); check(input().value === '1234', 'focus must reveal raw text for blur-mode editing');
    await field.select(); check(input().selectionStart === 0 && input().selectionEnd === 4, 'select must target the full native input');
    field.parser = undefined; field.formatter = undefined; field.debounce = 80; field.throttle = 160; await tick(); events.length = 0;
    await edit('one'); await edit('two'); await tick(100);
    check(events.filter((event) => event.type === 'mdInput').length === 2, 'input must be immediate while search is debounced');
    check(events.filter((event) => event.type === 'mdSearch').map((event) => event.detail).join() === 'one,two', 'throttle must publish the leading query and debounce the final query without duplicates');
    field.clearable = 'internal'; await tick();
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true })); await tick();
    check(field.value === '' && events.some((event) => event.type === 'mdClear'), 'Escape must clear and emit the clear event');
    field.value = 'kept'; field.readOnly = true; await tick();
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })); await tick();
    check(field.value === 'kept', 'readonly Escape must preserve the value');
    field.readOnly = false; field.multiline = 'auto-grow'; field.value = 'first\nsecond'; await tick();
    check(input() instanceof HTMLTextAreaElement && input().value === 'first\nsecond', 'switching to multiline must preserve existing lines');
    await edit('first\nsecond\nthird');
    check(Number.parseFloat(input().style.height) >= input().scrollHeight, 'auto-grow must size the textarea to its content');
    input().dispatchEvent(new Event('change', { bubbles: true })); await tick();
    check(events.at(-1)!.type === 'mdChange' && events.at(-1)!.detail === field.value, 'native change must publish the current raw value');
  } finally {
    names.forEach((name) => field.removeEventListener(name, record)); field.readOnly = false;
    field.parser = undefined; field.formatter = undefined;
  }
}
/** Deterministic adapter for the external Web Speech API; the component's
 * button handling, edits, and emitted events still execute in the browser. */
export async function exerciseTextSpeech(supplied?: HTMLElement) {
  const field = (supplied ?? document.querySelector('md-text-field')) as HTMLMdTextFieldElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 40));
  const platform = window as any;
  const descriptor = Object.getOwnPropertyDescriptor(platform, 'SpeechRecognition');
  const sessions: any[] = [];
  class Recognition {
    continuous = true; interimResults = false; lang = ''; starts = 0; stops = 0; aborts = 0;
    onresult: any; onend: any; onerror: any;
    constructor() { sessions.push(this); }
    start() { this.starts++; }
    stop() { this.stops++; }
    abort() { this.aborts++; }
  }
  Object.defineProperty(platform, 'SpeechRecognition', { configurable: true, writable: true, value: Recognition });
  await field.componentOnReady(); field.speechToText = 'internal'; field.speechLang = 'fr-FR'; field.value = 'Note'; await tick();
  const button = () => field.shadowRoot!.querySelector<HTMLElement>('.md-text-field__speech')!;
  const events: Array<{ type: string; detail: any }> = [];
  const record = (event: Event) => events.push({ type: event.type, detail: (event as CustomEvent).detail });
  ['mdSpeechResult', 'mdInput', 'mdChange'].forEach((name) => field.addEventListener(name, record));
  try {
    button().click(); await tick(); const first = sessions[0];
    check(first.starts === 1 && first.lang === 'fr-FR' && first.interimResults && !first.continuous, 'speech must configure and start one recognizer');
    const interim = Object.assign([{ transcript: 'bonjour' }], { isFinal: false });
    first.onresult({ resultIndex: 0, results: [interim] }); await tick();
    check(field.value === 'Note bonjour' && events.at(-1)!.detail.listening, 'interim text must update the field without a committed change');
    check(events.every((event) => event.type !== 'mdChange'), 'interim recognition must not emit a committed edit');
    const final = Object.assign([{ transcript: 'salut' }], { isFinal: true });
    first.onresult({ resultIndex: 0, results: [final] }); await tick();
    button().click(); check(first.stops === 1, 'the listening button must request platform stop');
    first.onend(); await tick();
    check(field.value === 'Note salut' && events.at(-1)!.detail.listening === false, 'ending speech must retain only final text');
    check(events.filter((event) => event.type === 'mdChange').map((event) => event.detail).join() === 'Note salut', 'speech must commit exactly once at session end');
    field.value = 'Prefix '; await tick(); button().click(); await tick();
    sessions[1].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'word' }], { isFinal: true })] });
    sessions[1].onend(); await tick(); check(field.value === 'Prefix word', 'an existing space must not be doubled');
    button().click(); await tick(); sessions[2].onerror({ error: 'aborted' }); await tick();
    button().click(); await tick(); check(sessions.length === 4, 'an aborted platform session must permit a fresh start');
    sessions[3].onerror({ error: 'network' }); await tick();
    field.speechToText = 'external'; await tick(); const before = field.value;
    button().click(); await tick(); check(events.at(-1)!.detail.listening && field.value === before && sessions.length === 4, 'external speech must delegate without creating a recognizer or changing text');
    button().click(); await tick(); check(!events.at(-1)!.detail.listening, 'external speech must toggle back to idle');
    field.readOnly = true; await tick(); const count = events.length; button().click(); await tick();
    check(events.length === count, 'readonly speech button must not start an external edit');
  } finally {
    field.readOnly = false; field.speechToText = false;
    ['mdSpeechResult', 'mdInput', 'mdChange'].forEach((name) => field.removeEventListener(name, record));
    if (descriptor) Object.defineProperty(platform, 'SpeechRecognition', descriptor); else delete platform.SpeechRecognition;
  }
}
