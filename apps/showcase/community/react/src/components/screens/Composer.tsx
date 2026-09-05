/**
 * The inline composer at the top of the feed.
 *
 * IT IS A TRIGGER UNTIL IT IS PRESSED, and that is the whole reason this
 * vertical has no Create destination. A permanently-open textarea with an
 * audience picker and three buttons costs 180px at the top of every visit to
 * the feed, and the reader came for the feed. Expanding in place is also a
 * harder layout than a screen of its own — it has to grow without moving what
 * is under it — which makes it the better demonstration.
 *
 * NOTHING IS EVER POSTED. The fixture is frozen and a composer that appended to
 * it would make the app disagree with itself on the next reload. Pressing Post
 * raises a snackbar and collapses.
 */

import { useRef, useState } from 'react';
import { AUDIENCES, audienceIcon, type Audience, type Person } from '@awc-ui/showcase-kit/community';
import { useT } from '@/lib/showcase';
import { useCustomEvent } from '@/components/elements';
import { Avatar } from '@/components/bits';

export function Composer({
  viewer,
  onMessage,
}: {
  viewer: Person;
  onMessage: (key: string | null, params?: Record<string, string | number>) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('friends');
  const bodyRef = useRef<HTMLElement | null>(null);

  /* `md-text-field`'s `mdInput` detail IS the bare string — unlike
     `md-search`, which carries `{ value }`. Two components, two shapes. */
  useCustomEvent<CustomEvent<string>>(bodyRef, 'mdInput', (event) =>
    setBody(String(event.detail ?? '')),
  );

  if (!open) {
    return (
      <div className="composer">
        <Avatar person={viewer} size="medium" />
        {/*
          A BUTTON, not a read-only text field styled as one. A field would take
          focus, show a caret and accept typing that goes nowhere until the real
          composer opens. A button says what it does and opens the thing.
        */}
        <button type="button" className="composer__trigger" onClick={() => setOpen(true)}>
          {t('community.action.writeSomething', { name: viewer.displayName.split(' ')[0] })}
        </button>
      </div>
    );
  }

  const spec = AUDIENCES.find((a) => a.value === audience);

  return (
    <div className="composer__open">
      <div className="composer">
        <Avatar person={viewer} size="medium" />
        <span className="post-card__names">
          <span className="post-card__name">{viewer.displayName}</span>
          <span className="post-card__meta">
            <span className="material-symbols-outlined" aria-hidden="true">
              {audienceIcon[audience]}
            </span>
            {spec ? t(spec.labelKey) : ''}
          </span>
        </span>
      </div>

      <md-text-field
        ref={bodyRef}
        variant="outlined"
        label={t('community.panel.compose')}
        value={body}
        multiline="auto-grow"
        rows={3}
        full-width
      />

      <div className="composer__foot">
        {/* Four audiences as filter chips rather than a select: each needs a
            sentence of explanation, and a select hides the explanations behind
            the one that happens to be chosen. */}
        {AUDIENCES.map((option) => (
          <md-chip
            key={option.value}
            variant="filter"
            appearance="outlined"
            icon={audienceIcon[option.value]}
            label={t(option.labelKey)}
            selected={audience === option.value || undefined}
            onClick={() => setAudience(option.value)}
          />
        ))}
        <span className="composer__spacer" />
        <md-button variant="text" onClick={() => { setOpen(false); setBody(''); }}>
          {t('community.action.cancel')}
        </md-button>
        <md-button
          variant="filled"
          icon="send"
          soft-disabled={body.trim() === '' || undefined}
          onClick={() => {
            if (body.trim() === '') {
              onMessage('community.hint.needBody');
              return;
            }
            onMessage('community.msg.posted');
            setBody('');
            setOpen(false);
          }}
        >
          {t('community.action.post')}
        </md-button>
      </div>
    </div>
  );
}
