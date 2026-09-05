/**
 * The public surface of the Corvus vertical.
 *
 * Every framework build imports from `@awc-ui/showcase-kit/community` and never
 * reaches into a file below this one — which is what lets the internals move
 * without touching five applications, and what makes "does a screen do this
 * itself or ask the kit?" a question with a visible answer.
 *
 * `generated.ts` is exported as `FIXTURE` for the invariant checks and for
 * nothing else. A screen that reads it directly has bypassed every selector.
 */

export {
  ASPECT_RATIO,
  COMMENT_PAGE,
  FEED_PAGE,
  REPLY_PAGE,
  REPORTING_DATE,
  REPORTING_INSTANT,
  VIEWER_HANDLE,
} from './types';

export type {
  Aspect,
  Audience,
  Comment,
  CommunityEvent,
  CommunityFixture,
  CommunityTotals,
  Friendship,
  Group,
  GroupPrivacy,
  GroupRole,
  LinkPreview,
  Media,
  Person,
  Post,
  PostKind,
  ReactionCounts,
  ReactionKind,
  Rsvp,
} from './types';

export { FIXTURE } from './generated';

export {
  getBirthdays,
  getCommentById,
  getComments,
  getDiscoverGroups,
  getEventById,
  getEventBySlug,
  getEvents,
  getEventsThisWeek,
  getFeed,
  getFriends,
  getGroupById,
  getGroupBySlug,
  getGroupEvents,
  getGroupPosts,
  getGroups,
  getJoinedGroups,
  getOthers,
  getOutgoing,
  getPastEvents,
  getPeople,
  getPersonByHandle,
  getPersonById,
  getPersonPosts,
  getPostById,
  getPosts,
  getReplies,
  getRequests,
  getSuggestions,
  getTopLevelComments,
  getTotals,
  getUpcomingEvents,
  getViewer,
} from './selectors';

export {
  commentTree,
  eventBucket,
  eventGroups,
  eventSummary,
  feedItems,
  groupSummary,
  profileSummary,
  reactionSummary,
  reactionTotal,
  resolve,
  rightRail,
  subtreeSize,
} from './derive';

export type {
  EventBucket,
  EventGroup,
  EventSummary,
  FeedItem,
  FriendSections,
  GroupSections,
  GroupSummary,
  ProfileSummary,
  ReactionSummary,
  RightRail,
  ThreadNode,
} from './derive';

export {
  AUDIENCES,
  REACTIONS,
  RSVP_CHOICES,
  audienceIcon,
  friendAction,
  friendshipTone,
  joinAction,
  postKindIcon,
  privacyIcon,
  privacyTone,
  reactionIcon,
  reactionTone,
  roleIcon,
  roleTone,
  rsvpIcon,
  rsvpTone,
} from './status';

export type { FriendAction, JoinAction, Tone } from './status';

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

export type { CommunityRoutes, CrumbSpec, Destination, Framework, RouteName } from './routes';
