import { fileById, getProjects, type Layer } from '@awc-ui/showcase-kit/design';
import { makeTemplate } from './editor-model';

type TemplateId = 'orbit' | 'pulse' | 'field';
interface Brief {
  template: TemplateId;
  brand: string;
  headline: string;
  body: string;
  action: string;
  colors?: Readonly<Record<string, string>>;
}

const briefs: Readonly<Record<string, Brief>> = {
  'fl-01': { template: 'orbit', brand: 'MERIDIAN®  /  BRAND SYSTEMS', headline: 'Make room\nfor extraordinary.', body: 'A little structure. Infinite possibility.\nA new chapter for a brand in motion.', action: 'MEET THE NEW MERIDIAN ↗' },
  'fl-05': { template: 'orbit', brand: 'MERIDIAN®  /  THE DETAILS', headline: 'Every detail,\nconsidered.', body: 'One clear direction. A thousand possibilities.\nA system that makes space for your ideas.', action: 'FIND YOUR OWN RHYTHM ↗', colors: { '#F4F1E9': '#E7EEE5', '#D6E8AE': '#E2C8AF', '#D8DFD1': '#C6D3C3' } },
  'fl-09': { template: 'orbit', brand: 'MERIDIAN®  /  AFTER HOURS', headline: 'Bright ideas.\nAfter dark.', body: 'The same unmistakable character.\nA softer light. A different perspective.', action: 'EXPLORE THE NIGHT ↗', colors: { '#F4F1E9': '#183A32', '#203D35': '#EAF3DF', '#51645D': '#B8CABD', '#D6E8AE': '#587749', '#D8DFD1': '#355349' } },
  'fl-02': { template: 'pulse', brand: 'ATLAS  /  YOUR WORLD, CLOSER', headline: 'A world\nwithin reach.', body: 'A little curiosity goes a long way.\nFind your people, places and possibilities.', action: 'A NEW WAY TO EXPLORE ↗', colors: { '#392263': '#202E4B', '#E2CCE8': '#C5D4E8' } },
  'fl-06': { template: 'pulse', brand: 'ATLAS  /  A FRESH START', headline: 'Room for\nwhat comes next.', body: 'Every collection begins with one good find.\nSave a place. Start a story. Make it yours.', action: 'YOUR FIRST DISCOVERY ↗', colors: { '#392263': '#4C294F', '#E2CCE8': '#E4C5D8' } },
  'fl-10': { template: 'pulse', brand: 'ATLAS  /  OFF THE BEATEN PATH', headline: 'Take the\nscenic route.', body: 'For the moments you did not plan.\nAnd the places you will never forget.', action: 'FOLLOW YOUR CURIOSITY ↗', colors: { '#392263': '#194C4A', '#E2CCE8': '#C2D8D1', '#E3ED9C': '#F1D8B4' } },
  'fl-03': { template: 'field', brand: 'HARBOUR', headline: 'Good stories.\nA fair price.', body: 'Independent voices. Fresh perspectives.\nA small subscription to a wider world.', action: 'FIND YOUR NEXT READ ↗', colors: { '#EEE8DC': '#E8ECEB', '#9D382B': '#2C4F65', '#665F51': '#596A72' } },
  'fl-07': { template: 'field', brand: 'HARBOUR', headline: 'Small details.\nLasting character.', body: 'A visual language with room to breathe.\nSimple forms. Familiar feelings.', action: 'LOOK A LITTLE CLOSER ↗', colors: { '#EEE8DC': '#F0E5DD', '#9D382B': '#844937', '#665F51': '#726359' } },
  'fl-11': { template: 'field', brand: 'HARBOUR', headline: 'Follow your\ncuriosity.', body: 'An open invitation to get a little lost.\nThe next good story is just around the corner.', action: 'CHOOSE A NEW CHAPTER ↗', colors: { '#EEE8DC': '#DCE6DD', '#9D382B': '#31564B', '#665F51': '#596C61' } },
  'fl-04': { template: 'field', brand: 'FIELDNOTE', headline: 'A good place\nto begin.', body: 'For the ideas waiting to become something.\nStart small. Stay curious. Keep going.', action: 'MAKE YOUR FIRST MARK ↗' },
  'fl-08': { template: 'field', brand: 'FIELDNOTE', headline: 'Give every\nword a voice.', body: 'A thoughtful rhythm of type and space.\nLet the important things speak for themselves.', action: 'FIND YOUR EXPRESSION ↗', colors: { '#EEE8DC': '#F2E5D7', '#9D382B': '#864824', '#665F51': '#766353' } },
  'fl-12': { template: 'field', brand: 'FIELDNOTE', headline: 'Good things,\nbrought together.', body: 'A collection of moments worth keeping.\nUseful ideas. Beautiful little discoveries.', action: 'BUILD YOUR COLLECTION ↗', colors: { '#EEE8DC': '#E9E4CF', '#9D382B': '#5A602E', '#665F51': '#6C6D50' } },
};

const empty: readonly Layer[] = Object.freeze([]);
const seeds = new Map<string, readonly Layer[]>();

/** Initial content only. Stored documents are resolved by DocumentProvider first. */
export function curatedLayersForFile(fileId: string): readonly Layer[] {
  const cached = seeds.get(fileId);
  if (cached) return cached;
  const file = fileById(fileId);
  if (!file) return empty;
  const project = getProjects().find(project => project.id === file.projectId);
  const brief: Brief = briefs[fileId] ?? {
    template: 'orbit', brand: (project?.name ?? 'PICTOR').toUpperCase(),
    headline: file.name, body: 'An idea with room to grow.\nMake it unmistakably yours.', action: 'EXPLORE THE POSSIBILITIES ↗',
  };
  const template = makeTemplate(brief.template).layers;
  const ids = new Map(template.map((layer, index) => [layer.id, `seed-${fileId}-${index}`]));
  const edition = `${file.name.toUpperCase()}  /  ${project?.name.toUpperCase() ?? 'PICTOR STUDIO'}`;
  const copy: Record<number, string> = brief.template === 'orbit'
    ? { 1: brief.brand, 4: brief.headline, 5: brief.body, 7: brief.action, 8: file.name.toUpperCase() }
    : brief.template === 'pulse'
      ? { 2: brief.brand, 3: brief.headline, 4: brief.body, 6: brief.action }
      : { 1: brief.brand, 2: edition, 4: brief.headline, 5: brief.body, 6: brief.action };
  const layers = template.map((layer, index): Layer => Object.freeze({
    ...layer,
    id: ids.get(layer.id)!,
    parentId: layer.parentId ? ids.get(layer.parentId)! : null,
    name: copy[index] ?? (index === 0 ? 'Canvas background' : layer.name),
    textKey: null,
    fill: layer.fill ? brief.colors?.[layer.fill] ?? layer.fill : null,
    rect: Object.freeze({ ...layer.rect }),
    adjustments: Object.freeze(layer.adjustments.map(adjustment => Object.freeze({ ...adjustment }))),
    art: layer.art ? Object.freeze({ ...layer.art }) : null,
  }));
  const initial = Object.freeze(layers);
  seeds.set(fileId, initial);
  return initial;
}
