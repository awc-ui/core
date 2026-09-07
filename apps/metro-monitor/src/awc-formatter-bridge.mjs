/**
 * Compatibility bridge for the current local AWC direct custom-element build.
 * In this build the host IS the component instance; forwarding an accessor to
 * itself recurses before the field can render. Lazy builds use a separate host.
 * Keep formatter/parser updates reactive in both cases.
 */
export function bridgeFormatterProps() {
  for (const key of ["formatter", "parser"]) {
    const sameInstance = this.el === this;
    let current = this[key];
    Object.defineProperty(this.el, key, {
      configurable: true,
      get: () => (sameInstance ? current : this[key]),
      set: (fn) => {
        if (sameInstance) current = fn;
        else this[key] = fn;
        if (!this.focused) this.syncDisplayValue();
        this.formatterEpoch++;
      },
    });
  }
}
