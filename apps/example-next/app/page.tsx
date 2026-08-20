// A Next.js Server Component. It imports the SSR wrappers from
// `@awc-ui/react/server`, which server-render each component's Declarative
// Shadow DOM (via @awc-ui/core/hydrate) and hydrate on the client — so the very
// first paint is styled, no flash. Swap the import to `@awc-ui/react` for
// client-only rendering.
import { MdButton, MdCheckbox, MdBadge, MdCard } from '@awc-ui/react/server';

export default function Page() {
  return (
    <main style={{ padding: 40, fontFamily: 'system-ui, sans-serif', display: 'grid', gap: 20, maxWidth: 640 }}>
      <h1 style={{ margin: 0 }}>AWC UI — server-rendered (DSD)</h1>
      <p style={{ margin: 0, color: '#555' }}>
        These Material Design 3 web components are rendered on the server with
        Declarative Shadow DOM, then hydrated on the client.
      </p>

      <MdCard variant="elevated">
        <div style={{ padding: 20, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <MdButton variant="filled">Filled</MdButton>
            <MdButton variant="outlined">Outlined</MdButton>
            <MdButton variant="text">Text</MdButton>
            <MdBadge value="3" />
          </div>
          <MdCheckbox checked>Server-checked</MdCheckbox>
        </div>
      </MdCard>
    </main>
  );
}
