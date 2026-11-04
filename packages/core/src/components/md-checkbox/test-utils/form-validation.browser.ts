/** Shared browser contract: Storybook and Stencil execute this against the real
 * hydrated custom element and native ElementInternals, with no mocked validity. */
export async function exerciseServerValidation(supplied?: HTMLElement) {
  const host = (supplied || document.querySelector('[data-form-contract]')) as HTMLElement & {
    name: string;
    getValidity(): Promise<{ valid: boolean; validationMessage: string; flags?: Record<string, boolean> }>;
    setCustomValidity(message: string): Promise<void>;
    checkValidity(): Promise<boolean>;
    reportValidity(): Promise<boolean>;
  };
  const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const wait = async (check: () => boolean, description: string) => {
    const deadline = performance.now() + 3000;
    while (!check()) {
      if (performance.now() > deadline) throw new Error(description);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };
  const visibleMessage = () => {
    const messages: string[] = [];
    const walk = (root: ParentNode) => {
      for (const node of Array.from(root.querySelectorAll('*'))) {
        if (node.getAttribute('part')?.split(' ').includes('supporting-text') || node.getAttribute('role') === 'alert') messages.push(node.textContent || '');
        if (node.shadowRoot) walk(node.shadowRoot);
      }
    };
    walk(host.shadowRoot!);
    return messages.join(' ');
  };
  await wait(() => host.classList.contains('hydrated'), 'control did not hydrate');
  const outside = host.closest('form')!.querySelector('button')!;
  outside.focus();
  const changes: Array<{ valid: boolean; validationMessage: string }> = [];
  const onValidity = (event: Event) => {
    if (event.target === host) changes.push((event as CustomEvent).detail);
  };
  host.addEventListener('mdValidityChange', onValidity);
  try {
    await host.setCustomValidity('The server rejected this value');
    let validity = await host.getValidity();
    assert(!validity.valid && validity.validationMessage === 'The server rejected this value' && validity.flags?.customError,
      'server error must be reported by the public validity API');
    assert(changes.length === 1 && !changes[0].valid, 'server error must emit one validity transition');
    await host.setCustomValidity('The server rejected this value');
    assert(changes.length === 1, 'unchanged validity must not emit another transition');
    assert(await host.checkValidity() === false, 'silent validity query must reject the invalid value');
    await new Promise(resolve => setTimeout(resolve, 50));
    assert(document.activeElement === outside, 'checkValidity must not steal focus');
    assert(!visibleMessage().includes('The server rejected this value'), 'checkValidity must not reveal the inline error');

    assert(await host.reportValidity() === false, 'interactive report must reject the invalid value');
    await wait(() => visibleMessage().includes('The server rejected this value'), 'reportValidity must reveal the server error');
    await wait(() => document.activeElement === host, 'reportValidity must focus its own control');

    host.name = 'replacement';
    await wait(() => !visibleMessage().includes('The server rejected this value'), 'changing form identity must clear presented errors');
    assert((await host.getValidity()).valid === false, 'changing form identity must preserve actual server validity');
    await host.reportValidity();
    await wait(() => visibleMessage().includes('The server rejected this value'), 'a new report must reveal the remaining error');
    const fieldset = host.closest('fieldset')!;
    fieldset.disabled = true;
    await wait(() => !visibleMessage().includes('The server rejected this value'), 'disabling the fieldset must clear presented errors');
    fieldset.disabled = false;
    await host.setCustomValidity('');
    validity = await host.getValidity();
    assert(validity.valid && !validity.validationMessage, 'clearing server validity must restore a valid control');
    assert(await host.checkValidity(), 'the resolved control must pass validity checks');
    assert(changes.length === 2 && changes[1].valid, 'clearing the server error must emit exactly one valid transition');
  } finally {
    host.removeEventListener('mdValidityChange', onValidity);
  }
}
