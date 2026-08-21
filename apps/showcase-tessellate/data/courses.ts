// Tessellate Academy — fictional catalog, enrollment and quiz data.

export interface Lesson {
  title: string;
  duration: string;
}

export interface CourseModule {
  title: string;
  summary: string;
  lessons: Lesson[];
}

export interface Review {
  name: string;
  rating: number;
  date: string;
  text: string;
}

export interface Course {
  slug: string;
  title: string;
  tagline: string;
  topics: string[];
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  rating: number;
  ratingCount: number;
  hours: number;
  price: number;
  instructor: string;
  instructorRole: string;
  about: string[];
  outcomes: string[];
  modules: CourseModule[];
  reviews: Review[];
}

export const courses: Course[] = [
  {
    slug: 'geometric-pattern-design',
    title: 'Geometric Pattern Design',
    tagline: 'Build repeating tile systems from first principles — grids, symmetry groups and seamless motifs.',
    topics: ['Design', 'Illustration'],
    level: 'Beginner',
    rating: 4.7,
    ratingCount: 1284,
    hours: 11,
    price: 49,
    instructor: 'Mara Voss',
    instructorRole: 'Surface designer, 14 years in textile studios',
    about: [
      'Every repeating pattern is a small machine: a cell, a symmetry rule and a motif. This course takes you from a blank square to production-ready seamless tiles you can hand to print or screen.',
      'You will work by hand first — tracing paper and a compass — then rebuild each construction digitally so the geometry, not the software, stays in charge.',
    ],
    outcomes: [
      'Construct the 4 wallpaper symmetries used in commercial surface design',
      'Design seamless tiles that survive scaling and rotation',
      'Prepare a repeat for both print and screen delivery',
    ],
    modules: [
      {
        title: 'Grids and cells',
        summary: '4 lessons · 2h 10m',
        lessons: [
          { title: 'The unit cell: square, brick, hex', duration: '28m' },
          { title: 'Constructing grids with compass and rule', duration: '35m' },
          { title: 'From sketch to vector cell', duration: '32m' },
          { title: 'Checkpoint: your first tile', duration: '35m' },
        ],
      },
      {
        title: 'Symmetry systems',
        summary: '5 lessons · 3h 05m',
        lessons: [
          { title: 'Reflection, rotation, glide', duration: '40m' },
          { title: 'The four everyday wallpaper groups', duration: '38m' },
          { title: 'Breaking symmetry on purpose', duration: '33m' },
          { title: 'Motif density and visual rhythm', duration: '39m' },
          { title: 'Checkpoint: a symmetry study', duration: '35m' },
        ],
      },
      {
        title: 'Production repeats',
        summary: '4 lessons · 2h 45m',
        lessons: [
          { title: 'Seamless edges: the offset test', duration: '42m' },
          { title: 'Color separations for print', duration: '40m' },
          { title: 'Exporting for web and fabric', duration: '38m' },
          { title: 'Final project: a two-color repeat', duration: '45m' },
        ],
      },
    ],
    reviews: [
      {
        name: 'Ilse Brandt',
        rating: 5,
        date: 'July 2026',
        text: 'The compass-first approach fixed habits I did not know I had. My repeats finally survive the offset test on the first try.',
      },
      {
        name: 'Tomas Reyes',
        rating: 4.5,
        date: 'June 2026',
        text: 'Clear, patient, and the checkpoints are genuinely useful. I wanted one more module on non-square cells.',
      },
      {
        name: 'Priya Nandakumar',
        rating: 4.5,
        date: 'May 2026',
        text: 'Went from zero to selling a small pattern pack in eight weeks. The production module alone is worth the price.',
      },
    ],
  },
  {
    slug: 'svg-data-visualization',
    title: 'Data Visualization with SVG',
    tagline: 'Hand-build charts that explain — scales, axes and accessible marks without a charting library.',
    topics: ['Development', 'Data'],
    level: 'Intermediate',
    rating: 4.8,
    ratingCount: 962,
    hours: 14,
    price: 69,
    instructor: 'Dorian Ashe',
    instructorRole: 'Data journalist and front-end engineer',
    about: [
      'Charting libraries are great until the chart you need is not in the gallery. This course teaches the layer underneath: coordinate systems, scales and SVG marks, so any chart becomes buildable.',
      'Every unit ends with a chart rebuilt from a real published graphic — you will reverse-engineer the design decisions as well as the code.',
    ],
    outcomes: [
      'Map data domains to pixel ranges with linear, band and time scales',
      'Draw bar, line and area marks in raw SVG with correct axes',
      'Make every chart keyboard-navigable and screen-reader honest',
    ],
    modules: [
      {
        title: 'Coordinates and scales',
        summary: '5 lessons · 3h 20m',
        lessons: [
          { title: 'The SVG viewport and viewBox', duration: '36m' },
          { title: 'Linear scales by hand', duration: '40m' },
          { title: 'Band scales and categorical axes', duration: '42m' },
          { title: 'Margins: the convention that saves you', duration: '38m' },
          { title: 'Checkpoint: a scaled scatter', duration: '44m' },
        ],
      },
      {
        title: 'Marks and axes',
        summary: '5 lessons · 3h 45m',
        lessons: [
          { title: 'Bars, and why baselines matter', duration: '41m' },
          { title: 'Lines and path generators', duration: '48m' },
          { title: 'Ticks, grids and label collision', duration: '45m' },
          { title: 'Small multiples', duration: '46m' },
          { title: 'Checkpoint: rebuild a news graphic', duration: '45m' },
        ],
      },
      {
        title: 'Accessible, interactive charts',
        summary: '4 lessons · 3h 10m',
        lessons: [
          { title: 'Chart semantics for screen readers', duration: '44m' },
          { title: 'Keyboard cursors over data', duration: '50m' },
          { title: 'Tooltips that do not lie', duration: '46m' },
          { title: 'Final project: an explorable explainer', duration: '50m' },
        ],
      },
    ],
    reviews: [
      {
        name: 'Sena Okafor',
        rating: 5,
        date: 'July 2026',
        text: 'The margin-convention lesson should be mandatory for anyone touching SVG. Dense but never rushed.',
      },
      {
        name: 'Marcus Feld',
        rating: 5,
        date: 'July 2026',
        text: 'Rebuilding published graphics is a brilliant format. I finally understand band scales instead of copy-pasting them.',
      },
      {
        name: 'Anouk Verhoeven',
        rating: 4,
        date: 'April 2026',
        text: 'Excellent content. The accessibility module assumes some ARIA background — budget extra time there.',
      },
    ],
  },
  {
    slug: 'color-theory-in-practice',
    title: 'Color Theory in Practice',
    tagline: 'Stop guessing at palettes — contrast, harmony and color systems you can defend in a review.',
    topics: ['Design', 'Theory'],
    level: 'Beginner',
    rating: 4.5,
    ratingCount: 2101,
    hours: 8,
    price: 39,
    instructor: 'Beatriz Lang',
    instructorRole: 'Brand designer and design educator',
    about: [
      'Color decisions feel subjective right up until someone asks you to justify one. This course gives you the vocabulary and the tests: hue relationships, perceived lightness, contrast ratios and systematic palettes.',
      'The final unit builds a complete UI palette — neutrals, accents and states — and verifies every pairing against accessibility thresholds.',
    ],
    outcomes: [
      'Read and use hue, chroma and lightness independently',
      'Build harmonious palettes from a single seed color',
      'Verify text and UI contrast against WCAG thresholds',
    ],
    modules: [
      {
        title: 'Seeing color precisely',
        summary: '4 lessons · 2h 00m',
        lessons: [
          { title: 'Hue, chroma, lightness — three dials', duration: '30m' },
          { title: 'Why RGB lies about lightness', duration: '28m' },
          { title: 'Perceptual color spaces in practice', duration: '32m' },
          { title: 'Checkpoint: match a palette by eye', duration: '30m' },
        ],
      },
      {
        title: 'Harmony and meaning',
        summary: '4 lessons · 2h 30m',
        lessons: [
          { title: 'Complementary, analogous, triadic — when each works', duration: '38m' },
          { title: 'Cultural color and product context', duration: '35m' },
          { title: 'Neutrals are a decision too', duration: '37m' },
          { title: 'Checkpoint: three moods, one brand', duration: '40m' },
        ],
      },
      {
        title: 'Systems and accessibility',
        summary: '4 lessons · 2h 40m',
        lessons: [
          { title: 'Tonal ramps from a seed color', duration: '40m' },
          { title: 'Contrast ratios without the math anxiety', duration: '38m' },
          { title: 'State colors: error, warning, success', duration: '40m' },
          { title: 'Final project: a verified UI palette', duration: '42m' },
        ],
      },
    ],
    reviews: [
      {
        name: 'Jonas Petersen',
        rating: 4.5,
        date: 'June 2026',
        text: 'The "three dials" framing rewired how I pick colors. Short course, zero filler.',
      },
      {
        name: 'Ruth Adeyemi',
        rating: 4.5,
        date: 'May 2026',
        text: 'Our design reviews got noticeably calmer once the team shared this vocabulary.',
      },
      {
        name: 'Camille Roux',
        rating: 4,
        date: 'March 2026',
        text: 'Great fundamentals. I would have liked more on dark-mode palettes specifically.',
      },
    ],
  },
  {
    slug: 'typography-systems',
    title: 'Typography Systems',
    tagline: 'Type scales, rhythm and pairing — turn walls of text into interfaces people can actually read.',
    topics: ['Design', 'Typography'],
    level: 'Intermediate',
    rating: 4.6,
    ratingCount: 874,
    hours: 10,
    price: 55,
    instructor: 'Henrik Olausson',
    instructorRole: 'Editorial designer, ex-newspaper art desk',
    about: [
      'Typography is the 90% of interface design nobody sees when it works. This course covers the system layer: modular scales, line-length budgets, vertical rhythm and the small set of pairing rules that prevent most disasters.',
      'You will build a complete typographic spec for a real product — roles, sizes, weights and spacing — and stress-test it against long, messy, translated content.',
    ],
    outcomes: [
      'Design a modular type scale that survives real content',
      'Set measure, leading and rhythm for screen reading',
      'Pair typefaces with intent instead of superstition',
    ],
    modules: [
      {
        title: 'The scale',
        summary: '4 lessons · 2h 20m',
        lessons: [
          { title: 'Why 16px is not a design decision', duration: '32m' },
          { title: 'Modular scales and their ratios', duration: '36m' },
          { title: 'Roles: display, heading, body, label', duration: '35m' },
          { title: 'Checkpoint: a scale for a news app', duration: '37m' },
        ],
      },
      {
        title: 'Rhythm and measure',
        summary: '4 lessons · 2h 35m',
        lessons: [
          { title: 'Line length: the 45–75 budget', duration: '36m' },
          { title: 'Leading and paragraph spacing', duration: '38m' },
          { title: 'Baseline grids — when they help, when they fight you', duration: '40m' },
          { title: 'Checkpoint: an article template', duration: '41m' },
        ],
      },
      {
        title: 'Pairing and shipping',
        summary: '4 lessons · 2h 50m',
        lessons: [
          { title: 'Contrast pairing: serif with grotesque', duration: '40m' },
          { title: 'Variable fonts and loading budgets', duration: '42m' },
          { title: 'Stress tests: German, legalese, user content', duration: '43m' },
          { title: 'Final project: a full typographic spec', duration: '45m' },
        ],
      },
    ],
    reviews: [
      {
        name: 'Livia Marchetti',
        rating: 5,
        date: 'July 2026',
        text: 'The stress-testing lesson is the most practical hour of design education I have had. Everything broke, then I fixed it properly.',
      },
      {
        name: 'Oskar Lindqvist',
        rating: 4.5,
        date: 'June 2026',
        text: 'Henrik has strong opinions and earns all of them. My app finally reads like a product, not a prototype.',
      },
      {
        name: 'Dana Whitfield',
        rating: 4,
        date: 'April 2026',
        text: 'Solid system thinking. The variable-fonts lesson could go deeper on performance.',
      },
    ],
  },
  {
    slug: 'creative-coding-fundamentals',
    title: 'Creative Coding Fundamentals',
    tagline: 'Loops, noise and randomness as design tools — generative sketches from your first hour.',
    topics: ['Development', 'Generative'],
    level: 'Beginner',
    rating: 4.4,
    ratingCount: 1547,
    hours: 12,
    price: 45,
    instructor: 'Yuki Aranami',
    instructorRole: 'Generative artist and workshop lead',
    about: [
      'You do not need math genius to make code draw beautifully — you need a small toolkit used deliberately: iteration, randomness with constraints, and noise for organic motion.',
      'Each week ships a finished sketch. By the end you will have a portfolio of eight generative pieces and the vocabulary to keep exploring alone.',
    ],
    outcomes: [
      'Draw with loops, transforms and coordinate tricks',
      'Use constrained randomness so output stays intentional',
      'Animate with noise fields for organic, non-repeating motion',
    ],
    modules: [
      {
        title: 'Drawing with code',
        summary: '5 lessons · 3h 00m',
        lessons: [
          { title: 'The canvas coordinate system', duration: '34m' },
          { title: 'Loops as pattern machines', duration: '38m' },
          { title: 'Transforms: rotate the world, not the shape', duration: '36m' },
          { title: 'Color as a function of position', duration: '35m' },
          { title: 'Checkpoint: a tiled composition', duration: '37m' },
        ],
      },
      {
        title: 'Controlled chance',
        summary: '4 lessons · 2h 50m',
        lessons: [
          { title: 'Random is a design material', duration: '40m' },
          { title: 'Distributions: nudging chance your way', duration: '43m' },
          { title: 'Seeds and reproducible art', duration: '41m' },
          { title: 'Checkpoint: 100 variations, one system', duration: '46m' },
        ],
      },
      {
        title: 'Motion and noise',
        summary: '5 lessons · 3h 25m',
        lessons: [
          { title: 'The animation loop', duration: '38m' },
          { title: 'Perlin noise, gently', duration: '44m' },
          { title: 'Flow fields', duration: '42m' },
          { title: 'Exporting stills and loops', duration: '39m' },
          { title: 'Final project: a living poster', duration: '42m' },
        ],
      },
    ],
    reviews: [
      {
        name: 'Felix Braun',
        rating: 4.5,
        date: 'June 2026',
        text: 'The "random is a material" module changed how I think about all my design work, not just the generative stuff.',
      },
      {
        name: 'Amara Diallo',
        rating: 4.5,
        date: 'May 2026',
        text: 'Ships a real sketch every week — the momentum keeps you going. Flow fields were a struggle but worth it.',
      },
      {
        name: 'Ben Sorensen',
        rating: 4,
        date: 'February 2026',
        text: 'Good pacing for beginners. Experienced programmers may want to skim module one.',
      },
    ],
  },
  {
    slug: 'motion-design-principles',
    title: 'Motion Design Principles',
    tagline: 'Easing, choreography and restraint — interface motion that guides instead of decorates.',
    topics: ['Design', 'Motion'],
    level: 'Advanced',
    rating: 4.9,
    ratingCount: 638,
    hours: 9,
    price: 79,
    instructor: 'Colette Marchand',
    instructorRole: 'Principal motion designer, product studios',
    about: [
      'Motion is information: what appeared, where it came from, what it relates to. This course treats animation as a systems discipline — duration ramps, easing families and choreography rules that scale across a product.',
      'Expect strong opinions about restraint. The final project is a motion spec, not a showreel: durations, curves and rules another designer could apply without you in the room.',
    ],
    outcomes: [
      'Choose durations and easing curves from a coherent ramp',
      'Choreograph multi-element transitions without chaos',
      'Write a motion spec a team can actually follow',
    ],
    modules: [
      {
        title: 'Why things move',
        summary: '3 lessons · 1h 50m',
        lessons: [
          { title: 'Motion as spatial explanation', duration: '36m' },
          { title: 'The cost of every animation', duration: '35m' },
          { title: 'Checkpoint: audit a real app', duration: '39m' },
        ],
      },
      {
        title: 'The physics of feel',
        summary: '4 lessons · 2h 45m',
        lessons: [
          { title: 'Easing families: standard, decelerate, spring', duration: '42m' },
          { title: 'Duration ramps by distance and size', duration: '40m' },
          { title: 'Enter, exit, emphasis — three grammars', duration: '41m' },
          { title: 'Checkpoint: one card, five feels', duration: '42m' },
        ],
      },
      {
        title: 'Choreography and specs',
        summary: '4 lessons · 3h 00m',
        lessons: [
          { title: 'Stagger, lead and follow', duration: '44m' },
          { title: 'Shared elements across screens', duration: '46m' },
          { title: 'Reduced motion is a first-class path', duration: '42m' },
          { title: 'Final project: a product motion spec', duration: '48m' },
        ],
      },
    ],
    reviews: [
      {
        name: 'Igor Havel',
        rating: 5,
        date: 'July 2026',
        text: 'Colette teaches restraint better than anyone. Our app removed a third of its animations and feels faster and calmer.',
      },
      {
        name: 'Maren Skovgaard',
        rating: 5,
        date: 'June 2026',
        text: 'The duration-ramp framework ended years of 200ms-vs-300ms debates on our team.',
      },
      {
        name: 'Theo Calloway',
        rating: 4.5,
        date: 'May 2026',
        text: 'Advanced is accurate — come with real product experience and it pays off enormously.',
      },
    ],
  },
];

