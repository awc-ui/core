import { Build } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { MdAutocomplete } from '../components/md-autocomplete/md-autocomplete';
import { MdMultiSelect } from '../components/md-multi-select/md-multi-select';

const variants = [
  ['md-multi-select', MdMultiSelect, ''],
  ['md-autocomplete', MdAutocomplete, 'multiple'],
] as const;
const values = ['missing', 'disabled', 'available'];
const attr = 'data-awc-initial-values';

describe.each(variants)('%s SSR values', (tag, component, mode) => {
  const create = (flushQueue = true) => newSpecPage({
    components: [component],
    html: `<${tag} ${mode} ${attr}='${JSON.stringify(values)}' options='[{"value":"disabled","disabled":true},{"value":"available"}]'></${tag}>`,
    flushQueue,
  });

  it('restores server values in the supplied order, including disabled and unresolved options', async () => {
    const page = await create();
    expect(page.rootInstance.value).toEqual(values);
    expect(page.root!.hasAttribute(attr)).toBe(true);
  });

  it('uses a client seed once and preserves an explicit empty assignment before load', async () => {
    const browser = jest.replaceProperty(Build, 'isBrowser', true);
    try {
      const hydrated = await create();
      expect(hydrated.rootInstance.value).toEqual(values);
      expect(hydrated.root!.hasAttribute(attr)).toBe(false);

      const client = await create(false);
      const element = client.body.querySelector(tag)!;
      element.value = [];
      await client.waitForChanges();
      expect(element.value).toEqual([]);
      expect(element.hasAttribute(attr)).toBe(false);
      element.remove();
      client.body.appendChild(element);
      await client.waitForChanges();
      expect(element.value).toEqual([]);
    } finally {
      browser.restore();
    }
  });
});
