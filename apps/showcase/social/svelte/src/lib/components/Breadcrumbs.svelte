<!--
  The trail, with `mdSelect` intercepted for client-side routing.

  `mdSelect` is cancelable and bubbles from the item to the strip, so one
  listener on the strip is enough, and `preventDefault()` stops the anchor from
  doing a full page load. The crumbs still carry real, fully-prefixed hrefs,
  because a real href is what makes ⌘-click, middle-click and "copy link
  address" behave. `originalEvent` is the MouseEvent or KeyboardEvent that
  produced the selection, so one modifier check covers the Enter path too.
-->
<script lang="ts">
  import type { CrumbSpec } from '@awc-ui/showcase-kit/social';
  import { isPlainClick, navigate } from '$lib/router';
  import { withBase } from '$lib/routes';
  import { t } from '$lib/showcase';

  export let crumbs: CrumbSpec[] = [];

  function intercept(event: Event) {
    const detail = (
      event as CustomEvent<{ href?: string; originalEvent?: MouseEvent | KeyboardEvent }>
    ).detail;
    const href = detail?.href;
    if (!href) return;
    if (!isPlainClick(detail?.originalEvent)) return;
    event.preventDefault();
    navigate(href);
  }
</script>

<md-breadcrumbs
  label={$t('social.nav.breadcrumb')}
  max-items="4"
  items-before-collapse="1"
  items-after-collapse="2"
  on:mdSelect={intercept}
>
  {#each crumbs as crumb, index (`${crumb.labelKey ?? crumb.label}-${index}`)}
    <!-- The last crumb is the page you are already on, so it is never a link —
         md-breadcrumbs promotes it to `current` and gives it
         `aria-current="page"` itself. `crumbsFor` already returns a null href
         for every deep trail's tail; the overview's single crumb is the one
         case that would otherwise link to itself. -->
    <md-breadcrumb-item
      href={crumb.href && index < crumbs.length - 1 ? withBase(crumb.href) : undefined}
    >
      <!-- A crumb is either a translated label or a proper noun. The kit
           returns exactly one of the two and never a pre-translated string. -->
      {crumb.labelKey ? $t(crumb.labelKey) : crumb.label}
    </md-breadcrumb-item>
  {/each}
</md-breadcrumbs>
