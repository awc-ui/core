<!--
  Nothing here — the shared body of every "this does not exist" screen.

  TWO CALLERS, AND THE DIFFERENCE BETWEEN THEM MATTERS.

  - `NotFoundScreen` — the path matched none of the six patterns. It slots a link
    back to the overview in, because there is nowhere else to go from a URL that
    means nothing.
  - The three drill screens, when the id is not in the fixture
    (`/sectors/banana/`). They slot nothing: the breadcrumb trail is already on
    screen and already points back up the path, so a second link would only say
    it again.

  Either way this renders INSIDE `Shell`, so the masthead, the section nav and
  the dock survive and the reader is somewhere they can leave from — rather than
  a bare message on an empty document.

  Not one string is written here: `empty.generic` and `empty.hint` are already in
  the kit's dictionary in all three locales, and this build must not need a key
  its siblings do not have.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';
import Shell from '../Shell.vue';
import Panel from '../Panel.vue';

const t = useT();
</script>

<template>
  <Shell :title="t('empty.generic')" :subtitle="t('empty.hint')">
    <Panel>
      <p class="muted">{{ t('empty.generic') }}</p>
      <slot />
    </Panel>
  </Shell>
</template>
