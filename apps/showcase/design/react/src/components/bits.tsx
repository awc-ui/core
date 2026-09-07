/**
 * The small, repeated pieces of Pictor's screens.
 *
 * Anything drawn on more than one screen lives here, so a project card looks
 * the same on Projects as it does inside a project drill. Anything drawn once
 * stays in its screen — a bit that exists to be used twice and is used once is
 * indirection with no payer.
 *
 * None of these knows how to fetch. They take a record and render it.
 */

import {
  assetIcon,
  fileStateIcon,
  fileStateKey,
  fileStateTone,
  handleInitial,
  layerIcon,
  paletteHex,
  projectSlug,
  type Asset,
  type ComponentDef,
  type DesignFile,
  type Layer,
  type Project,
} from '@awc-ui/showcase-kit/design';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';

/* ------------------------------------------------------------------ chips */

/** A file's review state, as the four-way tone every console here uses. */
export function StateChip({ file }: { file: DesignFile }) {
  const t = useT();
  return (
    <md-chip
      label={t(fileStateKey(file.state))}
      icon={fileStateIcon(file.state)}
      tone={fileStateTone(file.state)}
      size="small"
    />
  );
}

/** A layer's kind, for the places a row has room to spell it out. */
export function KindChip({ layer }: { layer: Layer }) {
  const t = useT();
  return <md-chip label={t(layer.kindKey)} icon={layerIcon(layer.kind)} size="small" tone="neutral" />;
}

/* ------------------------------------------------------------------ people */

/**
 * WHO ELSE IS ON THIS FILE. Handles only — the fixture has one full person in
 * it, and inventing three more with names and faces to fill an avatar stack
 * would be three more records to keep consistent for a decoration nobody
 * drills into. The initial comes from the handle, which is honest about what
 * is known.
 */
export function EditorStack({ handles }: { handles: readonly string[] }) {
  const t = useT();
  return (
    <div className="row row--tight" aria-label={t('design.label.editors', { count: String(handles.length) })}>
      {handles.map((handle) => (
        <md-avatar key={handle} name={handleInitial(handle)} label={handle} size="x-small" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ cards */

export function ProjectCard({ project }: { project: Project }) {
  const t = useT();
  return (
    <Link href={route.project(projectSlug(project))} className="tile" aria-label={project.name}>
      <img className="tile__art" src={project.art.src} alt={t(project.art.altKey)} loading="lazy" />
      <span className="tile__title">{project.name}</span>
      <span className="tile__meta">{t('design.label.files', { count: String(project.fileIds.length) })}</span>
    </Link>
  );
}

export function FileCard({ file }: { file: DesignFile }) {
  const t = useT();
  return (
    <Link href={route.file(file.id)} className="tile" aria-label={file.name}>
      <img className="tile__art" src={file.art.src} alt={t(file.art.altKey)} loading="lazy" />
      <span className="tile__title">{file.name}</span>
      <span className="tile__meta">
        {t('design.label.layers', { count: String(file.layers.length) })}
      </span>
      <StateChip file={file} />
    </Link>
  );
}

export function AssetCard({ asset }: { asset: Asset }) {
  const t = useT();
  const hex = paletteHex(asset.color);
  return (
    <Link href={route.asset(asset.id)} className="tile" aria-label={asset.name}>
      {asset.art ? (
        <img className="tile__art" src={asset.art.src} alt={t(asset.art.altKey)} loading="lazy" />
      ) : (
        /*
         * A COLOUR ASSET HAS NO PICTURE, so the swatch IS the picture — and it
         * is drawn by a generated `[data-token]` rule rather than an inline
         * style, for the reason the whole canvas is: no `style` attribute may
         * survive the deployed policy.
         */
        <span
          className="tile__art swatch swatch--large"
          data-token={asset.color ?? undefined}
          role="img"
          aria-label={`${asset.name}${hex ? `, ${hex}` : ''}`}
        />
      )}
      <span className="tile__title">{asset.name}</span>
      <span className="tile__meta">
        <md-icon>{assetIcon(asset.kind)}</md-icon>
        {t(asset.kindKey)}
      </span>
    </Link>
  );
}

export function ComponentCard({ component }: { component: ComponentDef }) {
  const t = useT();
  return (
    <div className="tile">
      <img className="tile__art" src={component.art.src} alt={t(component.art.altKey)} loading="lazy" />
      <span className="tile__title">{component.name}</span>
      <span className="tile__meta">
        {t('design.label.instances', { count: String(component.instanceCount) })}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------- rows */

/** A file as a row rather than a tile — for lists inside a project. */
export function FileRow({ file }: { file: DesignFile }) {
  const t = useT();
  return (
    <Link href={route.file(file.id)} className="data-row" aria-label={file.name}>
      <img className="data-row__art" src={file.art.src} alt={t(file.art.altKey)} loading="lazy" />
      <span className="data-row__text">
        <span className="data-row__title">{file.name}</span>
        <span className="data-row__meta">
          {t('design.label.layers', { count: String(file.layers.length) })}
        </span>
      </span>
      <StateChip file={file} />
      <EditorStack handles={file.editorHandles} />
    </Link>
  );
}
