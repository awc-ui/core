// Cairn — fictional project-tracker data for the "Alpenglow 2.4" release cycle
// at Fernline Software, a (fictional) maker of trail-mapping tools.

export const statuses = [
  { key: 'backlog', label: 'Backlog', color: 'secondary' },
  { key: 'in-progress', label: 'In progress', color: 'info' },
  { key: 'review', label: 'Review', color: 'warning' },
  { key: 'done', label: 'Done', color: 'success' },
];

export const statusByKey = Object.fromEntries(statuses.map((s) => [s.key, s]));

export const priorityColor = {
  High: 'error',
  Medium: 'warning',
  Low: 'success',
};

export const tasks = [
  {
    id: 'CAI-341',
    title: 'Offline tile cache eviction policy',
    description:
      'Map tiles cached for offline routes currently grow without bound. Implement a least-recently-used eviction pass that keeps the cache under the 512 MB ceiling and never evicts tiles belonging to a pinned route.',
    status: 'in-progress',
    priority: 'High',
    points: 8,
    due: 'Aug 25, 2026',
    assignee: 'Mara Ellingsen',
    activity: [
      { who: 'Mara Ellingsen', what: 'Moved to In progress', when: 'Aug 18, 09:12' },
      { who: 'Devon Okafor', what: 'Linked spike notes from CAI-310', when: 'Aug 17, 16:40' },
      { who: 'Priya Raghunathan', what: 'Raised priority to High after beta feedback', when: 'Aug 14, 11:05' },
    ],
    checklist: [
      { label: 'LRU index on tile access time', done: true },
      { label: 'Pinned-route exclusion set', done: true },
      { label: 'Eviction pass behind feature flag', done: false },
      { label: 'Telemetry on cache hit rate', done: false },
    ],
  },
  {
    id: 'CAI-355',
    title: 'Route elevation profile smoothing',
    description:
      'Raw GPS elevation traces produce jagged profiles on short climbs. Apply a Savitzky-Golay filter with a 9-sample window before rendering, and expose a raw/smoothed toggle in the profile inspector.',
    status: 'in-progress',
    priority: 'Medium',
    points: 5,
    due: 'Aug 27, 2026',
    assignee: 'Tomas Ibarra',
    activity: [
      { who: 'Tomas Ibarra', what: 'Pushed first pass of the filter', when: 'Aug 19, 15:22' },
      { who: 'Lena Kowalczyk', what: 'Attached sample traces from the Dolomites set', when: 'Aug 18, 10:31' },
    ],
    checklist: [
      { label: 'Filter implementation', done: true },
      { label: 'Raw/smoothed toggle', done: false },
      { label: 'Snapshot tests on sample traces', done: false },
    ],
  },
  {
    id: 'CAI-348',
    title: 'Waypoint sharing links expire silently',
    description:
      'Shared waypoint links older than 30 days return a blank screen instead of an expiry notice. Return a 410 with a friendly expired-link page and an option to request a fresh link from the owner.',
    status: 'review',
    priority: 'High',
    points: 3,
    due: 'Aug 22, 2026',
    assignee: 'Priya Raghunathan',
    activity: [
      { who: 'Priya Raghunathan', what: 'Opened merge request !482', when: 'Aug 20, 08:45' },
      { who: 'Mara Ellingsen', what: 'Reproduced on staging, confirmed scope', when: 'Aug 16, 13:02' },
    ],
    checklist: [
      { label: 'Expired-link page', done: true },
      { label: 'Request-new-link flow', done: true },
      { label: 'Owner notification email', done: false },
    ],
  },
  {
    id: 'CAI-329',
    title: 'Trail condition report form',
    description:
      'Let hikers file a short trail condition report (mud, blowdown, snowline) from the route detail screen. Reports feed the condition badge already shown on route cards.',
    status: 'backlog',
    priority: 'Medium',
    points: 5,
    due: 'Sep 3, 2026',
    assignee: 'Lena Kowalczyk',
    activity: [
      { who: 'Devon Okafor', what: 'Estimated at 5 points in refinement', when: 'Aug 12, 14:20' },
    ],
    checklist: [
      { label: 'Form design sign-off', done: false },
      { label: 'Condition taxonomy agreed', done: false },
    ],
  },
  {
    id: 'CAI-362',
    title: 'GPX import drops track segments',
    description:
      'Multi-segment GPX files from Wanderfreund watches import only the first segment. Merge segments separated by less than 90 seconds and surface the rest as separate suggested routes.',
    status: 'backlog',
    priority: 'High',
    points: 8,
    due: 'Sep 1, 2026',
    assignee: 'Devon Okafor',
    activity: [
      { who: 'Lena Kowalczyk', what: 'Attached three failing GPX samples', when: 'Aug 19, 09:58' },
    ],
    checklist: [
      { label: 'Segment merge heuristic', done: false },
      { label: 'Suggested-route surfacing', done: false },
      { label: 'Import regression suite', done: false },
    ],
  },
  {
    id: 'CAI-317',
    title: 'Dark map style for night navigation',
    description:
      'Ship the low-luminance map style tuned for headlamp use. Contrast targets were validated in the June field test; remaining work is the style toggle and persistence.',
    status: 'review',
    priority: 'Low',
    points: 3,
    due: 'Aug 24, 2026',
    assignee: 'Mara Ellingsen',
    activity: [
      { who: 'Mara Ellingsen', what: 'Opened merge request !479', when: 'Aug 19, 17:30' },
      { who: 'Tomas Ibarra', what: 'Reviewed style JSON, two nits', when: 'Aug 20, 10:14' },
    ],
    checklist: [
      { label: 'Style toggle in settings', done: true },
      { label: 'Persist choice per profile', done: true },
    ],
  },
  {
    id: 'CAI-302',
    title: 'Sync conflict resolution for edited routes',
    description:
      'When a route is edited on two devices while offline, last-write-wins silently discards changes. Present a conflict card letting the user keep either version or both as separate routes.',
    status: 'done',
    priority: 'High',
    points: 13,
    due: 'Aug 18, 2026',
    assignee: 'Devon Okafor',
    activity: [
      { who: 'Devon Okafor', what: 'Merged !471, deployed to beta ring', when: 'Aug 17, 18:03' },
      { who: 'Priya Raghunathan', what: 'Verified on the two-device test bench', when: 'Aug 18, 09:40' },
    ],
    checklist: [
      { label: 'Conflict detection on sync', done: true },
      { label: 'Keep-either / keep-both card', done: true },
      { label: 'Bench verification', done: true },
    ],
  },
  {
    id: 'CAI-338',
    title: 'Route card skeleton loading states',
    description:
      'Route lists pop in abruptly on slow connections. Add skeleton placeholders matching the card layout so the list keeps its shape while thumbnails and stats stream in.',
    status: 'done',
    priority: 'Low',
    points: 2,
    due: 'Aug 15, 2026',
    assignee: 'Lena Kowalczyk',
    activity: [
      { who: 'Lena Kowalczyk', what: 'Merged !468', when: 'Aug 14, 12:55' },
    ],
    checklist: [
      { label: 'Card skeleton', done: true },
      { label: 'List shimmer timing', done: true },
    ],
  },
  {
    id: 'CAI-359',
    title: 'Partner API rate limit headers',
    description:
      'Partners integrating the routes API have no visibility into remaining quota. Emit standard rate-limit headers on every response and document them in the partner guide.',
    status: 'backlog',
    priority: 'Low',
    points: 2,
    due: 'Sep 8, 2026',
    assignee: 'Tomas Ibarra',
    activity: [
      { who: 'Priya Raghunathan', what: 'Added after the Cragside Outfitters call', when: 'Aug 18, 15:47' },
    ],
    checklist: [
      { label: 'Headers on all endpoints', done: false },
      { label: 'Partner guide section', done: false },
    ],
  },
  {
    id: 'CAI-344',
    title: 'Summit badge award pipeline is flaky',
    description:
      'Roughly 4% of qualifying ascents never receive their summit badge because the award job races the track post-processing step. Sequence the award job after post-processing completes.',
    status: 'done',
    priority: 'Medium',
    points: 5,
    due: 'Aug 17, 2026',
    assignee: 'Priya Raghunathan',
    activity: [
      { who: 'Priya Raghunathan', what: 'Merged !474, backfilled 1,182 missed badges', when: 'Aug 16, 19:21' },
    ],
    checklist: [
      { label: 'Job sequencing fix', done: true },
      { label: 'Backfill script', done: true },
    ],
  },
];

