// The Web side of the Laboratory presentation: the context the native hosts render around a component
// (PreviewRoot in apps/native-ios-playground/LiveRenderer, LivePreviewActivity on Android), mirrored for Chrome.
const anchor = (id, label = 'Notifications') =>
  `<md-icon-button id="${id}" icon="notifications" size="md" aria-label="${label}" style="--md-icon-button-container-width:48px;--md-icon-button-container-height:48px"></md-icon-button>`;

export function webPresentation(tag, html, node) {
  switch (tag) {
    case 'md-badge':
      return `<div style="position:relative;width:48px;height:48px">${anchor('demo-badge-anchor')}${html}</div>`;
    case 'md-status-dot':
      return node?.properties?.inline === true
        ? `<div style="display:inline-flex;align-items:center;gap:12px">${anchor('demo-status-dot-anchor')}${html}</div>`
        : `<div style="position:relative;width:48px;height:48px">${anchor('demo-status-dot-anchor')}${html}</div>`;
    case 'md-ripple':   // the recipe's token-styled button surface (AWCRippleExampleSurface on the native hosts)
      return `<button type="button" style="position:relative;overflow:hidden;padding:16px 24px;border:0;border-radius:16px;background:var(--md-sys-color-surface-container-highest);color:var(--md-sys-color-on-surface);font:500 14px/20px Roboto,sans-serif;letter-spacing:.1px">Tap to see the ripple${html}</button>`;
    case 'md-time-picker': case 'md-color-picker':   // LivePreviewPicker / the SwiftUI host: 24 px in from the viewport's top-leading corner
      return `<div style="padding:24px">${html}</div>`;
    case 'md-divider':
      return `<div style="width:300px;height:96px;display:flex;align-items:center;justify-content:center">${html}</div>`;
    case 'md-fab-menu': case 'md-fab-menu-item': {
      const anchorId = node?.properties?.anchor;
      return anchorId ? `<div style="position:relative;width:360px;height:480px;display:flex;align-items:center;justify-content:center"><md-fab id="${anchorId}" icon="add" aria-label="Create"></md-fab>${html}</div>` : html;
    }
    case 'md-menu':   // AWCPreviewMenu / LivePreviewMenuHost: the tonal trigger that anchors the recipe menu
      return `<md-button id="${node?.properties?.anchor || 'demo-menu-trigger'}" variant="tonal">Open menu</md-button>${html}`;
    case 'md-side-sheet':   // the Laboratory host shows its launcher next to an inline (standard) side sheet
      return `<md-button variant="tonal">Open side sheet</md-button>${html}`;
    case 'md-segmented-button':   // AWCPreviewSegmented renders the recipe set around a lone segment
      return `<md-segmented-button-set>${html}<md-segmented-button label="Week" value="week"></md-segmented-button><md-segmented-button label="Month" value="month"></md-segmented-button></md-segmented-button-set>`;
    default: return html;
  }
}
