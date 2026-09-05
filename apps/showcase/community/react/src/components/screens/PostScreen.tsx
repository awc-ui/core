/**
 * One post and its whole thread.
 *
 * THE SAME CARD AS THE FEED, with `showComments` on — which is the difference
 * between this screen and Lyra's post drill, where the detail view is a
 * different layout entirely. Here it genuinely is the same component: a post is
 * a post, and the only thing the drill adds is that the conversation is open
 * rather than previewed.
 *
 * AN UNKNOWN ID IS THIS SCREEN'S PROBLEM, not the router's. A component taking
 * a plain string out of a URL must not trust its caller.
 */

import { getPersonById, getPostById, resolve } from '@awc-ui/showcase-kit/community';
import { useT } from '@/lib/showcase';
import { Screen } from '@/components/Shell';
import { PostSkeleton } from '@/components/skeletons';
import { PostCard } from './PostCard';
import { RightRail } from './RightRail';
import { NotFoundScreen } from './NotFoundScreen';
import { Snackbar, useSnackbar } from './Snackbar';

export function PostScreen({ postId }: { postId: string }) {
  const t = useT();
  const { message, say, close } = useSnackbar();

  const post = getPostById(postId);
  if (!post) return <NotFoundScreen />;

  const author = getPersonById(post.authorId);
  if (!author) return <NotFoundScreen />;

  return (
    <Screen
      title={t('community.screen.post.title')}
      subtitle={t('community.screen.post.subtitle', { name: author.displayName })}
      skeleton={<PostSkeleton />}
    >
      <div className="columns">
        <div className="columns__main">
          <PostCard item={resolve(post)} onMessage={say} showComments />
        </div>
        <aside className="columns__rail">
          <RightRail />
        </aside>
      </div>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
