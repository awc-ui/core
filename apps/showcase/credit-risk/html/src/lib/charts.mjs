/**
 * The four chart elements, as markup.
 *
 * TWO CHANNELS, AND THE SPLIT IS DELIBERATE.
 *
 * `series` / `data` / `nodes` ride in a `serialized:` attribute, because that
 * is what makes the component's accessible data table — the screen-reader
 * version of the plot — render into the static HTML. That table is the one
 * thing that makes a canvas chart legible with JavaScript off, so it is worth
 * putting the payload in the markup.
 *
 * `xAxis` / `yAxis` / `yAxes` and `valueFormatter` ride in `data-chart` and are
 * applied by `client/charts.mjs` after load: the axes do not deserialize from
 * their attributes (an inconsistency in the components' prop declarations,
 * reported upstream, and the reason a chart set up from markup alone draws
 * `0..6` down the axis instead of the category names), and a formatter is a
 * closure over the translator, which no attribute could ever have carried.
 *
 * Paying for a script here costs this build nothing. A chart draws into a
 * `<canvas>`, and a canvas cannot be pre-painted — the plot is already
 * conditional on JavaScript in all six builds. Doing the same for the tables
 * would have cost something real, which is why those are written out complete.
 */

import { attrs, html, raw } from './html.mjs';
import { prop } from './props.mjs';

/**
 * @param {string} tag one of md-bar-chart / md-line-chart / md-area-chart
 * @param {object} options
 *   `series`     — plotted data, serialised into the attribute
 *   `config`     — { xAxis, yAxis, yAxes, format, axisFormats } for the client
 *   `attributes` — everything the component's readme lists as an attribute
 */
function chart(tag, { series, config = {}, attributes = {} }) {
  return html`<${raw(tag)}${attrs({
    series: prop(series),
    'data-chart': JSON.stringify(config),
    ...attributes,
  })}></${raw(tag)}>`;
}

export const barChart = (options) => chart('md-bar-chart', options);
export const lineChart = (options) => chart('md-line-chart', options);
export const areaChart = (options) => chart('md-area-chart', options);

/**
 * The KPI-tile sparkline. `labels` and `data` are both structured; `format`
 * travels in `data-chart` like the charts above, because the tooltip formatter
 * is a closure too.
 */
export function sparkline({ data, labels, format = 'currency', attributes = {} }) {
  return html`<md-sparkline${attrs({
    data: prop(data),
    labels: prop(labels),
    'data-chart': JSON.stringify({ format }),
    ...attributes,
  })}></md-sparkline>`;
}

export function organizationChart({ nodes, attributes = {} }) {
  return html`<md-organization-chart${attrs({ nodes: prop(nodes), ...attributes })}></md-organization-chart>`;
}
