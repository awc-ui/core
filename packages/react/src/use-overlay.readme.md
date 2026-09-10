# `useOverlay`

Keep a conditionally mounted Core dialog, side sheet or menu in React until
its native closing animation finishes. The hook opens the element after mount
and uses Core's `whenClosed()` completion contract to decide when React may
remove it.

```tsx
import { useRef, useState } from 'react';
import { MdButton, MdDialog, useOverlay } from '@awc-ui/react';

function CreateDialog({ onClosed }: { onClosed: () => void }) {
  const dialog = useRef<HTMLMdDialogElement>(null);
  const overlay = useOverlay(dialog, { onClosed });

  return (
    <MdDialog ref={dialog} headline="Create project" {...overlay}>
      {/* Form contents use the regular Core field components. */}
      <MdButton slot="actions" variant="text"
        onMdClick={() => { void dialog.current?.close(); }}>
        Cancel
      </MdButton>
    </MdDialog>
  );
}

export function Projects() {
  const [creating, setCreating] = useState(false);
  return <>
    <MdButton onMdClick={() => setCreating(true)}>Create project</MdButton>
    {creating && <CreateDialog onClosed={() => setCreating(false)} />}
  </>;
}
```

`useOverlay(ref, options)` returns `{ onMdClose }`. Spread it onto the same
`MdDialog`, `MdSideSheet` or `MdMenu` that receives the ref. These components
must come from the matching Core release with `show()`, `close()` and
`whenClosed()` methods.

| Option | Timing |
| --- | --- |
| `onClosing` | At the overlay's own native `mdClose` event; use for early busy-state or draft cleanup. |
| `onClosed` | Once the native open cycle and shell exit finish; use to remove the React component. |

- Close by calling `ref.current.close()`. Do not remove the component directly
  in `onMdClose`, or the exit animation cannot complete.
- `close()` requests dismissal; its returned promise is **not** the exit
  animation boundary. The hook waits for `whenClosed()` separately.
- A close requested before the initial open finishes still calls `onClosed`
  once. No `onClosing` callback fires when Core never entered its open state
  and consequently emitted no `mdClose` event.
- Nested controls may bubble their own `mdClose` events. The hook ignores them
  using the event target and current target, so closing a select does not
  dismiss the surrounding dialog.
- Callback props may change without reopening the overlay; the latest
  callbacks are used. React StrictMode's setup/cleanup replay does not report
  a user dismissal, and an unmounted component cannot call a late `onClosed`.
- Keep the ref stable with `useRef`. Mount a fresh component for each new
  overlay session. The hook is intended for conditional overlays; persistent
  anchor-managed FAB menus own their opening lifecycle. A time picker uses
  `hide()` and is not supported by this hook.

## Tests

From the repository root, after installing the workspace dependencies:

```sh
pnpm --filter @awc-ui/react test:overlay
```

The suite runs the actual hook with React DOM and StrictMode in jsdom. A small
custom element controls the native animation completion boundary, so lifecycle
ordering is deterministic. Core's component tests cover actual overlay motion
and rendering separately. The suite uses the existing Core workspace's
`esbuild` and `jsdom` development dependencies and does not require a build.
