/**
 * The inline composer at the top of the feed.
 *
 * IT IS A TRIGGER UNTIL IT IS PRESSED, which is the whole reason this vertical
 * has no Create destination.
 *
 * BOTH STATES ARE WRITTEN, but the open form goes into a `<template>` rather
 * than a hidden div. The parity census counts ELEMENTS, not visible ones, so a
 * hidden form read as a text field, four chips and two buttons the four SPA
 * builds do not render until it is opened. A template's contents are an inert
 * fragment outside the document — and cloning still costs no translation,
 * because every label inside was written by the build in the page's language.
 */

import { AUDIENCES, audienceIcon } from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { avatar, verified } from '../lib/bits.mjs';

export function composer(t, viewer) {
  const first = AUDIENCES.find((a) => a.value === 'friends') ?? AUDIENCES[0];

  return html`<div class="composer composer__closed">
      ${avatar(t, viewer, { size: 'medium' })}
      <!-- A BUTTON, not a read-only text field styled as one: a field would take
           focus, show a caret and accept typing that goes nowhere. -->
      <button type="button" class="composer__trigger">${t('community.action.writeSomething', {
        name: viewer.displayName.split(' ')[0],
      })}</button>
    </div>

    <template class="composer__open-template"><div class="composer__open">
      <div class="composer">
        ${avatar(t, viewer, { size: 'medium' })}
        <span class="post-card__names">
          <span class="post-card__name">${viewer.displayName}${verified(t, viewer)}</span>
          <span class="post-card__meta">
            <span class="material-symbols-outlined composer__audience-icon" aria-hidden="true">${
              audienceIcon[first.value]
            }</span>
            <span class="composer__audience-label">${t(first.labelKey)}</span>
          </span>
        </span>
      </div>

      <md-text-field${attrs({
        class: 'composer__body',
        variant: 'outlined',
        label: t('community.panel.compose'),
        multiline: 'auto-grow',
        rows: '3',
        'full-width': true,
      })}></md-text-field>

      <div class="composer__foot">
        <!-- Four audiences as filter chips rather than a select: each needs a
             sentence of explanation, and a select hides them behind the one
             that happens to be chosen. -->
        ${AUDIENCES.map(
          (option) => html`<md-chip${attrs({
            class: 'composer__audience',
            variant: 'filter',
            appearance: 'outlined',
            icon: audienceIcon[option.value],
            label: t(option.labelKey),
            selected: option.value === first.value,
            'data-audience': option.value,
            'data-icon': audienceIcon[option.value],
            'data-label': t(option.labelKey),
          })}></md-chip>`,
        )}
        <span class="composer__spacer"></span>
        <md-button${attrs({ class: 'composer__cancel', variant: 'text' })}>${t(
          'community.action.cancel',
        )}</md-button>
        <md-button${attrs({
          class: 'composer__post',
          variant: 'filled',
          icon: 'send',
          'soft-disabled': true,
          'data-msg': t('community.msg.posted'),
          'data-need': t('community.hint.needBody'),
        })}>${t('community.action.post')}</md-button>
      </div>
    </div></template>`;
}
