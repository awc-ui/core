import type { SpecPage } from '@stencil/core/testing';

/** Model only the browser boundary omitted by mock-doc. Component code still
 * owns validation flags, messages, events and rendered presentation. Real
 * ElementInternals/FormData integration is checked by the browser suites. */
export function installFormPlatform(page: SpecPage) {
  const host = page.root!;
  let flags: Record<string, boolean> = {};
  let message = '';
  let submitted: unknown;
  const validate = () => {
    const valid = !Object.values(flags).some(Boolean);
    if (!valid) host.dispatchEvent(new Event('invalid', { cancelable: true }));
    return valid;
  };
  const internals = {
    get validity() { return { ...flags, valid: !Object.values(flags).some(Boolean) }; },
    get validationMessage() { return message; },
    setValidity(next: Record<string, boolean>, text = '') { flags = { ...next }; message = text; },
    setFormValue(value: unknown) { submitted = value; },
    checkValidity: jest.fn(validate),
    reportValidity: jest.fn(validate),
    ariaDescribedByElements: [],
  };
  page.rootInstance.internals = internals;
  // mock-doc does not implement native input constraints either. These specs
  // use unconstrained inputs; required/pattern/range behavior stays in browsers.
  for (const input of Array.from(host.shadowRoot?.querySelectorAll('input,textarea') ?? [])) {
    Object.defineProperty(input, 'validity', { configurable: true, value: { valid: true } });
    Object.defineProperty(input, 'validationMessage', { configurable: true, value: '' });
  }
  return { internals, submitted: () => submitted };
}

export function presentedText(host: HTMLElement): string {
  const shadow = host.shadowRoot!;
  return [shadow.textContent, ...Array.from(shadow.querySelectorAll('md-text-field')).map((field: any) =>
    [field.errorText, field.supportingText, field.getAttribute('error-text'), field.getAttribute('supporting-text'),
      field.getAttribute('errorText'), field.getAttribute('supportingText')].join(' '),
  )].join(' ');
}

export async function settlePresentation(page: SpecPage) {
  await page.waitForChanges();
  await new Promise(resolve => setTimeout(resolve, 35));
  await page.waitForChanges();
}
