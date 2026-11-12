# SL Materials Shop

Small-order concrete shop: homepage plus the online order tool (Buy online, Get a quote, Call us).

- `/` is the **concept demo** for reviewers: no login, orders stay in the visitor's browser, and a
  Shop / Planner switch bar (`demo-bar.js`). Files at the root: `index.html`, `planner.html`, `css/`, `js/`, `img/`.
- `/live/` is the **real version**: orders saved in Supabase, planner sign-in, email and push alerts.
  The table below describes the files under `live/`.
Plain HTML, CSS and JavaScript. No build step, so it runs on any static host.

## Run it

```bash
npm start          # serves the site at http://localhost:8790
npm run version:bump   # before publishing: makes browsers load the new files
npm test           # unit tests for price, volume, postcode, delivery days and step checks
```

## Where things live

| File | What it holds |
| --- | --- |
| `js/config.js` | Every price, the delivery area, contact details. `null` = still to agree (shown as a highlighted `[placeholder]`, left out of the total) |
| `js/catalogue.js` | Project types, mix codes, offloading, consistency and stone options |
| `js/logic.js` | Price, volume calculator, postcode check, delivery days, step rules (no page code, so it is testable) |
| `js/app.js` | The order tool on the page (English and Dutch side by side, via `tx()`) |
| `js/i18n.js` | NL / EN switch: page text carries its Dutch in `data-nl` attributes |
| `planner.html`, `js/planner.js`, `css/planner.css` | Planner inbox (internal): confirm, offer another time, decline, undo |
| `js/orders.js` | Order requests shared by shop and inbox: status changes, customer messages, sample data, storage |
| `css/tokens.css` | Brand colours and type from sl-materials.nl |
| `css/site.css` | Layout, mobile first |
| `img/` | SL logo, icons and photos (taken from sl-materials.nl) |
| `reference/` | The approved mock-ups (design-tool format, for reference only) |

## Not built yet

- Nothing is sent or charged: forms end on a "preview only" note.
- Orders only travel between shop and inbox inside one browser (localStorage). A shared order store
  (server or database) replaces `loadOrders` / `saveOrders` in `js/orders.js`.
- The inbox has no login yet. It must sit behind one before it goes on any public host.
- Customer messages are shown as a preview only; sending (SMS / WhatsApp / email) and the payment link come later.
- Payment provider (Mollie or Stripe).
- Prices not set yet: see the `null` values in `js/config.js` (Saturday surcharge, waiting-time rate, SL pump hire).
- Suggested prices to confirm with the team (marked SUGGESTED in `js/config.js`): fibres €8/m³,
  part load €35 per m³ a truck is short of 8 m³, delivery €95 per truck.
- New-order notifications for planners (email or push) need the live server; the preview shows an alert on the page.
- Uses and extras now follow SL's old shop (betonconcurrent.nl); the strength class of the standard mix is still to confirm.
- Dutch translation of the planner inbox (the shop itself is in Dutch and English).
- Dutch public holidays are not yet excluded from delivery days.
