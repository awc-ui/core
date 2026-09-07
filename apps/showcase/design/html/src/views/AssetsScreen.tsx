import { translateUi as p } from '../context';
import { dom, Fragment } from '../dom';
import { field, calculate } from '../context';
import { getAssets } from '@awc-ui/showcase-kit/design';
import { Screen } from '../controls';
import { TextControl, SelectControl } from '../controls';
import { getDocument } from '../context';
import { colorOf, layerFromAsset, LIVE_COMPONENTS, createLayer } from '@awc-ui/pictor-model';
import { getRouter } from '../context';
import { Link } from '../controls';
import { route } from '../context';
import { getTranslator } from '../context';

export function AssetsScreen() {
  const t = getTranslator(), doc = getDocument(), router = getRouter();
  const [query, setQuery] = field('AssetsScreen:query', ''), [kind, setKind] = field('AssetsScreen:kind', 'all'), [limit, setLimit] = field('AssetsScreen:limit', 24);
  const assets = getAssets().filter(asset => (kind === 'all' || asset.kind === kind) && asset.name.toLowerCase().includes(query.toLowerCase()));
  const insert = (layer: ReturnType<typeof createLayer>) => { doc.commitLayers('create', layers => [...layers, layer], [layer.id]); doc.setTool('select'); router.push(route.editor()); };
  return <Screen title={p("The possibility library")} subtitle={p("Good ideas deserve great ingredients. Add any asset directly to your canvas.")} aside={<md-button variant="tonal" icon="arrow_outward" onClick={() => router.push(route.editor())}>{p("Back to studio")}</md-button>}>
    <section className="pictor-section"><div className="pictor-section__head"><div><span className="pictor-eyebrow">{p("BUILT WITH AWC")}</span><h2>{p("Components you can actually touch.")}</h2></div><span className="pictor-muted">{p("Insert, compose, then try them in Present.")}</span></div><div className="pictor-live-library">{LIVE_COMPONENTS.map(item => <md-card variant="outlined" key={item.id}><span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span><h3>{p(item.name)}</h3><p>{p(item.description)}</p><md-button variant="tonal" icon="add" onClick={() => insert(createLayer('component', { x: 16, y: 10, w: 17, h: item.id === 'awc:card' ? 14 : 5 }, { name: item.name, componentId: item.id, fill: '#BEE7AA' }))}>{p("Add to canvas")}</md-button></md-card>)}</div></section>
    <section className="pictor-section" data-asset-library><div className="pictor-section__head"><h2>{p("Collect a little inspiration")}</h2><span className="pictor-muted">{p("{count} assets", { count: assets.length })}</span></div><div className="pictor-library-filters"><TextControl live label={p("Search library")} value={query} onValue={value => { setQuery(value); setLimit(24); }} /><SelectControl label={p("Asset type")} value={kind} onValue={value => { setKind(value); setLimit(24); }} options={[{ value: 'all', label: p("All assets") }, { value: 'image', label: p("Images") }, { value: 'color', label: p("Colors") }, { value: 'text-style', label: p("Typography") }, { value: 'component', label: p("Components") }]} /></div><div className="pictor-library-grid">{assets.slice(0, limit).map(asset => <md-card key={asset.id} variant="outlined" class="pictor-library-card"><Link href={route.asset(asset.id)} className="pictor-library-preview" aria-label={p("View {name}", { name: asset.name })}>{asset.art ? <img src={asset.art.src} alt={t(asset.art.altKey)} loading="lazy" /> : <svg viewBox="0 0 300 200" aria-hidden="true"><rect width="300" height="200" fill={colorOf(asset.color, '#E6EBDC')} />{asset.kind === 'text-style' ? <text x="30" y="136" fontSize="96" fontFamily="Georgia,serif" fill="#203D35">{p("Aa")}</text> : null}</svg>}</Link><div className="pictor-library-meta"><div><Link href={route.asset(asset.id)}><strong>{asset.name}</strong></Link><span>{t(asset.kindKey)}</span></div><md-icon-button icon="add_circle" aria-label={p("Add {name} to canvas", { name: asset.name })} onClick={() => insert(layerFromAsset(asset))} /></div></md-card>)}</div>{!assets.length ? <div className="pictor-empty"><span className="material-symbols-outlined" aria-hidden="true">search_off</span><h3>{p("No ingredients found")}</h3><p>{p("Try a different name or asset type.")}</p></div> : assets.length > limit ? <div className="pictor-library-more"><md-button variant="outlined" icon="expand_more" onClick={() => setLimit(value => value + 24)}>{p("Explore more assets")}</md-button></div> : null}</section>
  </Screen>;
}
