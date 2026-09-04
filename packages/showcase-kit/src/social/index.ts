/**
 * `@awc-ui/showcase-kit/social`
 *
 * Everything the Lyra Photos & People app knows that is not a view: the frozen
 * fixture and its pure selectors, the groupings behind every screen, the
 * domain-value → component-vocabulary mapping, and the shared route table.
 *
 * This exists so the framework builds are genuinely only view layers. A
 * grouping or a topic's colour computed once here cannot drift between ports,
 * which means a screenshot of the React build and a screenshot of the Svelte
 * build are comparable evidence: any difference is the framework, never the
 * data.
 *
 * Framework-free by construction — no DOM, no component imports.
 *
 * IF YOU ARE WRITING A SCREEN: everything you need is exported from this one
 * module. Import nothing from `./generated` and write no arithmetic in a
 * component — if the number you want is not here, it belongs in `derive.ts`.
 */

/* ------------------------------------------------------------- the fixture */

export {
  ASPECT_RATIO,
  FEED_PAGE,
  REPORTING_DATE,
  REPORTING_INSTANT,
  VIEWER_HANDLE,
} from './types';

export type {
  AccountKind,
  Activity,
  ActivityKind,
  Aspect,
  Audience,
  Comment,
  Media,
  Person,
  Post,
  PostKind,
  Relationship,
  SocialFixture,
  SocialTotals,
  Topic,
} from './types';

export { FIXTURE } from './generated';

/* ------------------------------------------------------------- selectors */

export {
  getActivity,
  getCommentById,
  getComments,
  getFeed,
  getOthers,
  getPeople,
  getPersonByHandle,
  getPersonById,
  getPersonPosts,
  getPostById,
  getPosts,
  getTopicById,
  getTopics,
  getTotals,
  getViewer,
} from './selectors';
export type { ActivityQuery, PostQuery } from './selectors';

/* ---------------------------------------------------------------- derived */

export {
  AUDIENCES,
  activityGroups,
  composerLibrary,
  engagement,
  exploreTiles,
  feedItems,
  profileSummary,
  storyRail,
  suggestedPeople,
  taggablePeople,
  topicFacets,
} from './derive';
export type {
  ActivityBucket,
  ActivityGroup,
  ActivityRow,
  ExploreTile,
  FeedItem,
  ProfileSummary,
  StoryRing,
} from './derive';

/* ----------------------------------------------------------------- status */

export {
  accountKindTone,
  activityIcon,
  activityTone,
  aspectRatio,
  audienceIcon,
  countOptions,
  followAction,
  postKindIcon,
} from './status';
export type { FollowAction, Tone } from './status';

/* ----------------------------------------------------------------- routes */

export {
  DESTINATIONS,
  FRAMEWORKS,
  SHOWCASE_BASE,
  createRoutes,
  crumbsFor,
  destinationFor,
  destinationIndex,
  route,
} from './routes';
export type { CrumbSpec, Destination, Framework, RouteName, SocialRoutes } from './routes';
