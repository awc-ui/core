# md-meter — accessibility parity

Generated 2026-11-05T01:32:18.766Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: meter:Storage used
- macos (pass): meter:Storage used
- ios (pass):  · text: Storage used 72%
  - expected text-extra: ios exposes text Web does not: "72%" — Web role=meter. UIKit has no meter trait: the meter is a static text read with its value (percentage or aria-valuetext).
- android (pass): progressbar:Storage used

## valuetext

- Web: meter:Rating
- macos (pass): meter:Rating
- ios (pass):  · text: Rating 3 of 5 stars
  - expected text-extra: ios exposes text Web does not: "3 of 5 stars" — Web role=meter. UIKit has no meter trait: the meter is a static text read with its value (percentage or aria-valuetext).
- android (pass): progressbar:Rating

## circular

- Web: meter:Battery
- macos (pass): meter:Battery
- ios (pass):  · text: Battery 40%
  - expected text-extra: ios exposes text Web does not: "40%" — Web role=meter. UIKit has no meter trait: the meter is a static text read with its value (percentage or aria-valuetext).
- android (pass): progressbar:Battery
