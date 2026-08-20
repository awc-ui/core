import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type TfEl = HTMLElement & { value: string };
const getTf = async (canvasElement: HTMLElement): Promise<TfEl> => {
  const tf = canvasElement.querySelector('md-text-field') as TfEl;
  await waitFor(() => expect(tf.classList.contains('hydrated')).toBe(true));
  return tf;
};
const inputOf = (tf: TfEl) =>
  tf.shadowRoot!.querySelector('input') as HTMLInputElement;
const typeChar = (tf: TfEl, ch: string) => {
  const input = inputOf(tf);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, composed: true }));
  input.value += ch;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));
/** Nth md-text-field of a multi-field story, awaited to hydration. */
const tfAt = async (canvasElement: HTMLElement, i: number): Promise<TfEl> => {
  const tf = canvasElement.querySelectorAll('md-text-field')[i] as TfEl;
  await waitFor(() => expect(tf.classList.contains('hydrated')).toBe(true));
  return tf;
};
const clearBtn = (tf: TfEl) =>
  tf.shadowRoot!.querySelector('.md-text-field__clear') as HTMLButtonElement;
const pwToggle = (tf: TfEl) =>
  tf.shadowRoot!.querySelector('.md-text-field__password-toggle') as HTMLButtonElement;
const counterOf = (tf: TfEl) =>
  tf.shadowRoot!.querySelector('.md-text-field__counter') as HTMLElement;
const speechBtn = (tf: TfEl) =>
  tf.shadowRoot!.querySelector('.md-text-field__speech') as HTMLButtonElement;