export const sprint = {
  name: 'Sprint 14 — Ridgeline',
  window: 'Aug 10 – Aug 21, 2026',
  committedPoints: 46,
  completedPoints: 31,
  days: ['Aug 10', 'Aug 11', 'Aug 12', 'Aug 13', 'Aug 14', 'Aug 17', 'Aug 18', 'Aug 19', 'Aug 20', 'Aug 21'],
  ideal: [46, 41, 36, 31, 26, 20, 15, 10, 5, 0],
  remaining: [46, 44, 39, 37, 33, 28, 24, 21, 15, null],
  goals: [
    {
      name: 'Offline routes ready for GA',
      detail: 'Cache eviction, sync conflicts and the two-device bench all green.',
      done: 9,
      total: 12,
      unit: 'tasks',
    },
    {
      name: 'Night navigation field-test follow-ups',
      detail: 'Close out every finding from the June headlamp field test.',
      done: 5,
      total: 6,
      unit: 'findings',
    },
    {
      name: 'Partner API hardening',
      detail: 'Quota visibility and import fixes requested by integration partners.',
      done: 1,
      total: 4,
      unit: 'tasks',
    },
    {
      name: 'Beta crash rate below 0.3%',
      detail: 'Crash-free sessions in the beta ring, trailing 7 days.',
      done: 87,
      total: 100,
      unit: '% of target',
    },
  ],
};
