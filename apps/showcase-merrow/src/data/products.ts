export interface Product {
  slug: string;
  name: string;
  category: 'Tableware' | 'Kitchen' | 'Textiles' | 'Decor';
  price: number;
  rating: number;
  reviews: number;
  tags: string[];
  blurb: string;
  description: string;
  details: string[];
  tone: 'clay' | 'moss' | 'flax' | 'slate';
  /** Percentage of reviews per star, from 5 stars down to 1. */
  breakdown: [number, number, number, number, number];
}

export const products: Product[] = [
  {
    slug: 'alder-stoneware-dinner-set',
    name: 'Alder Stoneware Dinner Set',
    category: 'Tableware',
    price: 86,
    rating: 4.5,
    reviews: 128,
    tags: ['Stoneware', 'Dishwasher safe', '12 pieces'],
    blurb: 'Twelve-piece glazed stoneware set in a speckled oat finish.',
    description:
      'Hand-finished in our Whitby studio, the Alder set pairs a speckled oat glaze with an unglazed foot ring for grip. Each of the twelve pieces is kiln-fired twice, so the surface shrugs off cutlery marks and daily dishwasher cycles.',
    details: ['4 dinner plates, 4 side plates, 4 bowls', 'Dishwasher and microwave safe', 'Glazed stoneware, 1240°C fired'],
    tone: 'clay',
    breakdown: [62, 24, 9, 3, 2],
  },
  {
    slug: 'bramble-linen-throw',
    name: 'Bramble Linen Throw',
    category: 'Textiles',
    price: 64,
    rating: 4,
    reviews: 74,
    tags: ['100% linen', 'Machine washable'],
    blurb: 'Stonewashed heavyweight linen throw with a hand-knotted fringe.',
    description:
      'Woven from long-staple European flax and stonewashed for a soft, lived-in drape, the Bramble throw gets better with every wash. The hand-knotted fringe is twisted rather than sewn, so it never unravels in the machine.',
    details: ['170 × 130 cm', '100% stonewashed linen, 310 gsm', 'Machine wash at 30°C'],
    tone: 'moss',
    breakdown: [48, 31, 14, 5, 2],
  },
  {
    slug: 'cove-oak-serving-board',
    name: 'Cove Oak Serving Board',
    category: 'Kitchen',
    price: 38,
    rating: 5,
    reviews: 41,
    tags: ['Solid oak', 'Food-safe oil'],
    blurb: 'End-grain oak board with a carved thumb groove and leather loop.',
    description:
      'Cut from a single stave of English oak, the Cove board is finished with food-safe hard wax oil and a vegetable-tanned leather hanging loop. The end-grain surface is kind to knife edges and closes up around scores over time.',
    details: ['40 × 22 × 2.5 cm', 'Solid English oak, hard wax oil finish', 'Hand wash and re-oil monthly'],
    tone: 'flax',
    breakdown: [88, 10, 2, 0, 0],
  },
  {
    slug: 'dunmore-ribbed-vase',
    name: 'Dunmore Ribbed Vase',
    category: 'Decor',
    price: 42,
    rating: 4.5,
    reviews: 96,
    tags: ['Recycled glass', 'Handblown'],
    blurb: 'Handblown ribbed vase in recycled bottle glass with a sage tint.',
    description:
      'Each Dunmore vase is blown from around thirty recycled bottles, which lends the glass its pale sage tint and the occasional seed bubble. The deep ribbing catches low light beautifully and hides water lines between refreshes.',
    details: ['H 26 cm, Ø 14 cm', '100% recycled glass', 'Each piece unique — expect slight variation'],
    tone: 'moss',
    breakdown: [58, 30, 8, 3, 1],
  },
  {
    slug: 'fenwick-cast-iron-casserole',
    name: 'Fenwick Cast-Iron Casserole',
    category: 'Kitchen',
    price: 119,
    rating: 4.5,
    reviews: 203,
    tags: ['Cast iron', 'Oven to table', '4.2 L'],
    blurb: 'Enamelled 4.2-litre casserole with a self-basting lid.',
    description:
      'The Fenwick casserole carries heat evenly from a low flame and holds it at the table for an hour. Dimples on the underside of the lid return condensation to the pot, and the cream enamel interior makes fond easy to judge.',
    details: ['4.2 L, fits a whole chicken', 'Enamelled cast iron, oven safe to 250°C', 'Suitable for induction'],
    tone: 'slate',
    breakdown: [66, 22, 7, 3, 2],
  },
  {
    slug: 'hartley-wool-cushion',
    name: 'Hartley Wool Cushion',
    category: 'Textiles',
    price: 48,
    rating: 4,
    reviews: 57,
    tags: ['Lambswool', 'Feather pad included'],
    blurb: 'Basket-weave lambswool cushion in undyed natural marl.',
    description:
      'Woven in a small Yorkshire mill from undyed lambswool, the Hartley cushion keeps the fleece\'s natural marl rather than masking it with dye. It ships with a duck-feather pad sized one up from the cover for a full, corner-filling shape.',
    details: ['50 × 50 cm cover, 55 × 55 cm pad', '100% undyed lambswool front, cotton back', 'Concealed brass zip'],
    tone: 'flax',
    breakdown: [45, 34, 15, 4, 2],
  },
  {
    slug: 'larkspur-glass-carafe',
    name: 'Larkspur Glass Carafe',
    category: 'Tableware',
    price: 29,
    rating: 3.5,
    reviews: 88,
    tags: ['Borosilicate', 'Tumbler lid'],
    blurb: 'Bedside carafe in borosilicate glass with a tumbler that doubles as its lid.',
    description:
      'The Larkspur carafe holds three-quarters of a litre and its tumbler seats snugly on the neck to keep dust out overnight. Borosilicate glass shrugs off boiling water, so it works just as well for late tea as for water.',
    details: ['750 ml carafe, 250 ml tumbler', 'Borosilicate glass, dishwasher safe', 'Tumbler doubles as the lid'],
    tone: 'slate',
    breakdown: [34, 28, 22, 10, 6],
  },
  {
    slug: 'marlow-rattan-pendant',
    name: 'Marlow Rattan Pendant Shade',
    category: 'Decor',
    price: 74,
    rating: 4.5,
    reviews: 63,
    tags: ['Hand-woven', 'E27 fitting'],
    blurb: 'Open-weave rattan pendant shade that throws soft, dappled light.',
    description:
      'Hand-woven over a powder-coated steel frame, the Marlow shade scatters light through an open rattan weave for a warm, dappled glow. It hangs from a standard E27 fitting and arrives assembled — no tools, no patience required.',
    details: ['Ø 45 cm, H 30 cm', 'Natural rattan on steel frame', 'Fits any standard E27 pendant cord'],
    tone: 'clay',
    breakdown: [55, 32, 9, 3, 1],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function formatPrice(value: number): string {
  return `£${value.toFixed(2)}`;
}
