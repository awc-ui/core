<script>
  import { tasks, statuses, statusByKey, priorityColor } from '$lib/data.js';
  import { notify } from '$lib/toast.js';

  let view = 'board';
  let selected = null;
  let sheetOpen = false;

  function onViewChange(e) {
    const [next] = e.detail;
    if (next) view = next;
  }

  function openTask(task) {
    selected = task;
    sheetOpen = true;
  }

  function onSheetClose() {
    sheetOpen = false;
  }

  function markDone() {
    if (selected) notify(`${selected.id} moved to Done`);
    sheetOpen = false;
  }

  function byStatus(key) {
    return tasks.filter((t) => t.status === key);
  }

  function checklistDone(task) {
    return task.checklist.filter((c) => c.done).length;
  }
</script>

<svelte:head>
  <title>Cairn — Tasks</title>
</svelte:head>

<main class="screen">
  <div class="screen-head">
    <div>
      <h1 class="screen-title">Tasks</h1>
      <p class="screen-sub">{tasks.length} open items in the Alpenglow 2.4 cycle</p>
    </div>
    <md-segmented-button-set aria-label="Task view" on:mdChange={onViewChange}>
      <md-segmented-button
        value="board"
        label="Board"
        icon="view_kanban"
        selected={view === 'board' ? true : undefined}
      ></md-segmented-button>
      <md-segmented-button
        value="list"
        label="List"
        icon="view_list"
        selected={view === 'list' ? true : undefined}
      ></md-segmented-button>
    </md-segmented-button-set>
  </div>

  {#if view === 'list'}
    <md-table-container>
      <md-table
        label="Tasks"
        column-template="minmax(240px, 2.2fr) 1.4fr 1fr 0.9fr 0.6fr 1fr"
        min-width="920px"
        hoverable
      >
        <md-table-head>
          <md-table-row rowgroup="head">
            <md-table-cell head scope="col">Task</md-table-cell>
            <md-table-cell head scope="col">Assignee</md-table-cell>
            <md-table-cell head scope="col">Status</md-table-cell>
            <md-table-cell head scope="col">Priority</md-table-cell>
            <md-table-cell head scope="col" numeric>Points</md-table-cell>
            <md-table-cell head scope="col">Due</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          {#each tasks as task (task.id)}
            <md-table-row value={task.id} class="task-row" on:click={() => openTask(task)}>
              <md-table-cell>
                <div class="task-cell">
                  <span class="task-id">{task.id}</span>
                  <span class="task-title">{task.title}</span>
                </div>
              </md-table-cell>
              <md-table-cell>
                <div class="assignee-cell">
                  <md-avatar size="small" name={task.assignee}></md-avatar>
                  <span>{task.assignee}</span>
                </div>
              </md-table-cell>
              <md-table-cell>
                <md-chip
                  appearance="filled"
                  color={statusByKey[task.status].color}
                  label={statusByKey[task.status].label}
                ></md-chip>
              </md-table-cell>
              <md-table-cell>
                <md-chip
                  appearance="outlined"
                  color={priorityColor[task.priority]}
                  label={task.priority}
                ></md-chip>
              </md-table-cell>
              <md-table-cell numeric>{task.points}</md-table-cell>
              <md-table-cell>{task.due}</md-table-cell>
            </md-table-row>
          {/each}
        </md-table-body>
      </md-table>
    </md-table-container>
  {:else}
    <div class="board">
      {#each statuses as column (column.key)}
        <section class="board-col" aria-label={column.label}>
          <header class="board-col-head">
            <span class="board-col-title">{column.label}</span>
            <span class="board-col-count">{byStatus(column.key).length}</span>
          </header>
          <div class="board-col-cards">
            {#each byStatus(column.key) as task (task.id)}
              <md-card variant="outlined" interactive on:mdClick={() => openTask(task)}>
                <div class="board-card">
                  <div class="board-card-top">
                    <span class="task-id">{task.id}</span>
                    <md-chip
                      appearance="outlined"
                      color={priorityColor[task.priority]}
                      label={task.priority}
                      density="-2"
                    ></md-chip>
                  </div>
                  <span class="board-card-title">{task.title}</span>
                  <div class="board-card-bottom">
                    <md-avatar size="small" name={task.assignee} label={task.assignee}></md-avatar>
                    <span class="board-card-meta">{task.points} pts · due {task.due}</span>
                  </div>
                </div>
              </md-card>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</main>

<md-side-sheet
  variant="modal"
  side="end"
  headline={selected ? `${selected.id} · ${selected.title}` : 'Task detail'}
  open={sheetOpen ? true : undefined}
  on:mdClose={onSheetClose}
>
  {#if selected}
    {#key selected.id}
      <md-tabs id="task-detail-tabs" aria-label="Task detail sections" active-tab-index="0">
        <md-tab label="Details"></md-tab>
        <md-tab label="Checklist" badge={String(checklistDone(selected))}></md-tab>
        <md-tab label="Activity"></md-tab>
      </md-tabs>
      <md-tab-panels for="task-detail-tabs">
        <md-tab-panel>
          <div class="sheet-section">
            <div class="chip-row">
              <md-chip
                appearance="filled"
                color={statusByKey[selected.status].color}
                label={statusByKey[selected.status].label}
              ></md-chip>
              <md-chip
                appearance="outlined"
                color={priorityColor[selected.priority]}
                label={`${selected.priority} priority`}
              ></md-chip>
              <md-chip appearance="outlined" label={`${selected.points} points`}></md-chip>
            </div>
            <p class="sheet-desc">{selected.description}</p>
            <md-divider></md-divider>
            <dl class="fact-list">
              <div class="fact">
                <dt>Assignee</dt>
                <dd>
                  <div class="assignee-cell">
                    <md-avatar size="small" name={selected.assignee}></md-avatar>
                    <span>{selected.assignee}</span>
                  </div>
                </dd>
              </div>
              <div class="fact">
                <dt>Due date</dt>
                <dd>{selected.due}</dd>
              </div>
              <div class="fact">
                <dt>Sprint</dt>
                <dd>Sprint 14 — Ridgeline</dd>
              </div>
            </dl>
          </div>
        </md-tab-panel>
        <md-tab-panel>
          <div class="sheet-section">
            <p class="sheet-hint">
              {checklistDone(selected)} of {selected.checklist.length} steps complete
            </p>
            <md-progress-indicator
              variant="linear"
              value={checklistDone(selected)}
              max={selected.checklist.length}
              label="Checklist completion"
            ></md-progress-indicator>
            <md-list>
              {#each selected.checklist as item, i (i)}
                <md-list-item
                  headline={item.label}
                  leading-icon={item.done ? 'check_circle' : 'radio_button_unchecked'}
                  supporting-text={item.done ? 'Complete' : 'Open'}
                  lines="2"
                ></md-list-item>
              {/each}
            </md-list>
          </div>
        </md-tab-panel>
        <md-tab-panel>
          <div class="sheet-section">
            <md-list>
              {#each selected.activity as entry, i (i)}
                <md-list-item
                  headline={entry.what}
                  supporting-text={`${entry.who} · ${entry.when}`}
                  leading-avatar-name={entry.who}
                  lines="2"
                ></md-list-item>
              {/each}
            </md-list>
          </div>
        </md-tab-panel>
      </md-tab-panels>
    {/key}
  {/if}
  <md-button slot="actions" variant="text" on:mdClick={() => (sheetOpen = false)}>Close</md-button>
  <md-button slot="actions" variant="filled" on:mdClick={markDone}>Mark done</md-button>
</md-side-sheet>

<style>
  .screen {
    padding: var(--md-sys-spacing-inset-xl);
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-gap-lg);
    max-inline-size: 1240px;
    margin-inline: auto;
  }

  .screen-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--md-sys-spacing-gap-lg);
    flex-wrap: wrap;
  }

  .screen-title {
    margin: 0;
    font: var(--md-sys-typescale-headline-medium-font);
  }

  .screen-sub {
    margin: 4px 0 0;
    color: var(--md-sys-color-on-surface-variant);
    font: var(--md-sys-typescale-body-medium-font);
  }

  .task-row {
    cursor: pointer;
  }

  .task-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .task-id {
    font: var(--md-sys-typescale-label-small-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .task-title {
    font: var(--md-sys-typescale-body-medium-font);
  }

  .assignee-cell {
    display: flex;
    align-items: center;
    gap: var(--md-sys-spacing-gap-sm);
  }

  .board {
    display: grid;
    grid-template-columns: repeat(4, minmax(220px, 1fr));
    gap: var(--md-sys-spacing-gap-md);
    align-items: start;
    overflow-x: auto;
  }

  .board-col {
    background: var(--md-sys-color-surface-container-low);
    border-radius: var(--md-sys-shape-corner-medium);
    padding: var(--md-sys-spacing-inset-sm);
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-gap-sm);
  }

  .board-col-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--md-sys-spacing-inset-xs) var(--md-sys-spacing-inset-sm);
  }

  .board-col-title {
    font: var(--md-sys-typescale-title-small-font);
  }

  .board-col-count {
    display: grid;
    place-items: center;
    min-inline-size: 24px;
    block-size: 24px;
    border-radius: var(--md-sys-shape-corner-full);
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface-variant);
    font: var(--md-sys-typescale-label-medium-font);
  }

  .board-col-cards {
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-gap-sm);
  }

  .board-card {
    padding: var(--md-sys-spacing-inset-md);
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-gap-sm);
  }

  .board-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--md-sys-spacing-gap-sm);
  }

  .board-card-title {
    font: var(--md-sys-typescale-body-medium-font);
  }

  .board-card-bottom {
    display: flex;
    align-items: center;
    gap: var(--md-sys-spacing-gap-sm);
  }

  .board-card-meta {
    font: var(--md-sys-typescale-label-medium-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .sheet-section {
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-gap-md);
    padding-block: var(--md-sys-spacing-inset-md);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--md-sys-spacing-gap-sm);
  }

  .sheet-desc {
    margin: 0;
    font: var(--md-sys-typescale-body-medium-font);
    color: var(--md-sys-color-on-surface);
  }

  .sheet-hint {
    margin: 0;
    font: var(--md-sys-typescale-label-large-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .fact-list {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--md-sys-spacing-gap-md);
  }

  .fact {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--md-sys-spacing-gap-md);
  }

  .fact dt {
    font: var(--md-sys-typescale-label-large-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .fact dd {
    margin: 0;
    font: var(--md-sys-typescale-body-medium-font);
  }

  @media (max-width: 960px) {
    .board {
      grid-template-columns: repeat(2, minmax(220px, 1fr));
    }
  }

  @media (max-width: 560px) {
    .board {
      grid-template-columns: 1fr;
    }
  }
</style>