const meta: Meta = {
  title: 'Text Inputs/Text Field',
  component: 'md-text-field',
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['filled', 'outlined'] },
    label: { control: 'text' },
    value: { control: 'text' },
    placeholder: { control: 'text' },
    type: { control: 'select', options: ['text', 'password', 'email', 'number', 'tel', 'url'] },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    required: { control: 'boolean' },
    error: { control: 'boolean' },
    errorText: { control: 'text' },
    supportingText: { control: 'text' },
    prefixText: { control: 'text' },
    suffixText: { control: 'text' },
    maxLength: { control: 'number' },
    clearable: { control: 'select', options: [false, 'internal', 'external'] },
    passwordToggle: { control: 'select', options: [false, 'internal', 'external'] },
    density: { control: 'select', options: [0, -1, -2, -3, -4] },
    multiline: { control: 'select', options: [false, 'auto-grow', 'fixed'] },
    rows: { control: 'number' },
    speechToText: { control: 'select', options: [false, 'internal', 'external'] },
    speechLang: { control: 'text' },
    restrict: { control: 'select', options: ['', 'numeric', 'integer', 'decimal', 'alpha', 'alphanumeric'] },
    focusBorderWidth: { control: 'select', options: [1, 2, 3] },
    debounce: { control: 'number' },
    throttle: { control: 'number' },
  },
  args: {
    variant: 'filled',
    label: 'Label',
    value: '',
    placeholder: '',
    type: 'text',
    disabled: false,
    readOnly: false,
    required: false,
    error: false,
    errorText: '',
    supportingText: '',
    prefixText: '',
    suffixText: '',
    clearable: false,
    passwordToggle: false,
    density: 0,
    multiline: false,
    speechToText: false,
    speechLang: '',
    restrict: '',
    focusBorderWidth: 3,
    debounce: 0,
    throttle: 0,
  },
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  argTypes: {
    // union string|false props: inferred boolean controls coerce 'internal'
    // to false — declare selects explicitly
    clearable: { control: 'select', options: [false, 'internal', 'external'] },
    passwordToggle: { control: 'select', options: [false, 'internal', 'external'], name: 'password-toggle' },
    speechToText: { control: 'select', options: [false, 'internal', 'external'], name: 'speech-to-text' },
    multiline: { control: 'select', options: [false, 'auto-grow', 'fixed'] },
    density: { control: 'select', options: [0, -1, -2, -3, -4] },
    restrict: { control: 'select', options: ['', 'numeric', 'integer', 'decimal', 'alpha', 'alphanumeric'] },
  },
  args: {
    variant: "outlined",
    focusBorderWidth: 2
  },

  render: (args) => html`
    <div style="width:300px; padding:16px;">
      <md-text-field
        variant="${args.variant}"
        label="${args.label}"
        placeholder="${args.placeholder}"
        type="${args.type}"
        ?disabled="${args.disabled}"
        ?readonly="${args.readOnly}"
        ?required="${args.required}"
        ?error="${args.error}"
        error-text="${args.errorText || ''}"
        supporting-text="${args.supportingText || ''}"
        prefix-text="${args.prefixText || ''}"
        suffix-text="${args.suffixText || ''}"
        focus-border-width="${args.focusBorderWidth}"
        .value=${args.value ?? ''}
        .maxLength=${args.maxLength}
        .clearable=${args.clearable ?? false}
        .passwordToggle=${args.passwordToggle ?? false}
        .density=${args.density ?? 0}
        .multiline=${args.multiline ?? false}
        .rows=${args.rows}
        .speechToText=${args.speechToText ?? false}
        .speechLang=${args.speechLang ?? ''}
        .restrict=${args.restrict ?? ''}
        .debounce=${args.debounce ?? 0}
        .throttle=${args.throttle ?? 0}
      ></md-text-field>
    </div>
  `,

  /** The core typing contract, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const tf = await getTf(canvasElement);
    const inputEvents: string[] = [];
    tf.addEventListener('mdInput', (e) => inputEvents.push((e as CustomEvent<string>).detail));
    let clears = 0;
    tf.addEventListener('mdClear', () => clears++);

    await step('Typing emits mdInput per keystroke and value tracks the input', async () => {
      inputOf(tf).focus();
      for (const ch of 'Hello') typeChar(tf, ch);
      await waitFor(() => expect(tf.value).toBe('Hello'));
      expect(inputEvents).toEqual(['H', 'He', 'Hel', 'Hell', 'Hello']);
      expect(inputOf(tf).value).toBe('Hello');
    });

    await step('A populated field floats its label (state class, not pixels)', async () => {
      await waitFor(() => expect(tf.classList.contains('md-text-field--floating')).toBe(true));
      expect(tf.shadowRoot!.activeElement).toBe(inputOf(tf));
    });

    await step('Escape is inert while clearable is off — the value survives', async () => {
      key(inputOf(tf), 'Escape');
      expect(tf.value).toBe('Hello');
      expect(inputOf(tf).value).toBe('Hello');
      expect(clears).toBe(0);
    });

    await step('setFocus(), container click, and select() all drive the inner input', async () => {
      const input = inputOf(tf);
      input.blur();
      await waitFor(() => expect(tf.shadowRoot!.activeElement).not.toBe(input));
      await (tf as any).setFocus();
      expect(tf.shadowRoot!.activeElement).toBe(input); // @Method setFocus() landed
      input.blur();
      await waitFor(() => expect(tf.shadowRoot!.activeElement).not.toBe(input));
      (tf.shadowRoot!.querySelector('.md-text-field__container') as HTMLElement).click();
      expect(tf.shadowRoot!.activeElement).toBe(input); // container click re-focuses
      await (tf as any).select();
      await waitFor(() => {
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe(tf.value.length); // whole value selected
      });
    });

    await step('Validity API methods report a constraint-free field as valid', async () => {
      expect(await (tf as any).checkValidity()).toBe(true);
      expect(await (tf as any).reportValidity()).toBe(true);
      const v = await (tf as any).getValidity();
      expect(v.valid).toBe(true);
      expect(v.flags.customError).toBe(false);
    });

    await step('setCustomValidity marks the field invalid until cleared with ""', async () => {
      await (tf as any).setCustomValidity('Server rejected this');
      const bad = await (tf as any).getValidity();
      expect(bad.valid).toBe(false);
      expect(bad.flags.customError).toBe(true); // custom message surfaced through ElementInternals
      expect(bad.validationMessage).toBe('Server rejected this');
      expect(await (tf as any).checkValidity()).toBe(false);
      await (tf as any).setCustomValidity('');
      const good = await (tf as any).getValidity();
      expect(good.valid).toBe(true); // cleared — the field is valid again
      expect(good.flags.customError).toBe(false);
    });

    await step('Changing the type prop re-renders the inner input, preserving the value', async () => {
      (tf as any).type = 'password';
      await waitFor(() => expect(inputOf(tf).type).toBe('password'));
      expect(tf.value).toBe('Hello'); // value survives the type swap
      (tf as any).type = 'text';
      await waitFor(() => expect(inputOf(tf).type).toBe('text'));
      expect(inputOf(tf).value).toBe('Hello'); // resynced onto the visible input
    });

    await step('IME composition defers input until compositionend', async () => {
      const input = inputOf(tf);
      input.focus();
      input.value = 'Hello';
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      input.value = 'Hello世'; // provisional mid-composition text
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(tf.value).toBe('Hello'); // gated — composition still in progress
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      await waitFor(() => expect(tf.value).toBe('Hello世')); // committed on compositionend
    });
  },
};

export const AllVariants: Story = {
  render: () => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Filled</h3>
        <md-text-field variant="filled" label="Empty"></md-text-field>
        <md-text-field variant="filled" label="Populated" value="Hello World"></md-text-field>
        <md-text-field variant="filled" label="With Placeholder" placeholder="Type here..."></md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Outlined</h3>
        <md-text-field variant="outlined" label="Empty"></md-text-field>
        <md-text-field variant="outlined" label="Populated" value="Hello World"></md-text-field>
        <md-text-field variant="outlined" label="With Placeholder" placeholder="Type here..."></md-text-field>
      </div>
    </div>
  `,
};

export const WithIcons: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Leading Icon</h3>
        <md-text-field variant="filled" label="${t(globals.locale, 'search')}">
          <span slot="leading-icon" class="material-symbols-outlined">search</span>
        </md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'search')}">
          <span slot="leading-icon" class="material-symbols-outlined">search</span>
        </md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Trailing Icon</h3>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.password')}">
          <span slot="trailing-icon" class="material-symbols-outlined">visibility</span>
        </md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.password')}">
          <span slot="trailing-icon" class="material-symbols-outlined">visibility</span>
        </md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Both Icons</h3>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.email')}">
          <span slot="leading-icon" class="material-symbols-outlined">mail</span>
          <span slot="trailing-icon" class="material-symbols-outlined">cancel</span>
        </md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.email')}">
          <span slot="leading-icon" class="material-symbols-outlined">mail</span>
          <span slot="trailing-icon" class="material-symbols-outlined">cancel</span>
        </md-text-field>
      </div>
    </div>
  `,
};

export const SlottedIcons: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Material Symbols</h3>
        <md-text-field variant="filled" label="${t(globals.locale, 'search')}">
          <span slot="leading-icon" class="material-symbols-outlined">search</span>
        </md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.location')}">
          <span slot="leading-icon" class="material-symbols-outlined">location_on</span>
        </md-text-field>
        <md-text-field variant="filled" label="Both icons" value="Hello">
          <span slot="leading-icon" class="material-symbols-outlined">person</span>
          <span slot="trailing-icon" class="material-symbols-outlined">info</span>
        </md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Custom SVG Icons</h3>
        <md-text-field variant="filled" label="Custom leading">
          <svg slot="leading-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        </md-text-field>
        <md-text-field variant="outlined" label="Custom trailing" value="Some value">
          <svg slot="trailing-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        </md-text-field>
        <md-text-field variant="filled" label="Custom clear icon" clearable="internal" value="Click clear">
          <svg slot="clear-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Custom Action Icons</h3>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.password')}" type="password" password-toggle="internal" value="s3cret!">
          <span slot="password-toggle-icon" class="material-symbols-outlined">lock</span>
        </md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.voiceInput')}" speech-to-text="internal">
          <span slot="speech-icon" class="material-symbols-outlined">graphic_eq</span>
        </md-text-field>
        <md-text-field variant="filled" label="All slots" clearable="internal" value="Everything slotted">
          <span slot="leading-icon" class="material-symbols-outlined">star</span>
          <span slot="trailing-icon" class="material-symbols-outlined">info</span>
          <span slot="clear-icon" class="material-symbols-outlined">delete</span>
        </md-text-field>
      </div>
    </div>
  `,
};

export const PrefixAndSuffix: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Prefix</h3>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.amount')}" prefix-text="$" value="100"></md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.amount')}" prefix-text="$" value="250"></md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Suffix</h3>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.weight')}" suffix-text="kg" value="50"></md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.domain')}" suffix-text="@example.com" value="user"></md-text-field>
      </div>
    </div>
  `,
};

export const ErrorStates: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:300px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Filled Error</h3>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.email')}" error error-text="${t(globals.locale, 'textfield.invalidEmail')}" value="notanemail"></md-text-field>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.requiredField')}" error error-text="${t(globals.locale, 'textfield.fieldRequired')}"></md-text-field>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.password')}" error error-text="${t(globals.locale, 'textfield.min8Chars')}" value="abc" type="password" password-toggle="internal"></md-text-field>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.username')}" error error-text="${t(globals.locale, 'textfield.usernameTaken')}" value="admin" clearable="internal">
          <span slot="leading-icon" class="material-symbols-outlined">person</span>
        </md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:300px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Outlined Error</h3>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.email')}" error error-text="${t(globals.locale, 'textfield.invalidEmail')}" value="notanemail"></md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.requiredField')}" error error-text="${t(globals.locale, 'textfield.fieldRequired')}"></md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.phone')}" error error-text="${t(globals.locale, 'textfield.invalidPhone')}" value="123" restrict="numeric">
          <span slot="leading-icon" class="material-symbols-outlined">call</span>
        </md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.website')}" error error-text="${t(globals.locale, 'textfield.urlHttps')}" value="example.com" clearable="internal"></md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:300px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Custom Error Icon</h3>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.age')}" error error-text="${t(globals.locale, 'textfield.min18')}" value="15" restrict="numeric">
          <span slot="error-icon" class="material-symbols-outlined">warning</span>
        </md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.code')}" error error-text="${t(globals.locale, 'textfield.invalidCode')}" value="XYZ">
          <span slot="error-icon" class="material-symbols-outlined">dangerous</span>
        </md-text-field>
      </div>
    </div>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Filled Disabled</h3>
        <md-text-field variant="filled" label="Empty Disabled" disabled></md-text-field>
        <md-text-field variant="filled" label="Populated Disabled" value="Can't edit" disabled></md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Outlined Disabled</h3>
        <md-text-field variant="outlined" label="Empty Disabled" disabled></md-text-field>
        <md-text-field variant="outlined" label="Populated Disabled" value="Can't edit" disabled></md-text-field>
      </div>
    </div>
  `,
};

export const CharacterCounter: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.bio')}" max-length="120" supporting-text="${t(globals.locale, 'textfield.briefDescription')}" value="Hello there"></md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.username')}" max-length="20" supporting-text="${t(globals.locale, 'textfield.chooseUsername')}"></md-text-field>
      </div>
    </div>
  `,

  /** The counter tracks the live value length, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const tf = await tfAt(canvasElement, 0); // Bio — value "Hello there", max-length 120
    inputOf(tf).focus();

    await step('Counter starts in sync with the seeded value length', async () => {
      expect(tf.value).toBe('Hello there');
      expect(counterOf(tf).textContent).toBe('11/120');
      // cross-check the rendered count against the REAL value length, not a literal
      expect(counterOf(tf).textContent).toBe(`${tf.value.length}/120`);
    });

    await step('Typing bumps the counter one per character', async () => {
      const before = counterOf(tf).textContent; // '11/120'
      typeChar(tf, '!');
      await waitFor(() => expect(counterOf(tf).textContent).not.toBe(before)); // it moved
      expect(counterOf(tf).textContent).toBe('12/120');
      expect(tf.value).toBe('Hello there!');
    });

    await step('It keeps tracking as more characters arrive', async () => {
      for (const ch of '?!') typeChar(tf, ch);
      await waitFor(() => expect(counterOf(tf).textContent).toBe('14/120'));
      // still bound to the produced value, not a hard-coded number
      expect(counterOf(tf).textContent).toBe(`${tf.value.length}/120`);
    });
  },
};

export const InputTypes: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.email')}" type="email">
          <span slot="leading-icon" class="material-symbols-outlined">mail</span>
        </md-text-field>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.password')}" type="password" password-toggle="internal"></md-text-field>
        <md-text-field variant="filled" label="${t(globals.locale, 'textfield.phone')}" type="tel">
          <span slot="leading-icon" class="material-symbols-outlined">phone</span>
        </md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.website')}" type="url">
          <span slot="leading-icon" class="material-symbols-outlined">language</span>
        </md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.amount')}" type="number" prefix-text="$"></md-text-field>
        <md-text-field variant="outlined" label="${t(globals.locale, 'search')}" type="text">
          <span slot="leading-icon" class="material-symbols-outlined">search</span>
          <span slot="trailing-icon" class="material-symbols-outlined">mic</span>
        </md-text-field>
      </div>
    </div>
  `,
};

export const Clearable: Story = {
  render: (_args, { globals }) => {
    const logClear = (e: Event) => {
      const log = (e.target as HTMLElement).closest('.clearable-external-col')?.querySelector('.event-log') as HTMLElement;
      if (!log) return;
      const placeholder = log.querySelector('.event-log__placeholder');
      if (placeholder) placeholder.remove();
      const entry = document.createElement('div');
      entry.className = 'event-log__entry';
      entry.textContent = `mdClear emitted — ${new Date().toLocaleTimeString()}`;
      log.prepend(entry);
      if (log.children.length > 5) log.lastElementChild?.remove();
    };

    return html`
      <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
        <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
          <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Internal (self-managed)</h3>
          <md-text-field variant="filled" label="${t(globals.locale, 'search')}" clearable="internal" value="Some text">
            <span slot="leading-icon" class="material-symbols-outlined">search</span>
          </md-text-field>
          <md-text-field variant="outlined" label="${t(globals.locale, 'search')}" clearable="internal" value="Some text">
            <span slot="leading-icon" class="material-symbols-outlined">search</span>
          </md-text-field>
          <md-text-field variant="filled" label="Empty Field" clearable="internal"></md-text-field>
        </div>
        <div class="clearable-external-col">
          <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">External (controlled)</h3>
          <md-text-field
            variant="filled"
            label="${t(globals.locale, 'textfield.email')}"
            clearable="external"
            value="user@example.com"
            @mdClear=${logClear}
          >
            <span slot="leading-icon" class="material-symbols-outlined">mail</span>
          </md-text-field>
          <md-text-field
            variant="outlined"
            label="${t(globals.locale, 'textfield.email')}"
            clearable="external"
            value="user@example.com"
            @mdClear=${logClear}
          >
            <span slot="leading-icon" class="material-symbols-outlined">mail</span>
          </md-text-field>
          <div class="event-log">
            <div class="event-log__placeholder">Waiting for mdClear events…</div>
          </div>
        </div>
      </div>
      <style>
        .clearable-external-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 280px;
        }
        .event-log {
          margin-top: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          background: #f3edf7;
          font-family: 'Roboto Mono', monospace;
          font-size: 12px;
          line-height: 20px;
          color: #49454f;
          min-height: 24px;
          max-height: 120px;
          overflow-y: auto;
        }
        .event-log__placeholder {
          color: #49454F;
          font-style: italic;
        }
        .event-log__entry {
          animation: flash-in 0.4s ease;
        }
        @keyframes flash-in {
          0% { background-color: #e8def8; }
          100% { background-color: transparent; }
        }
      </style>
    `;
  },

  /** The clear-button contract, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const tf = await tfAt(canvasElement, 0); // internal, value "Some text"
    const empty = await tfAt(canvasElement, 2); // internal, empty field
    let clears = 0;
    tf.addEventListener('mdClear', () => clears++);

    await step('The clear button is live while the field has a value', async () => {
      expect(tf.value).toBe('Some text');
      expect(clearBtn(tf).disabled).toBe(false);
      expect(clearBtn(tf).classList.contains('md-text-field__clear--empty')).toBe(false);
    });

    await step('Clicking clear empties the value, refocuses the input, and emits mdClear', async () => {
      const before = tf.value;
      clearBtn(tf).click();
      await waitFor(() => expect(tf.value).toBe(''));
      expect(before).toBe('Some text'); // proves it transitioned from non-empty
      expect(inputOf(tf).value).toBe('');
      expect(clears).toBe(1);
      expect(tf.shadowRoot!.activeElement).toBe(inputOf(tf)); // focus returned to the input
      // now empty → the button reflects the disabled state on the next render flush
      await waitFor(() => expect(clearBtn(tf).disabled).toBe(true));
    });

    await step('Guard: an empty field’s clear button is inert and emits nothing', async () => {
      let emptyClears = 0;
      empty.addEventListener('mdClear', () => emptyClears++);
      expect(clearBtn(empty).disabled).toBe(true);
      clearBtn(empty).click(); // a disabled native button swallows the click
      expect(empty.value).toBe('');
      expect(emptyClears).toBe(0);
    });

    await step('Escape clears an internal-clearable field (keyboard parity with the icon)', async () => {
      const esc = await tfAt(canvasElement, 1); // outlined, clearable="internal", value "Some text"
      let escClears = 0;
      esc.addEventListener('mdClear', () => escClears++);
      inputOf(esc).focus();
      expect(esc.value).toBe('Some text');
      key(inputOf(esc), 'Escape');
      await waitFor(() => expect(esc.value).toBe('')); // Escape ran clearValue()
      expect(inputOf(esc).value).toBe('');
      expect(escClears).toBe(1); // and emitted mdClear like the icon does
    });
  },
};

export const PasswordToggle: Story = {
  render: (_args, { globals }) => {
    const logToggle = (e: CustomEvent<{ visible: boolean }>) => {
      const log = (e.target as HTMLElement).closest('.pw-external-col')?.querySelector('.event-log') as HTMLElement;
      if (!log) return;
      const placeholder = log.querySelector('.event-log__placeholder');
      if (placeholder) placeholder.remove();
      const entry = document.createElement('div');
      entry.className = 'event-log__entry';
      entry.textContent = `mdPasswordToggle { visible: ${e.detail.visible} } — ${new Date().toLocaleTimeString()}`;
      log.prepend(entry);
      if (log.children.length > 5) log.lastElementChild?.remove();
    };

    return html`
      <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
        <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
          <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Internal (self-managed)</h3>
          <md-text-field variant="filled" label="${t(globals.locale, 'textfield.password')}" type="password" password-toggle="internal" value="s3cret!"></md-text-field>
          <md-text-field variant="outlined" label="${t(globals.locale, 'textfield.password')}" type="password" password-toggle="internal" value="s3cret!"></md-text-field>
          <md-text-field variant="filled" label="Password + Clear" type="password" password-toggle="internal" clearable="internal" value="s3cret!"></md-text-field>
        </div>
        <div class="pw-external-col">
          <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">External (controlled)</h3>
          <md-text-field
            variant="filled"
            label="${t(globals.locale, 'textfield.password')}"
            type="password"
            password-toggle="external"
            value="s3cret!"
            @mdPasswordToggle=${logToggle}
          ></md-text-field>
          <md-text-field
            variant="outlined"
            label="${t(globals.locale, 'textfield.password')}"
            type="password"
            password-toggle="external"
            value="s3cret!"
            @mdPasswordToggle=${logToggle}
          ></md-text-field>
          <div class="event-log">
            <div class="event-log__placeholder">Waiting for mdPasswordToggle events…</div>
          </div>
        </div>
      </div>
      <style>
        .pw-external-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 280px;
        }
        .event-log {
          margin-top: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          background: #f3edf7;
          font-family: 'Roboto Mono', monospace;
          font-size: 12px;
          line-height: 20px;
          color: #49454f;
          min-height: 24px;
          max-height: 120px;
          overflow-y: auto;
        }
        .event-log__placeholder {
          color: #49454F;
          font-style: italic;
        }
        .event-log__entry {
          animation: flash-in 0.4s ease;
        }
        @keyframes flash-in {
          0% { background-color: #e8def8; }
          100% { background-color: transparent; }
        }
      </style>
    `;
  },

  /** The visibility-toggle contract, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const tf = await tfAt(canvasElement, 0); // internal, type=password, value "s3cret!"
    const ext = await tfAt(canvasElement, 3); // external (consumer-controlled)
    const visibleEvents: boolean[] = [];
    tf.addEventListener('mdPasswordToggle', (e) =>
      visibleEvents.push((e as CustomEvent<{ visible: boolean }>).detail.visible),
    );

    await step('Starts masked: type=password, toggle un-pressed', async () => {
      expect(inputOf(tf).type).toBe('password');
      expect(pwToggle(tf).getAttribute('aria-pressed')).toBe('false');
    });

    await step('Clicking reveals the value (type flips to text) and emits visible:true', async () => {
      pwToggle(tf).click();
      await waitFor(() => expect(inputOf(tf).type).toBe('text')); // password → text
      await waitFor(() => expect(pwToggle(tf).getAttribute('aria-pressed')).toBe('true'));
      expect(visibleEvents).toEqual([true]);
      expect(tf.value).toBe('s3cret!'); // visibility only — the value is untouched
    });

    await step('Clicking again re-masks (text → password) and emits visible:false', async () => {
      pwToggle(tf).click();
      await waitFor(() => expect(inputOf(tf).type).toBe('password'));
      await waitFor(() => expect(pwToggle(tf).getAttribute('aria-pressed')).toBe('false'));
      expect(visibleEvents).toEqual([true, false]);
    });

    await step('Guard: an EXTERNAL toggle emits but does NOT self-manage the input type', async () => {
      let extVisible: boolean | undefined;
      ext.addEventListener(
        'mdPasswordToggle',
        (e) => { extVisible = (e as CustomEvent<{ visible: boolean }>).detail.visible; },
        { once: true },
      );
      expect(inputOf(ext).type).toBe('password');
      pwToggle(ext).click();
      expect(extVisible).toBe(true); // the event fired
      // external mode leaves type control to the consumer — the field stays masked
      await new Promise((r) => setTimeout(r, 50));
      expect(inputOf(ext).type).toBe('password');
    });
  },
};

export const MultiLine: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:320px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Filled – Auto-grow</h3>
        <md-text-field
          variant="filled"
          label="${t(globals.locale, 'textfield.description')}"
          multiline="auto-grow"
          value="This is an auto-growing text field. As you type more content, the field will expand vertically to accommodate it."
          supporting-text="Expands as you type"
        ></md-text-field>
        <md-text-field
          variant="filled"
          label="${t(globals.locale, 'textfield.notes')}"
          multiline="auto-grow"
          placeholder="${t(globals.locale, 'textfield.startTyping')}"
        >
          <span slot="leading-icon" class="material-symbols-outlined">edit_note</span>
        </md-text-field>
        <md-text-field
          variant="filled"
          label="${t(globals.locale, 'textfield.comment')}"
          multiline="auto-grow"
          clearable="internal"
          value="Clearable auto-grow field"
        ></md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:320px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Outlined – Auto-grow</h3>
        <md-text-field
          variant="outlined"
          label="${t(globals.locale, 'textfield.description')}"
          multiline="auto-grow"
          value="This is an auto-growing text field. As you type more content, the field will expand vertically to accommodate it."
          supporting-text="Expands as you type"
        ></md-text-field>
        <md-text-field
          variant="outlined"
          label="${t(globals.locale, 'textfield.notes')}"
          multiline="auto-grow"
          placeholder="${t(globals.locale, 'textfield.startTyping')}"
        >
          <span slot="leading-icon" class="material-symbols-outlined">edit_note</span>
        </md-text-field>
        <md-text-field
          variant="outlined"
          label="${t(globals.locale, 'textfield.bio')}"
          multiline="auto-grow"
          rows="3"
          max-length="200"
          value="Custom rows (3) with character counter"
        ></md-text-field>
      </div>
    </div>
  `,
};

export const TextArea: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:320px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Filled – Fixed (Text Area)</h3>
        <md-text-field
          variant="filled"
          label="${t(globals.locale, 'textfield.message')}"
          multiline="fixed"
          value="This is a fixed-height text area. It has a set number of visible rows and scrolls vertically when the content exceeds the visible area. This is the recommended approach for long-form text input on the web."
          supporting-text="Fixed height, scrolls vertically"
        ></md-text-field>
        <md-text-field
          variant="filled"
          label="${t(globals.locale, 'textfield.feedback')}"
          multiline="fixed"
          rows="6"
          placeholder="${t(globals.locale, 'textfield.tellUsThink')}"
          max-length="500"
        ></md-text-field>
        <md-text-field
          variant="filled"
          label="${t(globals.locale, 'textfield.address')}"
          multiline="fixed"
          rows="3"
          value="123 Main Street&#10;Apt 4B&#10;New York, NY 10001"
        >
          <span slot="leading-icon" class="material-symbols-outlined">location_on</span>
        </md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:320px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Outlined – Fixed (Text Area)</h3>
        <md-text-field
          variant="outlined"
          label="${t(globals.locale, 'textfield.message')}"
          multiline="fixed"
          value="This is a fixed-height text area. It has a set number of visible rows and scrolls vertically when the content exceeds the visible area. This is the recommended approach for long-form text input on the web."
          supporting-text="Fixed height, scrolls vertically"
        ></md-text-field>
        <md-text-field
          variant="outlined"
          label="${t(globals.locale, 'textfield.review')}"
          multiline="fixed"
          rows="6"
          placeholder="${t(globals.locale, 'textfield.writeReview')}"
          max-length="1000"
        ></md-text-field>
        <md-text-field
          variant="outlined"
          label="Disabled"
          multiline="fixed"
          disabled
          value="This text area is disabled"
        ></md-text-field>
      </div>
    </div>
  `,
};

export const InputRestrictions: Story = {
  render: () => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Preset Restrictions</h3>
        <md-text-field variant="filled" label="Numeric only" restrict="numeric" supporting-text="Only digits 0-9"></md-text-field>
        <md-text-field variant="filled" label="Integer" restrict="integer" supporting-text="Digits and minus sign"></md-text-field>
        <md-text-field variant="filled" label="Decimal" restrict="decimal" supporting-text="Digits, dot, minus"></md-text-field>
        <md-text-field variant="filled" label="Alpha only" restrict="alpha" supporting-text="Letters only"></md-text-field>
        <md-text-field variant="filled" label="Alphanumeric" restrict="alphanumeric" supporting-text="Letters and digits"></md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Custom Restrictions</h3>
        <md-text-field variant="outlined" label="Phone" restrict="[0-9+() -]" supporting-text="Digits, +, (), space, dash" prefix-text="+"></md-text-field>
        <md-text-field variant="outlined" label="Hex color" restrict="[0-9a-fA-F]" supporting-text="0-9 and A-F" prefix-text="#" max-length="6"></md-text-field>
        <md-text-field variant="outlined" label="Time (HH:MM)" restrict="[0-9:]" supporting-text="Digits and colon" placeholder="12:30"></md-text-field>
      </div>
    </div>
  `,

  /** Character restriction enforcement, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const numeric = await tfAt(canvasElement, 0); // restrict="numeric"
    const alpha = await tfAt(canvasElement, 3); // restrict="alpha"
    const emitted: string[] = [];
    numeric.addEventListener('mdInput', (e) => emitted.push((e as CustomEvent<string>).detail));

    await step('Numeric field strips letters keystroke-by-keystroke', async () => {
      inputOf(numeric).focus();
      for (const ch of 'a1b2c3') typeChar(numeric, ch);
      await waitFor(() => expect(numeric.value).toBe('123'));
      expect(inputOf(numeric).value).toBe('123'); // the DOM input was corrected too
      // no emitted value ever carried a letter — rejection happened before mdInput
      expect(emitted.every((v) => !/[a-z]/i.test(v))).toBe(true);
    });

    await step('Guard: a disallowed key does not grow the value', async () => {
      const before = numeric.value; // '123'
      typeChar(numeric, 'z');
      await new Promise((r) => setTimeout(r, 20));
      expect(numeric.value).toBe(before); // unchanged — the letter was rejected
      expect(inputOf(numeric).value).toBe('123');
    });

    await step('A different restriction mirrors it: alpha keeps letters, drops digits', async () => {
      inputOf(alpha).focus();
      for (const ch of 'a1b2') typeChar(alpha, ch);
      await waitFor(() => expect(alpha.value).toBe('ab'));
      expect(inputOf(alpha).value).toBe('ab');
    });
  },
};

export const Formatters: Story = {
  render: () => {
    const setupFormatters = () => {
      requestAnimationFrame(() => {
        const setup = (id: string, formatter: (v: string) => string, parser?: (v: string) => string) => {
          const el = document.querySelector(id) as any;
          if (el && !el.formatter) {
            el.formatter = formatter;
            if (parser) el.parser = parser;
          }
        };

        const numParser = (v: string) => v.replace(/[^0-9.\-]/g, '');
        const digitParser = (v: string) => v.replace(/\D/g, '');

        // Format on blur — numbers
        setup('#fmt-number', (v) => {
          const n = parseFloat(v); return isNaN(n) ? v : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
        }, numParser);

        setup('#fmt-currency', (v) => {
          const n = parseFloat(v); return isNaN(n) ? v : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
        }, numParser);

        setup('#fmt-euro', (v) => {
          const n = parseFloat(v); return isNaN(n) ? v : new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
        }, (v) => v.replace(/[^0-9,\-]/g, '').replace(',', '.'));

        setup('#fmt-percent', (v) => {
          const n = parseFloat(v); return isNaN(n) ? v : n.toFixed(1) + '%';
        }, numParser);

        setup('#fmt-bytes', (v) => {
          const n = parseInt(v, 10);
          if (isNaN(n)) return v;
          if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(2) + ' GB';
          if (n >= 1_048_576) return (n / 1_048_576).toFixed(2) + ' MB';
          if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
          return n + ' B';
        }, digitParser);

        setup('#fmt-integer', (v) => {
          const n = parseInt(v, 10); return isNaN(n) ? v : new Intl.NumberFormat('en-US').format(n);
        }, digitParser);

        setup('#fmt-weight', (v) => {
          const n = parseFloat(v); return isNaN(n) ? v : n.toFixed(1);
        }, numParser);

        setup('#fmt-temp', (v) => {
          const n = parseFloat(v); return isNaN(n) ? v : n.toFixed(1);
        }, numParser);

        setup('#fmt-distance', (v) => {
          const n = parseFloat(v); return isNaN(n) ? v : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(n);
        }, numParser);

        setup('#fmt-compact', (v) => {
          const n = parseFloat(v); return isNaN(n) ? v : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
        }, numParser);

        setup('#fmt-gpa', (v) => {
          const n = parseFloat(v); if (isNaN(n)) return v; return Math.min(n, 4).toFixed(2);
        }, numParser);

        setup('#fmt-jpn', (v) => {
          const n = parseInt(v, 10); return isNaN(n) ? v : new Intl.NumberFormat('ja-JP').format(n);
        }, digitParser);

        // Format on input — patterns
        setup('#fmt-phone', (v) => {
          const d = v.replace(/\D/g, '');
          if (d.length <= 3) return d;
          if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
          return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
        }, digitParser);

        setup('#fmt-card', (v) => {
          const d = v.replace(/\D/g, '');
          return d.replace(/(.{4})/g, '$1 ').trim();
        }, digitParser);

        setup('#fmt-ssn', (v) => {
          const d = v.replace(/\D/g, '');
          if (d.length <= 3) return d;
          if (d.length <= 5) return d.slice(0, 3) + '-' + d.slice(3);
          return d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5, 9);
        }, digitParser);

        setup('#fmt-date', (v) => {
          const d = v.replace(/\D/g, '');
          if (d.length <= 2) return d;
          if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
          return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4, 8);
        }, digitParser);

        setup('#fmt-time', (v) => {
          const d = v.replace(/\D/g, '');
          if (d.length <= 2) return d;
          return d.slice(0, 2) + ':' + d.slice(2, 4);
        }, digitParser);

        setup('#fmt-card-exp', (v) => {
          const d = v.replace(/\D/g, '');
          if (d.length <= 2) return d;
          return d.slice(0, 2) + '/' + d.slice(2, 4);
        }, digitParser);

        setup('#fmt-card-cvv', (v) => v.replace(/\D/g, '').slice(0, 4), digitParser);

        setup('#fmt-iban', (v) => {
          const clean = v.replace(/\s/g, '').toUpperCase();
          return clean.replace(/(.{4})/g, '$1 ').trim();
        }, (v) => v.replace(/\s/g, '').toUpperCase());

        setup('#fmt-zip', (v) => {
          const d = v.replace(/\D/g, '');
          if (d.length <= 5) return d;
          return d.slice(0, 5) + '-' + d.slice(5, 9);
        }, digitParser);

        setup('#fmt-ip', (v) => {
          const d = v.replace(/[^0-9]/g, '');
          const octets: string[] = [];
          let remaining = d;
          for (let i = 0; i < 4 && remaining.length > 0; i++) {
            const take = remaining.length > 3 * (3 - i) ? 3 : Math.min(3, remaining.length);
            octets.push(remaining.slice(0, take));
            remaining = remaining.slice(take);
          }
          return octets.join('.');
        }, (v: string) => v.replace(/\./g, ''));

        setup('#fmt-mac', (v) => {
          const hex = v.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 12);
          return hex.replace(/(.{2})(?=.)/g, '$1:');
        }, (v: string) => v.replace(/:/g, '').toUpperCase());

        setup('#fmt-uk-phone', (v) => {
          const d = v.replace(/\D/g, '');
          if (d.length <= 2) return '+' + d;
          if (d.length <= 4) return '+' + d.slice(0, 2) + ' ' + d.slice(2);
          if (d.length <= 8) return '+' + d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4);
          return '+' + d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4, 8) + ' ' + d.slice(8, 12);
        }, digitParser);

        const addThousandSep = (v: string, sep = ',', dec = '.') => {
          if (!v) return v;
          const sign = v.startsWith('-') ? '-' : '';
          const abs = v.replace(/^-/, '');
          const parts = abs.split('.');
          const intFormatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
          return sign + intFormatted + (parts.length > 1 ? dec + parts[1] : '');
        };

        // Live number formatting — preserve decimals as typed
        setup('#fmt-number-live', (v) => addThousandSep(v), numParser);

        setup('#fmt-currency-live', (v) => addThousandSep(v), numParser);

        setup('#fmt-euro-live', (v) => addThousandSep(v, '.', ','),
          (v) => v.replace(/[^0-9,\-]/g, '').replace(',', '.'));

        setup('#fmt-uppercase', (v) => v.toUpperCase());
        setup('#fmt-lowercase', (v) => v.toLowerCase());
        setup('#fmt-capitalize', (v) => v.replace(/\b\w/g, (c) => c.toUpperCase()));
        setup('#fmt-sentence', (v) => v.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase()));
        setup('#fmt-slug', (v) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
        setup('#fmt-camel', (v) => v.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()));
        setup('#fmt-snake', (v) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
        setup('#fmt-trim', (v) => v.replace(/\s+/g, ' ').trim());
        setup('#fmt-email', (v) => v.toLowerCase().trim());
        setup('#fmt-reverse', (v) => v.split('').reverse().join(''));
      });
    };
    setupFormatters();

    return html`
      <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
        <div style="display:flex; flex-direction:column; gap:24px; width:300px;">
          <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Numbers (format on blur)</h3>
          <md-text-field id="fmt-number" variant="filled" label="Amount" restrict="decimal" value="132000" supporting-text="132,000.00"></md-text-field>
          <md-text-field id="fmt-currency" variant="filled" label="Price" restrict="decimal" value="9999.5" prefix-text="$" supporting-text="$9,999.50"></md-text-field>
          <md-text-field id="fmt-euro" variant="outlined" label="Betrag" restrict="[0-9,\\-]" value="1234.56" suffix-text="€" supporting-text="1.234,56 €"></md-text-field>
          <md-text-field id="fmt-percent" variant="filled" label="Percentage" restrict="decimal" value="85.5" suffix-text="%" supporting-text="85.5%"></md-text-field>
          <md-text-field id="fmt-bytes" variant="outlined" label="File Size" restrict="numeric" value="1548576" supporting-text="1.48 MB"></md-text-field>
          <md-text-field id="fmt-integer" variant="filled" label="Population" restrict="numeric" value="8425000" supporting-text="8,425,000"></md-text-field>
          <md-text-field id="fmt-weight" variant="outlined" label="Weight" restrict="decimal" value="72.5" suffix-text="kg" supporting-text="72.5 kg"></md-text-field>
          <md-text-field id="fmt-temp" variant="filled" label="Temperature" restrict="decimal" value="36.6" suffix-text="°C" supporting-text="36.6 °C"></md-text-field>
          <md-text-field id="fmt-distance" variant="outlined" label="Distance" restrict="decimal" value="42195" suffix-text="km" supporting-text="42,195.000 km"></md-text-field>
          <md-text-field id="fmt-compact" variant="filled" label="Compact Number" restrict="decimal" value="1500000" supporting-text="1.5M"></md-text-field>
          <md-text-field id="fmt-gpa" variant="outlined" label="GPA" restrict="decimal" value="3.85" supporting-text="3.85 (max 4.00)"></md-text-field>
          <md-text-field id="fmt-jpn" variant="filled" label="Yen Amount" restrict="numeric" value="150000" prefix-text="¥" supporting-text="¥150,000"></md-text-field>
        </div>
        <div style="display:flex; flex-direction:column; gap:24px; width:300px;">
          <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Live formatting (format on input)</h3>
          <md-text-field id="fmt-number-live" variant="filled" label="Amount (live)" restrict="decimal" value="132000" format-on="input" supporting-text="132,000 as you type"></md-text-field>
          <md-text-field id="fmt-currency-live" variant="filled" label="Price (live)" restrict="decimal" value="9999.5" format-on="input" prefix-text="$" supporting-text="$9,999.50 as you type"></md-text-field>
          <md-text-field id="fmt-euro-live" variant="outlined" label="Betrag (live)" restrict="[0-9,\\-]" value="1234.56" format-on="input" suffix-text="€" supporting-text="1.234,56 € as you type"></md-text-field>
          <md-text-field id="fmt-phone" max-length="10" variant="filled" label="Phone" restrict="numeric" value="5551234567" format-on="input" supporting-text="(555) 123-4567"></md-text-field>
          <md-text-field id="fmt-card" variant="outlined" label="Card Number" restrict="numeric" value="4111111111111111" format-on="input" max-length="16" supporting-text="4111 1111 1111 1111">
            <span slot="leading-icon" class="material-symbols-outlined">credit_card</span>
          </md-text-field>
          <md-text-field id="fmt-card-exp" variant="filled" label="Expiry Date" restrict="numeric" format-on="input" placeholder="MM/YY" supporting-text="e.g. 03/28">
            <span slot="leading-icon" class="material-symbols-outlined">event</span>
          </md-text-field>
          <md-text-field id="fmt-card-cvv" variant="filled" label="CVV" restrict="numeric" format-on="input" max-length="4" type="password" supporting-text="3 or 4 digits">
            <span slot="leading-icon" class="material-symbols-outlined">lock</span>
          </md-text-field>
          <md-text-field id="fmt-ssn" variant="filled" label="SSN" restrict="numeric" value="123456789" format-on="input" max-length="9" supporting-text="123-45-6789"></md-text-field>
          <md-text-field id="fmt-date" variant="outlined" label="Date" restrict="numeric" value="12252025" format-on="input" max-length="8" placeholder="MM/DD/YYYY" supporting-text="12/25/2025"></md-text-field>
          <md-text-field id="fmt-time" variant="filled" label="Time" restrict="numeric" value="1430" format-on="input" max-length="4" placeholder="HH:MM" supporting-text="14:30"></md-text-field>
          <md-text-field id="fmt-iban" variant="outlined" label="IBAN" value="DE89370400440532013000" format-on="input" restrict="alphanumeric" supporting-text="DE89 3704 0044 0532 0130 00"></md-text-field>
          <md-text-field id="fmt-zip" variant="filled" label="ZIP+4 Code" restrict="numeric" value="100011234" format-on="input" supporting-text="10001-1234"></md-text-field>
          <md-text-field id="fmt-ip" variant="outlined" label="IP Address" restrict="numeric" value="192168001001" format-on="input" supporting-text="192.168.001.001">
            <span slot="leading-icon" class="material-symbols-outlined">lan</span>
          </md-text-field>
          <md-text-field id="fmt-mac" variant="filled" label="MAC Address" restrict="[0-9a-fA-F]" value="AABBCCDDEEFF" format-on="input" supporting-text="AA:BB:CC:DD:EE:FF">
            <span slot="leading-icon" class="material-symbols-outlined">router</span>
          </md-text-field>
          <md-text-field id="fmt-uk-phone" variant="outlined" label="UK Phone" restrict="numeric" value="442079460958" format-on="input" supporting-text="+44 20 7946 0958">
            <span slot="leading-icon" class="material-symbols-outlined">call</span>
          </md-text-field>
        </div>
        <div style="display:flex; flex-direction:column; gap:24px; width:300px;">
          <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Text Transforms (format on blur)</h3>
          <md-text-field id="fmt-uppercase" variant="filled" label="UPPERCASE" value="hello world" supporting-text="HELLO WORLD"></md-text-field>
          <md-text-field id="fmt-lowercase" variant="outlined" label="lowercase" value="Hello World" supporting-text="hello world"></md-text-field>
          <md-text-field id="fmt-capitalize" variant="filled" label="Title Case" value="john doe smith" supporting-text="John Doe Smith"></md-text-field>
          <md-text-field id="fmt-sentence" variant="outlined" label="Sentence case" value="hello world. goodbye moon" supporting-text="Hello world. Goodbye moon"></md-text-field>
          <md-text-field id="fmt-slug" variant="filled" label="slug-case" value="Hello World Example" supporting-text="hello-world-example"></md-text-field>
          <md-text-field id="fmt-camel" variant="outlined" label="camelCase" value="get user name" supporting-text="getUserName"></md-text-field>
          <md-text-field id="fmt-snake" variant="filled" label="snake_case" value="Get User Name" supporting-text="get_user_name"></md-text-field>
          <md-text-field id="fmt-trim" variant="outlined" label="Trim Spaces" value="  too   many   spaces  " supporting-text="too many spaces"></md-text-field>
          <md-text-field id="fmt-email" variant="filled" label="Email Normalize" value="  John.Doe@Example.COM  " supporting-text="john.doe@example.com">
            <span slot="leading-icon" class="material-symbols-outlined">mail</span>
          </md-text-field>
          <md-text-field id="fmt-reverse" variant="outlined" label="Reverse Text" value="Hello World" supporting-text="dlroW olleH"></md-text-field>
        </div>
      </div>
    `;
  },
};

export const SpeechToText: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:320px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Internal (component manages recognition)</h3>
        <md-text-field
          variant="filled"
          label="${t(globals.locale, 'textfield.voiceSearch')}"
          speech-to-text="internal"
          supporting-text="${t(globals.locale, 'textfield.micSpeak')}"
        >
          <span slot="leading-icon" class="material-symbols-outlined">search</span>
        </md-text-field>
        <md-text-field
          variant="outlined"
          label="${t(globals.locale, 'textfield.dictation')}"
          speech-to-text="internal"
          multiline="auto-grow"
          supporting-text="Works with multiline too"
        ></md-text-field>
        <md-text-field
          variant="filled"
          label="German input"
          speech-to-text="internal"
          speech-lang="de-DE"
          supporting-text="speech-lang='de-DE'"
        ></md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:320px;" class="stt-external-col">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">External (consumer controls recognition)</h3>
        <md-text-field
          variant="filled"
          label="${t(globals.locale, 'textfield.voiceNote')}"
          speech-to-text="external"
          supporting-text="Consumer manages the Web Speech API"
        ></md-text-field>
        <md-text-field
          variant="outlined"
          label="With clear"
          speech-to-text="internal"
          clearable="internal"
          value="Try clearing or dictating"
        ></md-text-field>
        <div class="event-log" style="font-family:monospace; font-size:12px; color:#666; background:#f5f5f5; padding:12px; border-radius:8px; max-height:120px; overflow-y:auto;">
          Waiting for mdSpeechResult events...
        </div>
      </div>
    </div>
    <script type="module">
      requestAnimationFrame(() => {
        const col = document.querySelector('.stt-external-col');
        if (!col) return;
        const fields = col.querySelectorAll('md-text-field');
        const log = col.querySelector('.event-log');
        fields.forEach(field => {
          field.addEventListener('mdSpeechResult', (e) => {
            if (log.textContent === 'Waiting for mdSpeechResult events...') log.textContent = '';
            const time = new Date().toLocaleTimeString();
            const detail = e.detail;
            const entry = document.createElement('div');
            entry.textContent = '[' + time + '] listening=' + detail.listening + ' transcript="' + detail.transcript + '"';
            entry.style.animation = 'flash 0.5s ease';
            log.prepend(entry);
          });
        });
      });
    </script>
  `,

  /** External speech-to-text toggle contract, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const ext = await tfAt(canvasElement, 3); // filled, speech-to-text="external"
    const events: { transcript: string; listening: boolean }[] = [];
    ext.addEventListener('mdSpeechResult', (e) =>
      events.push((e as CustomEvent<{ transcript: string; listening: boolean }>).detail),
    );

    await step('External mic toggles the listening state and emits mdSpeechResult', async () => {
      const btn = speechBtn(ext);
      expect(btn.getAttribute('aria-pressed')).toBe('false');
      btn.click();
      await waitFor(() => expect(ext.classList.contains('md-text-field--listening')).toBe(true));
      await waitFor(() => expect(speechBtn(ext).getAttribute('aria-pressed')).toBe('true'));
      expect(events.at(-1)).toEqual({ transcript: '', listening: true }); // consumer notified it's on
      speechBtn(ext).click();
      await waitFor(() => expect(ext.classList.contains('md-text-field--listening')).toBe(false));
      await waitFor(() => expect(speechBtn(ext).getAttribute('aria-pressed')).toBe('false'));
      expect(events.at(-1)).toEqual({ transcript: '', listening: false }); // and off
    });
  },
};

export const Density: Story = {
  render: () => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Filled</h3>
        <md-text-field variant="filled" label="Default (56dp)" value="density 0"></md-text-field>
        <md-text-field variant="filled" label="Density -1 (52dp)" value="density -1" density="-1"></md-text-field>
        <md-text-field variant="filled" label="Density -2 (48dp)" value="density -2" density="-2"></md-text-field>
        <md-text-field variant="filled" label="Density -3 (44dp)" value="density -3" density="-3"></md-text-field>
        <md-text-field variant="filled" label="Density -4 (40dp)" value="density -4" density="-4"></md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Outlined</h3>
        <md-text-field variant="outlined" label="Default (56dp)" value="density 0"></md-text-field>
        <md-text-field variant="outlined" label="Density -1 (52dp)" value="density -1" density="-1"></md-text-field>
        <md-text-field variant="outlined" label="Density -2 (48dp)" value="density -2" density="-2"></md-text-field>
        <md-text-field variant="outlined" label="Density -3 (44dp)" value="density -3" density="-3"></md-text-field>
        <md-text-field variant="outlined" label="Density -4 (40dp)" value="density -4" density="-4"></md-text-field>
      </div>
    </div>
  `,
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Filled RTL</h3>
        <md-text-field variant="filled" label="بحث" value="مرحبا بالعالم">
          <span slot="leading-icon" class="material-symbols-outlined">search</span>
        </md-text-field>
        <md-text-field variant="filled" label="البريد الإلكتروني" value="user@example.com">
          <span slot="leading-icon" class="material-symbols-outlined">mail</span>
          <span slot="trailing-icon" class="material-symbols-outlined">cancel</span>
        </md-text-field>
        <md-text-field variant="filled" label="كلمة المرور" type="password" password-toggle="internal" value="s3cret!"></md-text-field>
        <md-text-field variant="filled" label="مسح" clearable="internal" value="نص للمسح">
          <span slot="leading-icon" class="material-symbols-outlined">search</span>
        </md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <h3 style="margin:0; font-family:sans-serif; font-size:14px; color:#666;">Outlined RTL</h3>
        <md-text-field variant="outlined" label="بحث" value="مرحبا بالعالم">
          <span slot="leading-icon" class="material-symbols-outlined">search</span>
        </md-text-field>
        <md-text-field variant="outlined" label="البريد الإلكتروني" value="user@example.com">
          <span slot="leading-icon" class="material-symbols-outlined">mail</span>
          <span slot="trailing-icon" class="material-symbols-outlined">cancel</span>
        </md-text-field>
        <md-text-field variant="outlined" label="كلمة المرور" type="password" password-toggle="internal" value="s3cret!"></md-text-field>
        <md-text-field variant="outlined" label="خطأ" error error-text="هذا الحقل مطلوب">
          <span slot="trailing-icon" class="material-symbols-outlined">error</span>
        </md-text-field>
      </div>
    </div>
  `,
};

export const DarkTheme: Story = {
  decorators: [
    (story) => {
      // scoped + cleaned up: leaving document-level dark state leaked into
      // every story visited afterwards. The ORIGINAL theme is captured once
      // per visit (a remount re-runs the decorator while dark is already
      // applied — re-capturing would restore 'dark' forever) and exactly one
      // cleanup is armed.
      const w = window as unknown as {
        __mdTfDarkOriginal?: string | null;
        __mdTfDarkArmed?: boolean;
        __STORYBOOK_ADDONS_CHANNEL__?: { once(evt: string, cb: (id: string) => void): void };
      };
      if (w.__mdTfDarkOriginal === undefined) {
        w.__mdTfDarkOriginal = document.documentElement.getAttribute('data-theme');
      }
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.style.backgroundColor = '#1C1B1F';
      if (!w.__mdTfDarkArmed) {
        w.__mdTfDarkArmed = true;
        queueMicrotask(() => {
          w.__STORYBOOK_ADDONS_CHANNEL__?.once('setCurrentStory', () => {
            const original = w.__mdTfDarkOriginal ?? null;
            delete w.__mdTfDarkOriginal;
            w.__mdTfDarkArmed = false;
            if (original) document.documentElement.setAttribute('data-theme', original);
            else document.documentElement.removeAttribute('data-theme');
            document.body.style.backgroundColor = '';
          });
        });
      }
      return story();
    },
  ],
  render: () => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; padding:16px;">
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <md-text-field variant="filled" label="Filled Dark"></md-text-field>
        <md-text-field variant="filled" label="Filled Populated" value="Hello"></md-text-field>
        <md-text-field variant="filled" label="Filled Error" error error-text="Error message"></md-text-field>
      </div>
      <div style="display:flex; flex-direction:column; gap:24px; width:280px;">
        <md-text-field variant="outlined" label="Outlined Dark"></md-text-field>
        <md-text-field variant="outlined" label="Outlined Populated" value="Hello"></md-text-field>
        <md-text-field variant="outlined" label="Outlined Error" error error-text="Error message"></md-text-field>
      </div>
    </div>
  `,
};

/* ─── Native form ──────────────────────────────────────── */

