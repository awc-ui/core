const jsonArrayAttributes: Record<string, string[]> = {
  "md-autocomplete": ["options"],
  "md-multi-select": ["options"],
  "md-organization-chart": ["nodes"],
  "md-select": ["options"],
  "md-transfer-list": ["items"],
};

/** Preserve server form values while upstream regenerates Angular accessors. */
export function withAngularSsrAccessors<
  T extends { generator?: (...args: any[]) => any },
>(target: T): T {
  return {
    ...target,
    async generator(config: any, compilerCtx: any, buildCtx: any) {
      const redirected = new Set<string>();
      let proxiesRedirected = false;
      const attributes = new Map<string, Record<string, unknown>>();
      for (const { tagName, properties = [] } of buildCtx.components) {
        const serialized: Record<string, unknown> = {};
        for (const { name, attribute } of properties) {
          if (
            name === "value" &&
            ["md-autocomplete", "md-multi-select"].includes(tagName)
          ) {
            serialized[name] = [attribute ?? null, "values"];
          } else if (typeof attribute === "string") {
            if (jsonArrayAttributes[tagName]?.includes(name))
              serialized[name] = [attribute, "json"];
            else if (
              attribute !==
              name.replace(
                /[A-Z]/g,
                (letter: string) => `-${letter.toLowerCase()}`,
              )
            )
              serialized[name] = attribute;
          } else {
            serialized[name] = false;
          }
        }
        const className = tagName
          .split("-")
          .map((part: string) => part[0].toUpperCase() + part.slice(1))
          .join("");
        attributes.set(className, serialized);
      }
      const fs = new Proxy(compilerCtx.fs, {
        get(original, key) {
          if (key !== "writeFile") return Reflect.get(original, key);
          return (path: string, source: string, ...options: any[]) => {
            if (source.includes("from './angular-component-lib/utils'")) {
              source = source
                .replace(
                  "from './angular-component-lib/utils'",
                  "from './ssr-inputs'",
                )
                .replace(
                  "import { ProxyCmp",
                  "import { initializeSsrInputs, ProxyCmp",
                )
                .replace(
                  /(@ProxyCmp\(\{\s*)(defineCustomElementFn: define(\w+),?)/g,
                  (
                    _,
                    prefix: string,
                    registration: string,
                    className: string,
                  ) => {
                    if (!attributes.has(className))
                      throw new Error(
                        `Missing Angular SSR input metadata for ${className}`,
                      );
                    const metadata = attributes.get(className)!;
                    return Object.keys(metadata).length
                      ? `${prefix}ssrAttributes: ${JSON.stringify(metadata)},\n  ${registration}`
                      : `${prefix}${registration}`;
                  },
                )
                .replaceAll(
                  "this.el = r.nativeElement;",
                  "this.el = r.nativeElement;\n    initializeSsrInputs(this);",
                );
              proxiesRedirected = true;
            }
            if (
              /[/\\](text|select|boolean|number)-value-accessor\.ts$/.test(path)
            ) {
              if (!source.includes("from './value-accessor'")) {
                throw new Error(
                  "Angular accessor base import changed; update withAngularSsrAccessors.",
                );
              }
              source = source.replace(
                "from './value-accessor'",
                "from './ssr-value-accessor'",
              );
              if (/[/\\]boolean-value-accessor\.ts$/.test(path)) {
                const write =
                  "this.el.nativeElement.checked = this.lastValue = value == null ? false : value;";
                if (!source.includes(write))
                  throw new Error(
                    "Angular boolean writer changed; update withAngularSsrAccessors.",
                  );
                source = source.replace(
                  write,
                  "this.writeHostProperty('checked', this.lastValue = value == null ? false : value);",
                );
              }
              redirected.add(path);
            }
            return original.writeFile(path, source, ...options);
          };
        },
      });
      await target.generator?.(config, { ...compilerCtx, fs }, buildCtx);
      if (!proxiesRedirected)
        throw new Error(
          "Angular proxy runtime import changed; update withAngularSsrAccessors.",
        );
      if (redirected.size !== 4)
        throw new Error(
          "Expected four generated Angular accessors; update withAngularSsrAccessors.",
        );
    },
  };
}
