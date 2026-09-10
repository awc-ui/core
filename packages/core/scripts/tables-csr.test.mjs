import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createCsrTestEnvironment, painted, until } from './lib/csr-test-environment.mjs';

// Property assignments match framework custom-element bindings. Keeping
// `column` absent from markup catches attribute-only parent coordination.
const environment = createCsrTestEnvironment();
await environment.define(['md-table', 'md-table-head', 'md-table-row', 'md-table-cell', 'md-table-sort-label']);
after(() => environment.close());

async function mountTable(t, sorted = {}) {
  const table = document.createElement('md-table');
  table.label = 'Instances';
  table.motion = 'none';
  Object.assign(table, sorted);
  const head = document.createElement('md-table-head');
  const row = document.createElement('md-table-row');
  const labels = {};
  const cells = {};
  for (const column of ['name', 'cpu']) {
    const cell = document.createElement('md-table-cell');
    cell.head = true;
    const label = document.createElement('md-table-sort-label');
    label.column = column;
    label.textContent = column === 'cpu' ? 'CPU' : 'Name';
    cells[column] = cell;
    labels[column] = label;
    cell.append(label);
    row.append(cell);
  }
  head.append(row);
  table.append(head);
  const changes = [];
  table.addEventListener('mdSortChange', (event) => changes.push(event.detail));
  document.body.append(table);
  t.after(() => table.remove());
  await until(() => table.classList.contains('hydrated') && Object.values(labels).every((label) => label.classList.contains('hydrated')));
  await painted();
  for (const label of Object.values(labels)) assert.equal(label.hasAttribute('column'), false, 'fixture must use property-only column bindings');
  return { table, labels, cells, changes };
}

function assertSortState({ labels, cells }, column, order) {
  for (const key of ['name', 'cpu']) {
    const active = key === column && order !== 'none';
    const currentOrder = active ? order : 'none';
    const label = labels[key];
    assert.equal(label.active, active, `${key}: active property`);
    assert.equal(label.order, currentOrder, `${key}: order property`);
    assert.equal(label.hasAttribute('active'), active, `${key}: reflected active`);
    assert.equal(label.getAttribute('order'), currentOrder, `${key}: reflected order`);
    assert.equal(cells[key].getAttribute('role'), 'columnheader');
    assert.equal(cells[key].getAttribute('aria-sort'), active ? order === 'asc' ? 'ascending' : 'descending' : 'none', `${key}: columnheader aria-sort`);
    const arrow = label.shadowRoot.querySelector('[part="icon"]');
    assert.ok(arrow);
    assert.equal(arrow.classList.contains('md-table-sort-label__icon--active'), active, `${key}: rendered active arrow`);
    assert.equal(arrow.classList.contains('md-table-sort-label__icon--desc'), active && order === 'desc', `${key}: rendered arrow direction`);
  }
}

test('property-only columns reflect an initially descending controlled sort', async (t) => {
  const fixture = await mountTable(t, { sortBy: 'cpu', sortOrder: 'desc' });
  assertSortState(fixture, 'cpu', 'desc');
  assert.deepEqual(fixture.changes, [], 'initial controlled state is not a user sort request');
});

test('property-only column clicks cycle asc/desc/none with matching arrow and accessibility state', async (t) => {
  const fixture = await mountTable(t);
  assertSortState(fixture, '', 'none');
  for (const order of ['asc', 'desc', 'none']) {
    fixture.labels.cpu.click();
    await painted();
    assert.equal(fixture.table.sortBy, order === 'none' ? '' : 'cpu');
    assert.equal(fixture.table.sortOrder, order === 'none' ? 'asc' : order);
    assertSortState(fixture, order === 'none' ? '' : 'cpu', order);
  }
  assert.deepEqual(fixture.changes, [
    { column: 'cpu', order: 'asc' }, { column: 'cpu', order: 'desc' }, { column: '', order: 'none' },
  ]);
});

test('programmatic sort and keyboard activation transfer the active arrow between property-only columns', async (t) => {
  const fixture = await mountTable(t);
  await fixture.table.setSort('cpu', 'desc');
  await painted();
  assertSortState(fixture, 'cpu', 'desc');
  fixture.labels.name.defaultOrder = 'desc';
  fixture.labels.name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
  await painted();
  assertSortState(fixture, 'name', 'desc');
  assert.deepEqual(fixture.changes, [{ column: 'cpu', order: 'desc' }, { column: 'name', order: 'desc' }]);
  fixture.table.sortBy = '';
  fixture.table.sortOrder = 'asc';
  await painted();
  assertSortState(fixture, '', 'none');
});
