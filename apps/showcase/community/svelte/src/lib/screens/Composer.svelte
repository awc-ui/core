<!-- IT IS A TRIGGER UNTIL IT IS PRESSED, which is why this vertical has no
     Create destination: a permanently-open textarea costs 180px at the top of
     every visit to the feed, and the reader came for the feed. -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    AUDIENCES,
    audienceIcon,
    type Audience,
    type Person,
  } from '@awc-ui/showcase-kit/community';
  import Avatar from '$lib/bits/Avatar.svelte';
  import { t } from '$lib/showcase';

  export let viewer: Person;
  const dispatch = createEventDispatcher<{
    message: { key: string | null; params?: Record<string, string | number> };
  }>();

  let open = false;
  let body = '';
  let audience: Audience = 'friends';

  $: spec = AUDIENCES.find((a) => a.value === audience);
  $: firstName = viewer.displayName.split(' ')[0];

  function onInput(event: Event) {
    body = String((event as CustomEvent<string>).detail ?? '');
  }

  function post() {
    if (body.trim() === '') {
      dispatch('message', { key: 'community.hint.needBody' });
      return;
    }
    dispatch('message', { key: 'community.msg.posted' });
    body = '';
    open = false;
  }
</script>

{#if !open}
  <div class="composer">
    <Avatar person={viewer} size="medium" />
    <!-- A BUTTON, not a read-only field styled as one: a field would take focus
         and accept typing that goes nowhere until the real composer opens. -->
    <button type="button" class="composer__trigger" on:click={() => (open = true)}>
      {$t('community.action.writeSomething', { name: firstName })}
    </button>
  </div>
{:else}
  <div class="composer__open">
    <div class="composer">
      <Avatar person={viewer} size="medium" />
      <span class="post-card__names">
        <span class="post-card__name">{viewer.displayName}</span>
        <span class="post-card__meta">
          <span class="material-symbols-outlined" aria-hidden="true">{audienceIcon[audience]}</span>
          {spec ? $t(spec.labelKey) : ''}
        </span>
      </span>
    </div>

    <md-text-field
      variant="outlined"
      label={$t('community.panel.compose')}
      value={body}
      multiline="auto-grow"
      rows="3"
      full-width
      on:mdInput={onInput}
    ></md-text-field>

    <div class="composer__foot">
      {#each AUDIENCES as option (option.value)}
        <md-chip
          variant="filter"
          appearance="outlined"
          icon={audienceIcon[option.value]}
          label={$t(option.labelKey)}
          selected={audience === option.value || undefined}
          on:click={() => (audience = option.value)}
        ></md-chip>
      {/each}
      <span class="composer__spacer" />
      <md-button
        variant="text"
        on:mdClick={() => {
          open = false;
          body = '';
        }}
      >
        {$t('community.action.cancel')}
      </md-button>
      <md-button
        variant="filled"
        icon="send"
        soft-disabled={body.trim() === '' || undefined}
        on:mdClick={post}
      >
        {$t('community.action.post')}
      </md-button>
    </div>
  </div>
{/if}
