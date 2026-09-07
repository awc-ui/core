/** Keep the adapter runtime hand-owned while Stencil regenerates component metadata. */
export function withVueRuntime<T extends { generator?: (...args: any[]) => any }>(target: T): T {
  return {
    ...target,
    async generator(config: any, compilerCtx: any, buildCtx: any) {
      let redirected = false;
      // Rewrite the generated source at the upstream write boundary. The Vue
      // target writes a relative proxiesFile key into Stencil's in-memory FS;
      // reading an absolute path afterwards can return stale on-disk content.
      const fs = new Proxy(compilerCtx.fs, {
        get(original, key) {
          if (key !== 'writeFile') return Reflect.get(original, key);
          return (path: string, source: string, ...options: any[]) => {
            if (source.includes("from './vue-component-lib/utils'")) {
              source = source.replace("from './vue-component-lib/utils'", "from './runtime.js'");
              redirected = true;
            }
            return original.writeFile(path, source, ...options);
          };
        },
      });
      await target.generator?.(config, { ...compilerCtx, fs }, buildCtx);
      if (!redirected) throw new Error('Vue output target runtime import changed; update withVueRuntime.');
    },
  };
}
