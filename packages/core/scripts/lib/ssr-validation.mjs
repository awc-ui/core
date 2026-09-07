/** Check the requested host, not a nested child's unrelated shadow template. */
export function assertSsrResult(tag, result, expectsShadow) {
  const errors = (result.diagnostics ?? []).filter((d) => d.level === 'error');
  if (errors.length) throw new Error(errors.map((d) => d.messageText).join(' | '));
  if (!result.html || !new RegExp(`<${tag}(?:\\s|>)`).test(result.html)) {
    throw new Error('output missing the element');
  }
  if (expectsShadow && !new RegExp(`<${tag}\\b[^>]*>\\s*<template\\b[^>]*\\bshadowrootmode=["']open["']`).test(result.html)) {
    throw new Error('output missing the host declarative shadow root');
  }
}