export function getCourse(slug: string): Course | undefined {
  return courses.find((c) => c.slug === slug);
}

export const allTopics: string[] = [...new Set(courses.flatMap((c) => c.topics))];

// --- My-progress data (the signed-in learner: Noa Ellingsen) -------------

export interface Enrollment {
  slug: string;
  completedLessons: number;
  totalLessons: number;
  lastLesson: string;
}

export const enrollments: Enrollment[] = [
  {
    slug: 'color-theory-in-practice',
    completedLessons: 12,
    totalLessons: 12,
    lastLesson: 'Final project: a verified UI palette',
  },
  {
    slug: 'svg-data-visualization',
    completedLessons: 9,
    totalLessons: 14,
    lastLesson: 'Ticks, grids and label collision',
  },
  {
    slug: 'geometric-pattern-design',
    completedLessons: 5,
    totalLessons: 13,
    lastLesson: 'The four everyday wallpaper groups',
  },
  {
    slug: 'typography-systems',
    completedLessons: 2,
    totalLessons: 12,
    lastLesson: 'Modular scales and their ratios',
  },
];

export const quizScores = {
  labels: ['Grids quiz', 'Symmetry quiz', 'Scales quiz', 'Marks quiz', 'Color dials quiz', 'Harmony quiz', 'Systems quiz'],
  scores: [72, 85, 78, 91, 88, 94, 90],
};

