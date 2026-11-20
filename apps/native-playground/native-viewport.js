// Laboratory capture budgets. Public native components use their caller's
// constraints and must not import these preview-only limits.
export const supportsNativeViewportTag = tag => ['md-snackbar', 'md-tooltip', 'md-dialog', 'md-bottom-sheet', 'md-side-sheet', 'md-time-picker', 'md-color-picker', 'md-date-picker'].includes(tag);
const finitePositive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function nativeCaptureViewport(width = 640, height = 240) {
  const appliedWidth = Math.round(Math.min(1200, Math.max(320, width)));
  const maxHeight = Math.min(2000, Math.floor(2_000_000 / appliedWidth));
  return { width: appliedWidth, height: Math.round(Math.min(maxHeight, Math.max(1, height))) };
}

export function nativeCanvasHeight(layoutHeight, measuredHeight) {
  return finitePositive(layoutHeight) ? layoutHeight : finitePositive(measuredHeight) ? measuredHeight : 310;
}

export function nativeLayoutNeedsRender(tag, patch) {
  return 'direction' in patch || 'width' in patch || supportsNativeViewportTag(tag) && ('height' in patch || 'expanded' in patch || 'viewport' in patch);
}

/** The canvas can be larger than a native capture; never label it as rendered. */
export function nativeCanvasReadout(tag, platform, frame, width, height) {
  const canvas = `${Math.round(width)} × ${Math.round(height)} px`;
  if (!supportsNativeViewportTag(tag) || !['ios', 'android'].includes(platform)) return { label: canvas, title: 'Canvas dimensions', notice: '' };
  if (!finitePositive(frame?.logicalWidth) || !finitePositive(frame?.logicalHeight)) return { label: `Canvas ${canvas}`, title: 'Requested canvas dimensions; native capture is pending.', notice: '' };
  const unit = platform === 'ios' ? 'pt' : 'dp';
  const actual = `${Math.round(frame.logicalWidth)} × ${Math.round(frame.logicalHeight)} ${unit}`;
  const differs = Math.abs(width - frame.logicalWidth) > 1 || Math.abs(height - frame.logicalHeight) > 1;
  return { label: `Rendered ${actual}`, title: `Canvas ${canvas}. Native capture ${actual}.`,
    notice: differs ? `Canvas ${canvas}; native capture ${actual}. Laboratory capture limits: width 320–1200, height up to 2000, and 2,000,000 logical pixels. A resize is applied when dragging ends.` : '' };
}


export function nativeViewportCommand(tag, width, height) {
  if (!supportsNativeViewportTag(tag) || !finitePositive(width) || !finitePositive(height)) {
    throw Object.assign(new Error('Resize requires a connected overlay and finite positive width and height.'), { code: 'INVALID_VIEWPORT' });
  }
  return { command: 'resize', ...nativeCaptureViewport(width, height) };
}
