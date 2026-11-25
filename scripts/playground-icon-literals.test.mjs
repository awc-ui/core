import assert from 'node:assert/strict';
import test from 'node:test';
import { extractRuntimeIconLiterals } from './playground-icon-literals.mjs';

test('finds Core icon literals in branches, template strings, JSX text and object keys', () => {
  const source = [
    "/* 'history_toggle_off' */",
    "const icon = expanded ? 'menu_open' : 'menu';",
    "const direction = `chevron_${rtl ? 'left' : 'right'}`;",
    "const status = `priority_high`;",
    "const icons = { calendar_today: true, 'drag_indicator': true };",
    String.raw`const escaped = '\u0076isibility_off';`,
    String.raw`const codepoint = '\u{E5CF}';`,
    "const controls = <><i icon='arrow&#95;drop_down'>arrow&#x5f;drop_up</i><i> cancel </i></>;",
  ].join('\n');

  assert.deepEqual(extractRuntimeIconLiterals('fixture.tsx', source), {
    names: [
      'arrow_drop_down', 'arrow_drop_up', 'calendar_today', 'cancel', 'chevron_left', 'chevron_right',
      'drag_indicator', 'left', 'menu', 'menu_open', 'priority_high', 'right', 'visibility_off',
    ],
    codepoints: [0xe5cf],
  });
});

test('decodes CSS font content and excludes CSS comments', () => {
  const source = String.raw`
    /* .unused::before { content: 'history_toggle_off'; } */
    .caret { --fallback-icon: 'arrow_drop_down'; }
    .close::before { content: '\63 lose'; }
    .codepoint::after { content: '\e5cf'; }
  `;

  assert.deepEqual(extractRuntimeIconLiterals('fixture.css', source), {
    names: ['arrow_drop_down', 'close'],
    codepoints: [0xe5cf],
  });
});
