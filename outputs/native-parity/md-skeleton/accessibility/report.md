# md-skeleton — accessibility parity

Generated 2026-10-29T11:11:40.232Z by tools/ax. Web = Chrome AX tree of the same effective node.

## announce

- Web: status:Loading
- macos (pass): progressbar:Loading
  - expected extra: macos exposes progressbar "Loading" that Web does not — Web role=status "Loading". Native presents the platform busy indicator named "Loading" (see the skeleton role entry) instead of a text status.
- ios (pass): progressbar:Loading
  - expected extra: ios exposes progressbar "Loading" that Web does not — Web role=status "Loading"; iOS presents it as the activity indicator named "Loading" (polite announcement on appear).
- android (pass): status:Loading

## silent

- Web: (no semantic elements)
- macos (pass): 
- ios (pass): 
- android (pass): 