// --- Checkpoint quiz ------------------------------------------------------

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
}

export const quiz: { course: string; title: string; questions: QuizQuestion[] } = {
  course: 'Color Theory in Practice',
  title: 'Module 3 checkpoint — Systems and accessibility',
  questions: [
    {
      id: 'q1',
      prompt: 'A tonal ramp is best described as…',
      options: [
        'A set of unrelated accent colors chosen by eye',
        'Steps of one hue varying mainly in lightness',
        'The gradient between two complementary hues',
        'Any palette with more than five swatches',
      ],
      correct: 1,
      explanation: 'A tonal ramp holds hue roughly constant and steps lightness, which is what makes systematic pairing possible.',
    },
    {
      id: 'q2',
      prompt: 'Body text on a background must reach which WCAG AA contrast ratio?',
      options: ['2:1', '3:1', '4.5:1', '7:1'],
      correct: 2,
      explanation: 'AA requires 4.5:1 for normal text; 3:1 applies to large text and UI borders, and 7:1 is the AAA bar.',
    },
    {
      id: 'q3',
      prompt: 'Why does pure RGB lightness mislead when judging contrast?',
      options: [
        'Monitors render RGB inconsistently across brands',
        'The eye weighs green, red and blue very differently',
        'RGB values change with the document color profile',
        'It does not — averaging R, G and B is reliable',
      ],
      correct: 1,
      explanation: 'Perceived lightness is dominated by green and barely moved by blue, so equal RGB averages can differ wildly in apparent brightness.',
    },
    {
      id: 'q4',
      prompt: 'A good error color for a light UI is usually…',
      options: [
        'The most saturated red available',
        'A red tuned to match your palette’s chroma and verified for contrast',
        'Whatever red the platform ships by default',
        'Any hue, as long as an icon accompanies it',
      ],
      correct: 1,
      explanation: 'State colors belong to the system: matched chroma keeps them harmonious, and the contrast check keeps them legible.',
    },
  ],
};
