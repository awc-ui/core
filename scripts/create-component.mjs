#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkEnvironment } from './check-environment.mjs';

export function componentFiles(tag) {
  if (!/^md-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(tag)) {
    throw new Error('Use a lowercase custom-element name such as md-my-component.');
  }
  const className = tag.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
  const componentDir = `packages/core/src/components/${tag}`;
  return new Map([
    [`${componentDir}/${tag}.tsx`, `import { Component, Event, EventEmitter, h, Host, Prop } from '@stencil/core';

/** An action control. Replace this description with the agreed component contract.
 * @slot - A visible text label. Do not slot other interactive controls.
 * @part control - The native button.
 */
@Component({ tag: '${tag}', styleUrl: '${tag}.css', shadow: true })
export class ${className} {
  /** Prevents activation and removes the control from keyboard navigation. */
  @Prop({ reflect: true }) disabled = false;
  /** Density adjustment from 0 to -4. */
  @Prop({ reflect: true }) density = 0;
  /** Fired when the user activates the control with pointer, Enter, or Space. */
  @Event() mdAction!: EventEmitter<void>;

  private handleClick = () => {
    if (!this.disabled) this.mdAction.emit();
  };

  render() {
    return (
      <Host style={{ '--_density': String(Math.max(-4, Math.min(0, this.density))) }}>
        <button type="button" part="control" disabled={this.disabled} onClick={this.handleClick}>
          <slot />
        </button>
      </Host>
    );
  }
}
`],
    [`${componentDir}/${tag}.css`, `:host {
  display: inline-block;
}

button {
  min-block-size: max(24px, calc(40px + var(--_density, 0) * 4px));
  padding-inline: 24px;
  border: 0;
  border-radius: var(--md-sys-shape-corner-full, 9999px);
  background: var(--md-sys-color-primary, #6750a4);
  color: var(--md-sys-color-on-primary, #fff);
  font: inherit;
  cursor: pointer;
  transition: box-shadow var(--md-sys-motion-duration-short2, 100ms)
    var(--md-sys-motion-easing-standard, cubic-bezier(0.2, 0, 0, 1));
}

button:hover:not(:disabled) {
  box-shadow: inset 0 0 0 100vmax color-mix(in srgb, currentColor 8%, transparent);
}

button:active:not(:disabled) {
  box-shadow: inset 0 0 0 100vmax color-mix(in srgb, currentColor 12%, transparent);
}

button:focus-visible {
  outline: 3px solid var(--md-sys-color-secondary, #625b71);
  outline-offset: 3px;
}

button:disabled {
  opacity: 0.38;
  cursor: default;
}

@media (prefers-reduced-motion: reduce) {
  button { transition: none; }
}
`],
    [`${componentDir}/${tag}.spec.ts`, `import { newSpecPage } from '@stencil/core/testing';
import { ${className} } from './${tag}';

describe('${tag}', () => {
  it('uses a native button and emits the action', async () => {
    const page = await newSpecPage({ components: [${className}], html: '<${tag}>Activate</${tag}>' });
    const action = jest.fn();
    page.root!.addEventListener('mdAction', action);
    const button = page.root!.shadowRoot!.querySelector('button')!;
    expect(button.type).toBe('button');
    button.click();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('disables the native control and rejects activation', async () => {
    const page = await newSpecPage({ components: [${className}], html: '<${tag} disabled>Activate</${tag}>' });
    const action = jest.fn();
    page.root!.addEventListener('mdAction', action);
    const button = page.root!.shadowRoot!.querySelector('button')!;
    expect(button.disabled).toBe(true);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(action).not.toHaveBeenCalled();
  });
});
`],
    [`${componentDir}/${tag}.e2e.ts`, `import { newE2EPage } from '@stencil/core/testing';

describe('${tag}', () => {
  it('activates once with Enter and Space and respects disabled', async () => {
    const page = await newE2EPage();
    await page.setContent('<${tag}>Activate</${tag}>');
    const host = await page.find('${tag}');
    const button = await page.find('${tag} >>> button');
    const action = await host.spyOnEvent('mdAction');
    await button.focus();
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(action).toHaveReceivedEventTimes(1);
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(action).toHaveReceivedEventTimes(2);
    await host.setProperty('disabled', true);
    await page.waitForChanges();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(action).toHaveReceivedEventTimes(2);
  });
});
`],
    [`${componentDir}/readme.md`, `# ${tag}

<!-- llm:meta
tag: ${tag}
category: actions
status: draft
form-associated: false
-->

Describe the agreed purpose before proposing this component for release.

## When to use

Use for the component's agreed action. The scaffold uses a native button so pointer, Enter and Space share activation behavior.

## When NOT to use

Use a link for navigation. Do not slot other interactive controls inside this button.

## API contract

- \`disabled\`: prevents activation and keyboard focus.
- \`density\`: 0 to -4; adjusts the control height.
- \`mdAction\`: emitted once for activation; no detail payload.
- Default slot: a visible text label.
- \`control\` part: the internal native button.

## Example

\`\`\`html
<${tag}>Activate</${tag}>
\`\`\`

## Accessibility

The native button provides keyboard handling, semantics and disabled behavior. Keep a visible label and focus indication. Add component-specific interaction, RTL and layout tests before release.
`],
    [`apps/storybook/src/stories/${className}.stories.ts`, `import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';

const meta: Meta = {
  title: 'Actions/${className.slice(2)}',
  component: '${tag}',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = { render: () => html\`<${tag}>Activate</${tag}>\` };
export const Disabled: Story = { render: () => html\`<${tag} disabled>Activate</${tag}>\` };
`],
  ]);
}

export function createComponent(tag, { root, dryRun = false }) {
  const files = componentFiles(tag);
  const existing = [...files.keys()].find(name => existsSync(resolve(root, name)));
  if (existing) throw new Error(`Refusing to overwrite ${existing}. Choose a new component name.`);
  if (!dryRun) {
    for (const [name, content] of files) {
      const path = resolve(root, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, { flag: 'wx' });
    }
  }
  return [...files.keys()];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkEnvironment();
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.length === 0) {
      console.log('Usage: pnpm generate:component md-my-component [--dry-run]\nCreates an action-control scaffold with native keyboard behavior, tests, manual and Storybook stories.');
    } else {
      if (args.some(arg => arg.startsWith('--') && arg !== '--dry-run') || args.filter(arg => !arg.startsWith('--')).length !== 1) throw new Error('Expected one component name and optional --dry-run.');
      const dryRun = args.includes('--dry-run');
      const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
      const files = createComponent(args.find(arg => !arg.startsWith('--')), { root, dryRun });
      console.log(`${dryRun ? 'Would create' : 'Created'}:\n${files.join('\n')}\nAdapt the action scaffold to the agreed component API; add a bundle budget and changeset before release.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