export const NativeForm: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'Form association via ElementInternals: values land in `FormData` under `name`, **Enter submits**, `required` blocks submission until filled, **Reset** restores initial values, and `<fieldset disabled>` propagates. Submit to see the serialized FormData.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <form
      id="tf-form"
      style="display: grid; gap: 16px; max-width: 420px;"
      @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        const data = new FormData(e.target as HTMLFormElement);
        const out = [...data.entries()].map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join('\n') || '(empty)';
        document.getElementById('tf-form-out')!.textContent = out;
      }}
    >
      <md-text-field name="user" label="${t(globals.locale, 'textfield.username')}" required supporting-text="Required — blocks submit when empty" value="ada"></md-text-field>
      <md-text-field name="email" label="${t(globals.locale, 'textfield.email')}" type="email" autocomplete="email" inputmode="email" supporting-text="type=email validity surfaces on the host"></md-text-field>
      <md-text-field name="pin" label="${t(globals.locale, 'textfield.pin')}" restrict="numeric" max-length="4" inputmode="numeric"></md-text-field>
      <fieldset style="border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); border-radius: 8px; padding: 12px;">
        <legend style="font: 12px system-ui; padding-inline: 4px;">
          <label style="display: inline-flex; align-items: center; gap: 6px;">
            <input type="checkbox" @change=${(e: Event) => {
              ((e.target as HTMLInputElement).closest('fieldset') as HTMLFieldSetElement).disabled = (e.target as HTMLInputElement).checked;
            }} /> disable fieldset
          </label>
        </legend>
        <md-text-field name="note" label="${t(globals.locale, 'textfield.note')}" value="inside a fieldset"></md-text-field>
      </fieldset>
      <div style="display: flex; gap: 10px;">
        <md-button type="submit" variant="filled">${t(globals.locale, 'submit')}</md-button>
        <md-button type="reset" variant="outlined">${t(globals.locale, 'textfield.reset')}</md-button>
      </div>
      <pre id="tf-form-out" role="log" aria-label="FormData output" style="min-height: 70px; padding: 12px; border-radius: 8px; background: color-mix(in srgb, currentColor 6%, transparent); font: 12px/1.7 ui-monospace, monospace;"></pre>
    </form>
  `,

  /** Enter-to-submit and reset-restores-defaults, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const user = await tfAt(canvasElement, 0); // name="user", required, value "ada"
    const out = canvasElement.querySelector('#tf-form-out') as HTMLElement;
    const form = canvasElement.querySelector('#tf-form') as HTMLFormElement;

    await step('Enter in a single-line field submits the owning form', async () => {
      inputOf(user).focus();
      expect(out.textContent).toBe('');
      key(inputOf(user), 'Enter');
      // requestSubmit fired the form's submit handler; user serialized into FormData
      await waitFor(() => expect(out.textContent).toContain('user = "ada"'));
    });

    await step('form.reset() restores each field to its default value', async () => {
      inputOf(user).focus();
      for (const ch of 'XY') typeChar(user, ch);
      await waitFor(() => expect(user.value).toBe('adaXY'));
      form.reset();
      await waitFor(() => expect(user.value).toBe('ada')); // formResetCallback restored the default
      expect(inputOf(user).value).toBe('ada');
    });

    // State-neutral reset: return to the resting render the VISUAL snapshot expects.
    // The submit handler populated #tf-form-out, and the last focus() left a ring on
    // the user field — clear both so the end state matches a fresh render.
    await step('reset to the clean resting state (state-neutral for VISUAL snapshots)', async () => {
      out.textContent = ''; // undo the FormData echo written by @submit
      inputOf(user).blur(); // drop the focus ring on the (shadow) input
      (document.activeElement as HTMLElement)?.blur(); // and any host-level active element
      await waitFor(() => {
        expect(out.textContent).toBe('');
        expect(user.value).toBe('ada');
      });
    });
  },
};

/* ─── Formatter & search behavior (interaction coverage) ─────────────── */

export const FormatterInteractions: Story = {
  parameters: { layout: 'padded' },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; padding:16px; width:320px;">
      <md-text-field id="fmt-blur-i" variant="outlined" label="Blur format"></md-text-field>
      <md-text-field id="fmt-live-i" variant="outlined" label="Live format" format-on="input"></md-text-field>
      <md-text-field id="fmt-fallback-i" variant="outlined" label="Live, no parser" format-on="input"></md-text-field>
    </div>
  `,

  /** Formatter/parser assignment via el.formatter, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const blur = await tfAt(canvasElement, 0);
    const live = await tfAt(canvasElement, 1);
    const fallback = await tfAt(canvasElement, 2);
    const group = (v: string) => v.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const digits = (v: string) => v.replace(/\D/g, '');

    await step('Blur formatter shows a grouped display at rest and the raw value on focus', async () => {
      (blur as any).value = '1234567';
      (blur as any).parser = digits;
      (blur as any).formatter = group;
      await waitFor(() => expect(inputOf(blur).value).toBe('1,234,567')); // formatted while resting
      inputOf(blur).focus();
      await waitFor(() => expect(inputOf(blur).value).toBe('1234567')); // raw for editing
      inputOf(blur).blur();
      await waitFor(() => expect(inputOf(blur).value).toBe('1,234,567')); // re-formatted on blur
      expect(blur.value).toBe('1234567'); // the submitted value stays raw
    });

    await step('Live formatter groups digits per keystroke while parsing back to a raw value', async () => {
      (live as any).parser = digits;
      (live as any).formatter = group;
      inputOf(live).focus();
      for (const ch of '1234') typeChar(live, ch);
      await waitFor(() => expect(inputOf(live).value).toBe('1,234')); // live grouping as typed
      expect(live.value).toBe('1234'); // parser strips the separators from the raw value
    });

    await step('format-on="input" without a parser safely falls back to blur formatting', async () => {
      (fallback as any).formatter = group; // no parser set on purpose
      inputOf(fallback).focus();
      for (const ch of '1234') typeChar(fallback, ch);
      await waitFor(() => expect(fallback.value).toBe('1234'));
      expect(inputOf(fallback).value).toBe('1234'); // NOT grouped while typing — live mode was refused
      inputOf(fallback).blur();
      await waitFor(() => expect(inputOf(fallback).value).toBe('1,234')); // formatted on blur instead
    });
  },
};

export const SearchBehavior: Story = {
  parameters: { layout: 'padded' },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; padding:16px; width:320px;">
      <md-text-field id="tf-debounced" variant="outlined" label="Debounced" debounce="80"></md-text-field>
      <md-text-field id="tf-throttled" variant="outlined" label="Throttled" throttle="80"></md-text-field>
    </div>
  `,

  /** Debounce/throttle emission of mdSearch, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const dbnc = await tfAt(canvasElement, 0);
    const thrl = await tfAt(canvasElement, 1);

    await step('Debounced mdSearch stays silent mid-typing and emits once after it settles', async () => {
      const hits: string[] = [];
      dbnc.addEventListener('mdSearch', (e) => hits.push((e as CustomEvent<string>).detail));
      inputOf(dbnc).focus();
      for (const ch of 'abc') typeChar(dbnc, ch);
      expect(hits.length).toBe(0); // window still open — nothing emitted yet
      await waitFor(() => expect(hits).toEqual(['abc']), { timeout: 2000 });
    });

    await step('Throttled mdSearch fires the leading value now and flushes the trailing one later', async () => {
      const hits: string[] = [];
      thrl.addEventListener('mdSearch', (e) => hits.push((e as CustomEvent<string>).detail));
      inputOf(thrl).focus();
      typeChar(thrl, 'x');
      await waitFor(() => expect(hits).toEqual(['x'])); // leading edge is immediate
      typeChar(thrl, 'y'); // inside the window → held pending
      typeChar(thrl, 'z');
      await waitFor(() => expect(hits).toEqual(['x', 'xyz']), { timeout: 2000 }); // trailing flush
    });
  },
};
