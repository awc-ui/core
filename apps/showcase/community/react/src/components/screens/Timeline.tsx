/**
 * A column of post cards, resolved.
 *
 * THE RESOLUTION HAPPENS HERE rather than at each call site: a profile and a
 * group both have a timeline, and both need every post joined to its author,
 * its group and — for a share — the whole post it contains. `resolve()` in the
 * kit is the same join `feedItems()` does, exposed for exactly this.
 */

import { resolve, type Post } from '@awc-ui/showcase-kit/community';
import { PostCard } from './PostCard';

export function Timeline({
  posts,
  onMessage,
}: {
  posts: Post[];
  onMessage: (key: string | null, params?: Record<string, string | number>) => void;
}) {
  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.id} item={resolve(post)} onMessage={onMessage} />
      ))}
    </>
  );
}
