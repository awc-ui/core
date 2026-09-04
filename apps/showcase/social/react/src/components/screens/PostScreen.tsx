/**
 * One post, and its comments. The first of the two drills.
 *
 * TWO COLUMNS ABOVE 900px, ONE BELOW. The picture takes the space it deserves
 * and the conversation sits beside it, which is the arrangement every app of
 * this shape uses on a wide screen — and on a phone the picture goes back on
 * top, because a comment thread beside a 390px picture is two narrow columns
 * and neither is readable.
 *
 * THE COMMENTS COME FROM THE KIT IN READING ORDER, not in date order: each
 * top-level comment is followed immediately by its replies. A flat newest-first
 * list scatters a reply away from the thing it replies to, which is the one
 * arrangement a comment section must not have.
 *
 * AN UNKNOWN ID IS THIS SCREEN'S PROBLEM, not the router's. A component taking
 * a plain string out of a URL must not trust its caller.
 */

import { useRef, useState } from 'react';
import {
  engagement,
  getCommentById,
  getComments,
  getPersonById,
  getPostById,
} from '@awc-ui/showcase-kit/social';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { Panel, Screen } from '@/components/Shell';
import { useCustomEvent } from '@/components/elements';
import { Avatar, Count, PersonName, PostActions, PostMedia, When } from '@/components/bits';
import { PanelSkeleton } from '@/components/skeletons';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { NotFoundScreen } from './NotFoundScreen';
import { Snackbar, useSnackbar } from './Snackbar';

