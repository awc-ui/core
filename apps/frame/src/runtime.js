// The runtime and its lazy chunks are served beside each framework build.
export async function ensureAwc() {
  await import(/* @vite-ignore */ new URL('./awc/md3.esm.js', document.baseURI).href);
}
