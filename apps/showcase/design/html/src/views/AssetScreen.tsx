import { translateUi as p } from '../context';
import { dom, Fragment } from '../dom';
import { field, calculate } from '../context';
import { assetById, assetUsage } from '@awc-ui/showcase-kit/design';
import { Screen } from '../controls';
import { NotFoundScreen } from './NotFoundScreen';
import { getDocument } from '../context';
import { getRouter } from '../context';
import { Link } from '../controls';
import { route } from '../context';
import { colorOf, documentSvg, layerFromAsset } from '@awc-ui/pictor-model';
import { getTranslator } from '../context';

export function AssetScreen({ assetId }: { assetId: string }) {
  const t = getTranslator(), doc = getDocument(), router = getRouter();
  const asset = assetById(assetId);
  if (!asset) return <NotFoundScreen />;
  const usage = assetUsage(asset);
  const insert = () => { const layer = layerFromAsset(asset); doc.commitLayers('create', layers => [...layers, layer], [layer.id]); doc.setTool('select'); router.push(route.editor()); };
  return <Screen title={asset.name} subtitle={p("One ingredient. Endless possible compositions.")} crumbLabel={asset.name} aside={<md-button variant="filled" icon="add" onClick={insert}>{p("Add to canvas")}</md-button>}><div className="pictor-asset-detail"><div className="pictor-asset-detail__art">{asset.art ? <img src={asset.art.src} alt={t(asset.art.altKey)} /> : <svg viewBox="0 0 600 400" aria-label={asset.name}><rect width="600" height="400" fill={colorOf(asset.color, '#E6EBDC')} />{asset.kind === 'text-style' ? <text x="70" y="270" fontSize="210" fontFamily="Georgia,serif" fill="#203D35">{p("Aa")}</text> : null}</svg>}</div><div className="pictor-asset-detail__copy"><span className="pictor-eyebrow">{p("YOUR CREATIVE INGREDIENT")}</span><h2>{asset.name}</h2><md-chip label={t(asset.kindKey)} /><p>{p("Add this asset as an editable layer in your current design. Move it, resize it, and make it part of something new.")}</p>{asset.color ? <code>{colorOf(asset.color)}</code> : null}<md-button variant="filled" icon="add" onClick={insert}>{p("Use in my design")}</md-button><md-button variant="text" icon="arrow_back" onClick={() => router.push(route.assets())}>{p("Explore the library")}</md-button></div></div><section className="pictor-section"><div className="pictor-section__head"><h2>{p("Related designs")}</h2><span className="pictor-muted">{p("{count} design files", { count: usage.length })}</span></div><div className="pictor-file-grid">{usage.map(file => <md-card key={file.id} class="pictor-file-card" variant="outlined"><Link href={route.file(file.id)} className="pictor-file-preview"><img src={`data:image/svg+xml,${encodeURIComponent(documentSvg(doc.layersForFile(file.id), t))}`} alt={p("{name} design", { name: file.name })} /></Link><div className="pictor-file-meta"><Link href={route.file(file.id)}><strong>{file.name}</strong><span>{p("{count} editable layers", { count: doc.layersForFile(file.id).length })}</span></Link><span className="material-symbols-outlined" aria-hidden="true">arrow_outward</span></div></md-card>)}</div>{!usage.length ? <p className="studio-description">{p("Be the first to put this asset to work in your current canvas.")}</p> : null}</section></Screen>;
}
