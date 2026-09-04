<!--
  An avatar, with the story ring when there is a story behind it.

  THE RING IS A CLASS, NOT A BORDER PROP. `md-avatar` has no ring of its own,
  and giving it one with a `style` attribute would be refused outright by the
  deployed Content-Security-Policy (`style-src-attr 'none'`). So the state goes
  on a wrapping span as a data attribute and `app.css` draws the ring, which
  also lets the unseen and seen rings differ by more than colour.
-->
<script lang="ts">
  import type { Person } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';

  export let person: Person;
  export let size: 'small' | 'medium' | 'large' = 'small';
  export let ring = false;

  $: state = !ring ? 'none' : person.storyUnseen ? 'unseen' : person.hasStory ? 'seen' : 'none';
</script>

<span class="avatar" data-ring={state}>
  <!-- `label` is the accessible name and `alt` the image's own. Both are set:
       the avatar usually sits inside a link whose text already names the
       person, but the picture is generated portrait artwork and naming it is
       convention 5 in the kit. -->
  <md-avatar
    src={person.avatar}
    name={person.displayName}
    initials={person.initials}
    {size}
    label={person.displayName}
    alt={$t('social.alt.arcs')}
  ></md-avatar>
  {#if state !== 'none'}
    <span class="visually-hidden">
      {$t(state === 'unseen' ? 'social.hint.storyUnseen' : 'social.hint.storySeen')}
    </span>
  {/if}
</span>