export function PostScreen({ postId }: { postId: string }) {
  const t = useT();
  const { isLiked, isSaved, toggleLike, toggleSave } = useEngagement();
  const { message, say, close } = useSnackbar();
  /* Comments the reader has added this session. They are not in the kit and
     never will be — the fixture is frozen — so they live here and vanish on a
     reload, which is the same contract every other override in this app has. */
  const [added, setAdded] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const draftRef = useRef<HTMLElement | null>(null);
  /*
   * `mdInput` THROUGH A REF, NOT `onInput` AS A JSX PROP.
   *
   * React's `onInput` binds the NATIVE input event, and `md-text-field` reports
   * through a custom `mdInput` whose detail IS the bare string. The two never
   * met: the draft stayed empty, the Post button stayed soft-disabled, and
   * nothing threw — the field simply did not work. Found by
   * `scripts/verify-browser.mjs`, which types into it.
   *
   * Declared before the early return below, because a hook must be.
   */
  useCustomEvent<CustomEvent<string>>(draftRef, 'mdInput', (event) =>
    setDraft(String(event.detail ?? '')),
  );

  const post = getPostById(postId);
  if (!post) return <NotFoundScreen />;

  const author = getPersonById(post.authorId)!;
  const comments = getComments(post.id);
  const liked = isLiked(post);
  const saved = isSaved(post);
  const counts = engagement(post, liked, saved);

  return (
    <Screen
      title={t('social.screen.post.title')}
      subtitle={t('social.screen.post.subtitle', { name: author.displayName })}
      skeleton={<PanelSkeleton height="620px" lines={8} />}
    >
      <div className="post-detail">
        <div className="post-detail__media">
          <PostMedia post={post} eager />
        </div>

        <div className="post-detail__side">
          <Panel>
            <header className="post-card__head">
              {/* `PersonName`, not `PersonLink`: this row is already one link,
                  and an anchor inside an anchor is invalid. */}
              <Link className="post-card__author" href={route.person(author.handle)}>
                <Avatar person={author} size="small" ring />
                <span className="post-card__names">
                  <PersonName person={author} showHandle />
                  {post.locationKey ? (
                    <span className="post-card__place">{t(post.locationKey)}</span>
                  ) : null}
                </span>
              </Link>
              <When at={post.postedAt} />
            </header>

            <p className="post-card__caption">{t(post.captionKey)}</p>

            <div className="row">
              {post.topics.map((id) => (
                <md-chip
                  key={id}
                  variant="assist"
                  appearance="outlined"
                  color="secondary"
                  label={t(`social.topic.${id}`)}
                />
              ))}
            </div>

            <PostActions
              liked={liked}
              saved={saved}
              onLike={() => say(toggleLike(post) ? 'social.msg.liked' : null)}
              onSave={() => say(toggleSave(post) ? 'social.msg.saved' : 'social.msg.unsaved')}
              onComment={() => {}}
              onShare={() => say('social.msg.linkCopied')}
            />

            {/* `stat-row`, not `dl`: four one-word labels with small numbers
                read across, and `.dl` gave each its own full-width row —
                eight lines down a narrow column for four counts. */}
            <dl className="stat-row">
              <div>
                <dt>{t('social.count.likes')}</dt>
                <dd>
                  <Count value={counts.likeCount} />
                </dd>
              </div>
              <div>
                <dt>{t('social.count.comments')}</dt>
                <dd>
                  <Count value={counts.commentCount + added.length} />
                </dd>
              </div>
              <div>
                <dt>{t('social.count.shares')}</dt>
                <dd>
                  <Count value={counts.shareCount} />
                </dd>
              </div>
              <div>
                <dt>{t('social.count.saves')}</dt>
                <dd>
                  <Count value={counts.saveCount} />
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title={t('social.panel.comments')}
            actions={<Count value={comments.length + added.length} />}
          >
            {post.commentsDisabled ? (
              <p className="muted">{t('social.hint.commentsOff')}</p>
            ) : comments.length === 0 && added.length === 0 ? (
              <div className="empty">
                <p>{t('social.empty.comments')}</p>
                <p>{t('social.empty.commentsHint')}</p>
              </div>
            ) : (
              <md-list
                label={t('social.panel.comments')}
                interaction-mode="multi-action"
                list-style="segmented"
              >
                {comments.map((comment) => {
                  const person = getPersonById(comment.authorId)!;
                  const parent = comment.replyToId ? getCommentById(comment.replyToId) : null;
                  const parentAuthor = parent ? getPersonById(parent.authorId) : null;
                  return (
                    <md-list-item
                      key={comment.id}
                      /* A reply is indented from a data attribute rather than a
                         nested list: `md-list` inside `md-list` gives a screen
                         reader a second list to escape, and the thread is only
                         ever one level deep — the fixture asserts it. */
                      data-reply={comment.replyToId ? '' : undefined}
                      headline={person.displayName}
                      /*
                       * NO OVERLINE ON A REPLY ANY MORE — the third attempt at
                       * this, and the first that stops adding a line.
                       *
                       * `@CLARA.I` above every comment shouted a handle that
                       * said nothing. `REPLY TO @NOOR.ALAMIN` shouted louder and
                       * put the parent ahead of the speaker. Plain `REPLY` was
                       * quiet enough but still cost a whole line above the name,
                       * so a reply stood taller than the comment it answered —
                       * exactly backwards.
                       *
                       * The relationship is now drawn instead: `app.css` puts an
                       * elbow connector in the indent gutter, running down from
                       * the parent and turning in towards this row's avatar. A
                       * line cannot be read by a screen reader, so the word
                       * moves into the trailing slot as visually-hidden text —
                       * announced, and occupying nothing.
                       */
                      supporting-text={t(comment.bodyKey)}
                      lines="2"
                    >
                      <span slot="leading">
                        <Avatar person={person} size="small" />
                      </span>
                      <span slot="trailing" className="comment-trailing">
                        {parentAuthor ? (
                          <span className="visually-hidden">{t('social.action.reply')}</span>
                        ) : null}
                        <When at={comment.postedAt} />
                        {/* A bare number in a trailing slot is a number with no
                            unit. The heart is what says what it counts, and it
                            is `aria-hidden` because the label beside it does the
                            same job for a screen reader. */}
                        <span className="comment-likes">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            favorite
                          </span>
                          <Count value={comment.likeCount} />
                          <span className="visually-hidden">{t('social.count.likes')}</span>
                        </span>
                      </span>
                    </md-list-item>
                  );
                })}

                {added.map((body, index) => (
                  <md-list-item
                    key={`added-${index}`}
                    data-mine=""
                    headline={t('social.common.you')}
                    supporting-text={body}
                    lines="2"
                  >
                    <span slot="trailing">
                      <When at={new Date().toISOString()} />
                    </span>
                  </md-list-item>
                ))}
              </md-list>
            )}

            {post.commentsDisabled ? null : (
              <div className="comment-compose">
                {/* `auto-grow`, not a fixed single line: a comment is prose
                    of unknown length, and a one-line box that scrolls its own
                    content hides what you just wrote. The component grows the
                    textarea itself — `multiline="fixed"` with `rows` is the
                    other option and is for a box whose size is part of the
                    layout, which the composer's caption is and this is not. */}
                <md-text-field
                  ref={draftRef}
                  /*
                   * OUTLINED, not the default filled — and the reason is the
                   * one-row multiline specifically.
                   *
                   * A filled field reserves a band at the top for its label to
                   * float into: measured at 28px above the textarea against 8px
                   * below. On a single-line box that band is simply empty, so
                   * the label sat near the bottom of a 60px control under a
                   * broad strip of nothing. An outlined field carries its label
                   * in the border notch and pads symmetrically, which is what a
                   * compose row wants.
                   */
                  variant="outlined"
                  label={t('social.action.comment')}
                  value={draft}
                  multiline="auto-grow"
                  rows={1}
                  full-width
                />
                <md-button
                  variant="filled"
                  icon="send"
                  /* Soft-disabled with a stated reason rather than silently
                     inert — the same gate the two banking tickets use. */
                  soft-disabled={draft.trim() === '' || undefined}
                  onClick={() => {
                    if (draft.trim() === '') return;
                    setAdded((prev) => [...prev, draft.trim()]);
                    setDraft('');
                    say('social.msg.posted');
                  }}
                >
                  {t('social.action.post')}
                </md-button>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
