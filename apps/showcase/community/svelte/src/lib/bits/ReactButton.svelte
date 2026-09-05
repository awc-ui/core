<!--
  The react button and its six-option picker.

  OPENS ON HOVER WITH A POINTER, ON PRESS EVERYWHERE. The CSS handles hover and
  focus; this component only holds the pressed state, which is what a touch
  reader and a keyboard reader both get.

  PRESSING THE MAIN BUTTON TOGGLES `like` rather than opening the picker: the
  common case is one press for the default reaction, and making that press open
  a menu puts a second decision in front of the thing people actually want.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    REACTIONS,
    reactionIcon,
    reactionTone,
    type ReactionKind,
  } from '@awc-ui/showcase-kit/community';
  import { t } from '$lib/showcase';

  export let mine: ReactionKind | null;
  const dispatch = createEventDispatcher<{ pick: ReactionKind | null }>();
  let open = false;

  function choose(kind: ReactionKind) {
    dispatch('pick', mine === kind ? null : kind);
    open = false;
  }
</script>

<span class="react">
  <!--
    `|| undefined` on the boolean-ish attributes.

    Svelte's `set_custom_element_data` writes an attribute for any value that is
    not null/undefined — so a literal `false` would render `data-on="false"`,
    and presence is what these mean. `undefined` is what removes it, which is
    the same rule React and Vue follow here for the same reason: the five builds
    must agree on the DOM for an unselected control.
  -->
  <md-button
    class="react__main"
    variant="text"
    icon={reactionIcon[mine ?? 'like']}
    color={mine ? reactionTone[mine] : undefined}
    data-on={mine ? '' : undefined}
    aria-label={$t(mine ? `community.reaction.${mine}` : 'community.reaction.none')}
    on:mdClick={() => dispatch('pick', mine ? null : 'like')}
  >
    {$t(`community.reaction.${mine ?? 'like'}`)}
  </md-button>

  <span
    class="react__picker"
    data-open={open ? '' : undefined}
    role="group"
    aria-label={$t('community.reaction.pick')}
  >
    {#each REACTIONS as kind (kind)}
      <button
        type="button"
        class="react__option"
        data-tone={reactionTone[kind]}
        data-reaction={kind}
        data-on={mine === kind ? '' : undefined}
        aria-pressed={mine === kind}
        aria-label={$t(`community.reaction.${kind}`)}
        on:click={() => choose(kind)}
      >
        <span class="material-symbols-outlined" aria-hidden="true">{reactionIcon[kind]}</span>
      </button>
    {/each}
  </span>

  <!-- The touch path. `pointer: coarse` hides the hover affordance, so this is
       the only way in on a phone — a real button with a name rather than a
       long-press nobody can discover. -->
  <md-icon-button
    class="react__toggle"
    icon="add_reaction"
    aria-label={$t('community.reaction.pick')}
    aria-expanded={open}
    on:mdClick={() => (open = !open)}
  ></md-icon-button>
</span>
