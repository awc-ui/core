export const frameworks = Object.freeze([
  { id: 'html', label: 'HTML' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'angular', label: 'Angular' },
  { id: 'svelte', label: 'Svelte' },
]);

// Both docs and standalone builds put the five implementations in sibling
// directories. Keep the hash route, search query, and same storage origin.
export function frameworkUrl(framework, href) {
  if (!frameworks.some(item => item.id === framework)) throw new Error('Unknown Encore framework');
  const url = new URL(href);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.at(-1) === 'index.html') parts.pop();
  if (frameworks.some(item => item.id === parts.at(-1))) parts.pop();
  url.pathname = `/${[...parts, framework].join('/')}/`;
  return url;
}

export function switchFramework(framework) {
  if (!frameworks.some(item => item.id === framework)) return;
  const target = frameworkUrl(framework, location.href);
  if (target.href !== location.href) location.assign(target.href);
}
