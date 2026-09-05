/**
 * Studio — the projects, and the arrangement of whichever one is open.
 *
 * There is no projects index screen: Studio IS the list with one open.
 */
import {
  currentProject,
  editIcon,
  editLabelKey,
  getProjects,
  projectBySlug,
  projectClips,
  projectStateIcon,
  projectStateTone,
  projectTracks,
  route,
} from '@awc-ui/showcase-kit/music';
import { attrs, html } from '../lib/html.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';
import { timeline } from '../components/timeline.mjs';
import { art, count, dateText } from '../lib/bits.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { notFoundScreen } from './not-found.mjs';

/**
 * The five buttons that act on the SELECTED clip.
 *
 * IN A TEMPLATE, because they do not exist until a clip is chosen — the four
 * SPA builds render them conditionally, and the parity census counts ELEMENTS
 * rather than visible ones, so five hidden buttons would read as five extra
 * `md-icon-button`s this build has and the others do not. The client clones
 * them on the first selection.
 *
 * THE NAMES ARE FILLED IN BY THE CLIENT from the clip's own `data-name`, so the
 * VERB is written here, translated, and only the noun is substituted.
 */
function clipTools(t) {
  const button = (cls, icon, labelKey, extra = {}) =>
    html`<md-icon-button${attrs({
      class: cls,
      icon,
      size: 'sm',
      'data-verb': t(labelKey),
      ...extra,
    })}></md-icon-button>`;

  return html`${button('studio__nudge-back', 'chevron_left', 'music.edit.clipMove')}${button(
    'studio__nudge-forward',
    'chevron_right',
    'music.edit.clipMove',
  )}${button('studio__shrink', 'compress', 'music.edit.clipResize')}${button(
    'studio__grow',
    'expand',
    'music.edit.clipResize',
  )}${button('studio__delete', 'delete', 'music.edit.clipRemove', { color: 'error' })}`;
}

export function studioScreen(t, locale, slug) {
  const project = slug ? projectBySlug(slug) : currentProject();
  if (!project) return notFoundScreen(t, locale);

  const projects = getProjects();
  const tracks = projectTracks(project);
  const clips = projectClips(project);
  const here = slug ? route.project(project.slug) : route.studio();

  return screen(t, {
    locale,
    here,
    title: t('music.screen.studio.title'),
    subtitle: t('music.screen.studio.subtitle'),
    crumbs: slug
      ? [
          { labelKey: 'music.nav.studio', label: null, href: route.studio() },
          { labelKey: null, label: project.title, href: null },
        ]
      : [],
    aside: count(t, projects.length),
    children: html`<div class="stack">
      ${panel({
        children: html`<div class="studio-head">
          <div class="studio-head__facts">
            ${art(t, project.art, { className: 'project-card__art', eager: true })}
            <div class="project-card__text">
              <h2 class="release-head__title">${project.title}</h2>
              <div class="row">
                <md-chip${attrs({
                  variant: 'assist',
                  appearance: 'outlined',
                  color: projectStateTone[project.state],
                  icon: projectStateIcon[project.state],
                  label: t(project.stateKey),
                })}></md-chip>
                <span class="person-row__meta">${project.bpm} ${t('music.label.bpm')}</span>
                <span class="person-row__meta">${project.bars} ${t('music.label.bars')}</span>
                <span class="person-row__meta">${t('music.hint.updated', { date: '' })}${dateText(t, project.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div class="studio-head__tools">
            <md-button${attrs({
              class: 'studio__undo',
              variant: 'text',
              icon: 'undo',
              size: 'sm',
              'soft-disabled': '',
              'aria-label': t('music.action.undo'),
              'data-label-undo': t('music.action.undo'),
              'data-msg-nothing': t('music.msg.nothingToUndo'),
            })}>${t('music.action.undo')}</md-button>
            <md-button${attrs({
              class: 'studio__redo',
              variant: 'text',
              icon: 'redo',
              size: 'sm',
              'soft-disabled': '',
              'aria-label': t('music.action.redo'),
              'data-label-redo': t('music.action.redo'),
              'data-msg-nothing': t('music.msg.nothingToRedo'),
            })}>${t('music.action.redo')}</md-button>
            <md-icon-button${attrs({
              class: 'studio__zoom-out',
              icon: 'zoom_out',
              size: 'sm',
              'soft-disabled': '',
              'aria-label': t('music.action.zoomOut'),
            })}></md-icon-button>
            <md-icon-button${attrs({
              class: 'studio__zoom-in',
              icon: 'zoom_in',
              size: 'sm',
              'aria-label': t('music.action.zoomIn'),
            })}></md-icon-button>
          </div>
        </div>`,
      })}

      ${panel({
        title: t('music.panel.arrangement'),
        subtitle: t('music.hint.editing'),
        actions: html`<span class="row">${count(t, clips.length)}<template class="studio__tools-template">${clipTools(t)}</template></span>`,
        children: timeline(t, project, tracks),
      })}

      ${panel({
        title: t('music.panel.history'),
        actions: count(t, 0),
        children: html`${emptyState(t('music.empty.history'))}
          <!--
            ONE PROTOTYPE ROW PER EDIT KIND, translated by the build.

            The client has no dictionary, so it cannot name an edit it has just
            recorded — it clones the row for that kind out of here. A template,
            because the history opens empty in all five builds and eight hidden
            rows would be eight elements the census does not find elsewhere.
          -->
          <template class="studio__history-template">${Object.keys(editIcon).map(
            (kind) => html`<div class="history-row"${attrs({ 'data-kind': kind })}>
              <span class="material-symbols-outlined" aria-hidden="true">${editIcon[kind]}</span>
              <span>${t(editLabelKey[kind])}</span>
            </div>`,
          )}</template>
          <div class="history-list"></div>`,
      })}

      ${panel({
        title: t('music.panel.projects'),
        actions: count(t, projects.length),
        children: html`<div class="stack">${projects.map(
          (other) => html`<a class="project-card"${attrs({
            href: localeHref(locale, route.project(other.slug)),
            'data-current': other.id === project.id ? true : undefined,
            'data-project': other.slug,
          })}>
            ${art(t, other.art, { className: 'project-card__art' })}
            <span class="project-card__text">
              <span class="track-row__title">${other.title}</span>
              <span class="track-row__meta">${t(other.stateKey)} · ${other.bars} ${t('music.label.bars')}</span>
            </span>
          </a>`,
        )}</div>`,
      })}
    </div>`,
  });
}
