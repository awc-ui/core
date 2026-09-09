# Roam — travel booking

A consumer travel showcase built from existing AWC UI components. Search destinations, compare fictional properties, save favorite stays, complete a sample reservation, and manage it in My trips.

## Run

From the monorepo root, build `@awc-ui/core` and `@awc-ui/theme` if their dist folders are missing, then:

```sh
pnpm --filter @awc-ui/booking dev
```

Open [Roam locally](http://127.0.0.1:4399/). Set `PORT` to use a different port. The server serves the production `dist` directory; rebuild and refresh after source changes.

## Explore

- Search by destination, dates, and guests, then filter and sort the accommodation results.
- Open property details to inspect photos, amenities, capacity, and cancellation policies.
- Save a property and revisit it in Saved stays.
- Complete traveler details, review the price breakdown, and confirm a sample reservation.
- Open My trips to download a sample confirmation or cancel an eligible upcoming reservation.
- Use Make it yours to change the primary color, density, light/dark appearance, and RTL direction.

All properties, availability, prices, reviews, and bookings are fictional demonstrations. Confirming a reservation does not book a hotel or charge a payment method. Use fictional traveler details.

## Demo account

Browse before signing in. Choose **Use demo account** or enter:

| Field    | Demo value       |
| -------- | ---------------- |
| Email    | `alex@roam.demo` |
| Password | `RoamDemo!2026`  |
| MFA code | `246810`         |

Login and signup both lead through six-digit verification. The challenge expires after five minutes and permits five attempts; a resend has a 30-second cooldown and preserves the attempt budget. No identity service or email delivery is connected.

Passwords and pending challenges are kept in memory only. The verified sample profile is stored in this tab's `sessionStorage`, with an eight-hour expiry. Signing out clears the profile. Saved stays and appearance preferences use `localStorage`; sample reservations and search details use this tab's `sessionStorage`. Stays and reservations belong to the browser session, rather than an account, and signing out does not remove them.

## Validation and hosting

```sh
pnpm --filter @awc-ui/booking lint
pnpm --filter @awc-ui/booking test
pnpm --filter @awc-ui/booking build
```

The app contains domain and authentication tests. Its static build includes the AWC runtime, theme helper, local fonts, and font licenses. The docs integration stages it at `/showcase/booking/html/`, preserving `/showcase/booking/` for its documentation page. Hash routes work below either the local or deployed base path.

## Photography

Property photographs are illustrative and do not depict the fictional hotels in the catalog. See [photo credits](public/images/CREDITS.md) for the source photographs.
