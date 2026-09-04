<!--
  The masthead. One per page — the host carries `role="banner"`.

  Not a single visible string is written here — `$t` resolves all of them,
  including the ones that look like constants (the brand name, the
  base-currency note). The reporting date is formatted through the translator's
  `formatDate`, which is pinned to `timeZone: 'UTC'`, so 2026-06-30 is 30 June
  in every locale and on every machine.

  The leading affordance toggles the rail between its collapsed and expanded
  variants. It lives HERE rather than in the rail's own `expandable` toggle for
  one reason: at compact width the rail is not rendered at all, and a control
  that vanishes with the surface it controls is fine, whereas two toggles for
  one thing is not. `mdLeadingClick` fires only for the prop-based button,
  which is exactly the one being used.

  The trailing slot is CAPPED AT THREE elements by the component (the fourth is
  hidden and warned about), and M3 wants it sparse. Two are used: the reporting
  context, and the account holder.
-->
<script lang="ts">
  import { getViewer } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';
  import { toggleRail } from '$lib/shell';
  import { compactNav } from '$lib/media';

  const viewer = getViewer();
  // The rail does not exist below 900px, so the button that toggles it is
  // not rendered there rather than left toggling nothing.
</script>

<md-app-bar
  class="shell__appbar"
  variant="small"
  subtitle={$t('social.app.title')}
  leading-icon={$compactNav ? undefined : 'menu'}
  leading-icon-label={$compactNav ? undefined : $t('social.nav.menu')}
  on:mdLeadingClick={toggleRail}
>
  <!--
    THE DISCLAIMER IS PART OF THE CHROME, not a footnote.

    Every proper noun in this app is invented — the bank, the merchants, the
    instruments, the account holder — and it is all presented in the shape of a real
    social app, which is exactly the combination a reader could
    mistake for one. So the disclaimer sits in the app bar, beside the brand it
    qualifies, visible on every screen rather than at the bottom of one.

    It goes in the `headline` SLOT rather than the `headline` prop because the
    two are alternatives, and the slot renders inside the same `part="title"`
    span the prop does — so the brand keeps the app bar's own title typography
    and the chip simply sits next to it.

    `md-tooltip` carries the full sentence, and the chip's own label already
    says the load-bearing part: the tooltip is elaboration, never the only
    place the disclaimer exists (a tooltip DESCRIBES, it does not name).
  -->
  <span slot="headline" class="shell__brand">
    {$t('social.app.brand')}
    <md-tooltip text={$t('social.app.demoNotice')}>
      <md-chip
        label={$t('social.app.demo')}
        appearance="outlined"
        color="warning"
        icon="science"
      ></md-chip>
    </md-tooltip>
  </span>

  <!-- WHO IS SIGNED IN, and nothing else. The three consoles put a reporting
       date and a base currency here because every figure on their screens is
       measured against those two facts. Nothing on these screens is: a feed is
       not "as of" anything, and the relative timestamps say when each post was
       without a reference date in the chrome. What DOES need saying is whose
       account this is. -->
  <div slot="trailing" class="shell__meta">
    <span>{viewer.displayName}</span>
    <span class="shell__handle">@{viewer.handle}</span>
  </div>
  <md-avatar
    slot="trailing"
    src={viewer.avatar}
    name={viewer.displayName}
    label={$t('social.app.viewer', { name: viewer.displayName })}
    size="small"
  ></md-avatar>
</md-app-bar>
