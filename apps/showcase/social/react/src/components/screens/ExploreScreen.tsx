/**
 * Explore — everything on Lyra, as a grid.
 *
 * A MASONRY-ISH GRID WITHOUT MASONRY. One in seven tiles spans two columns and
 * two rows, which is what stops a uniform grid reading as a contact sheet. The
 * span comes from the kit (`ExploreTile.span`) and is derived from the post's
 * INDEX rather than drawn at random, so all five builds lay out identically —
 * a parity check that compared a randomised layout would compare nothing.
 *
 * EVERY TILE IS SQUARE-CROPPED, whatever the picture's own ratio. That is the
 * one place this app deliberately throws away the aspect ratio it is otherwise
 * so careful about: a grid whose cells were 1:1, 4:5 and 16:9 is not a grid.
 * `object-fit: cover` does the crop, and the full ratio is restored the moment
 * the reader opens the post.
 *
 * THE SEARCH MATCHES PEOPLE, NOT CAPTIONS, and the field says so. The kit's
 * note on `PostQuery.search` explains why: a selector cannot see the
 * dictionary, so a caption search would work in English and silently return
 * nothing in Arabic.
 */

import { useMemo, useRef, useState } from 'react';
import { exploreTiles, getTotals, topicFacets } from '@awc-ui/showcase-kit/social';
import { useT } from '@/lib/showcase';
import { useCustomEvent } from '@/components/elements';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { Count, Media, TopicChip } from '@/components/bits';
import { PanelSkeleton } from '@/components/skeletons';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { postKindIcon } from '@awc-ui/showcase-kit/social';

export function ExploreScreen() {
  const t = useT();
  const totals = getTotals();

  const [topic, setTopic] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const facets = useMemo(() => topicFacets(search || undefined), [search]);
  const tiles = useMemo(
    () => exploreTiles(topic ?? undefined, search || undefined),
    [topic, search],
  );

  const searchRef = useRef<HTMLElement | null>(null);
  /* `md-search` carries `{ value }` on every one of its events — unlike
     `md-text-field`, whose `mdInput` detail IS the bare string. Different
     components, different shapes; assuming one from the other has cost this
     repo two silent bugs. `mdSearch` rather than `mdInput` because it is
     debounced and distinct-until-changed. */
  useCustomEvent<CustomEvent<{ value: string }>>(searchRef, 'mdSearch', (event) =>
    setSearch(event.detail.value ?? ''),
  );

  const facetRef = useRef<HTMLDivElement | null>(null);
  useCustomEvent<CustomEvent<{ selected: boolean }>>(facetRef, 'mdSelect', (event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.topic;
    if (!value) return;
    setTopic(event.detail.selected ? value : null);
  });

  const filtered = topic !== null || search !== '';

  return (
    <Screen
      title={t('social.screen.explore.title')}
      subtitle={t('social.screen.explore.subtitle')}
      aside={<Count value={tiles.length} />}
      skeleton={<PanelSkeleton height="720px" />}
    >
      <Panel title={t('social.panel.topics')}>
        <div className="stack">
          {/* `trigger="bar"` and `full-width`: the default trigger is an icon
              that opens the field, which in a filter panel renders as a lone
              magnifying glass and reads as broken. */}
          {/* The wrapper is what makes it fill the panel: `md-search` carries a
              360px minimum and centres itself in a wider parent, so `full-width`
              alone left it marooned in the middle of the card. */}
          <div className="explore-search">
            <md-search
              ref={searchRef}
              layout="docked"
              trigger="bar"
              variant="contained"
              full-width
              debounce="250"
              label={t('social.action.search')}
              placeholder={t('social.count.people')}
              value={search}
            />
          </div>

          <div className="facet-row" ref={facetRef}>
            {facets.map((facet) => (
              <TopicChip key={facet.id} id={facet.id} selected={topic === facet.id} />
            ))}
          </div>

          <div className="row row--between facet-foot">
            <span className="muted">
              {t('social.common.showing', { shown: tiles.length, total: totals.feedCount })}
            </span>
            {/* The reset exists only while there is something to reset; a
                permanently-inert control in a filter bar is furniture. */}
            {filtered ? (
              <md-button
                variant="text"
                size="sm"
                icon="restart_alt"
                onClick={() => {
                  setTopic(null);
                  setSearch('');
                }}
              >
                {t('social.action.clearFilters')}
              </md-button>
            ) : null}
          </div>
        </div>
      </Panel>

      {tiles.length === 0 ? (
        <EmptyState message={t('social.empty.explore')} hint={t('social.empty.exploreHint')} />
      ) : (
        <ul className="explore-grid">
          {tiles.map(({ post, author, span }) => {
            const badge = postKindIcon[post.kind];
            return (
              <li key={post.id} className="explore-tile" data-span={span === 2 ? '2' : undefined}>
                <Link
                  className="explore-tile__link"
                  href={route.post(post.id)}
                  /* The link's accessible name is the picture's alt plus whose
                     it is — "Abstract artwork: layered dunes, by Ada
                     Lindqvist". A grid of forty links all named "Post" is a
                     grid a screen reader cannot navigate. */
                  aria-label={`${t(post.media[0].altKey)} — ${author.displayName}`}
                >
                  <Media media={post.media[0]} className="explore-tile__img" />
                  {badge ? (
                    <span className="explore-tile__badge on-media material-symbols-outlined" aria-hidden="true">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
