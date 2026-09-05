/**
 * A project drill.
 *
 * IT DELEGATES TO `StudioScreen` WITH A SLUG rather than reimplementing the
 * arrangement, because the only difference between "the studio" and "this
 * project" is which project is open. Two copies of the timeline would be two
 * places to fix the next thing found in it.
 */

import { projectBySlug } from '@awc-ui/showcase-kit/music';
import { Screen } from '@/components/Shell';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { StudioScreen } from '@/components/screens/StudioScreen';
import { useT } from '@/lib/showcase';

export function ProjectScreen({ slug }: { slug: string }) {
  const t = useT();
  const project = projectBySlug(slug);

  /* The screen guards its own parameter: it came from a URL, so it is not
     trusted until the fixture confirms it. */
  if (!project) {
    return <NotFoundScreen />;
  }

  return <StudioScreen slug={slug} />;
}
