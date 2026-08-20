# Wishwell

A social wishlist and gifting app. People write down what they want and *why*, share
one link, and everyone buying can coordinate without spoiling the surprise.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, and SQLite.

```bash
npm install
npm run media   # fetches the demo photography, builds the demo video notes
npm run seed    # builds the demo database
npm run dev     # http://localhost:3000
```

`npm run media` is not optional on a fresh clone: the photographs are other
people's work and are not committed here, so `public/media` starts empty and the
seed reads its credits from it. Every image is pinned by id in
`scripts/media-manifest.mjs`, so the set you get is the set in the screenshots.

Sign in as the demo account with **hunter@wishwell.app** / **wishwell**. Every demo
person uses the same password (`maya@`, `dev@`, `nora@`, `theo@wishwell.app`).

---

## The idea

A claim on a gift has to be two contradictory things at once: public enough that two
people never buy the same present, and private enough that the surprise survives.
Wishwell resolves that by answering the question *differently depending on who is
asking*, and by enforcing the difference on the server.

**Two grounds, one design system.** Looking at someone else's list puts you in the
*gallery* — lights down, photographs lit. Managing your own puts you in the *studio* —
paper, hairlines, everything legible. Both read the same semantic tokens
(`bg`, `fg`, `muted`, `rule`, `accent`), so a component is correct on either ground
with no conditionals. See `app/globals.css`.

**Two typefaces with two jobs.** Product chrome speaks in Instrument Sans. *People*
speak in Newsreader — every description, bio, and "why I want this" is set in it, so a
list reads like a letter inside a precise interface.

**The hold tag** is the signature object: a paper tag that ties onto anything already
spoken for. Its opposite is the **veil** — what an owner sees instead of a spoiler.

## How the surprise is kept

`resolveGiftState()` in `lib/queries.ts` is the only place gift state is decided:

- **Owner, surprise mode on** → every item resolves to `hidden`. The answer is never
  put in the payload, so it cannot be dug out of the page source or a network response.
- **Owner, surprise mode off** → item-level status, still never the buyer's identity.
- **Anyone else** → real availability, plus their own claim if it is theirs.

Owner-facing notifications are written vague at insert time rather than filtered at
read time (`lib/notifications.ts`) — a row that never contained the item name cannot
leak it later.

## How duplicate gifts are prevented

The guarantee is a database constraint, not application logic:

```sql
CREATE UNIQUE INDEX reservations_one_active_per_item
  ON reservations (item_id)
  WHERE status IN ('reserved','purchased');
```

Two people tapping "I'll get this" in the same instant both reach the INSERT. Exactly
one commits; the other is told the truth instead of quietly creating a second identical
present. Statuses are `reserved → purchased | released | expired`, and forgotten holds
release themselves after the owner's window (`runReservationMaintenance()`).

Guests can claim without an account — they get a signed cookie identity, and `/gifts`
is the one page in the studio that works signed out, so they can still manage what they
claimed.

## Layout that comes from the data

`lib/layout.ts` sizes each item from the item itself — what the owner pinned, how badly
they want it, whether they filmed a note, how much media there is — so every list
composes differently instead of repeating one grid. On a phone the photographs run
edge to edge and the metadata collapses to a single line.

## Verifying it

```bash
npm run verify
```

Or one at a time:

```bash
npm run verify:reservations   # race conditions and surprise-mode leaks (no server needed)
npm run verify:flows          # the whole gift flow through a real browser
npm run verify:sweep          # every route, create/edit/delete, sharing, access control, phone layout
npm run verify:a11y           # axe over every surface at 1440 and 390, plus a keyboard pass
```

Everything except `verify:reservations` needs the dev server on port 3040
(`npm run dev -- --port 3040`). `verify:flows` and `verify:sweep` write to the demo
database — re-run `npm run seed` afterwards.

Two of these guard bugs that were real and would have been easy to reintroduce:

- **Claiming never stacks a second overlay.** The claim used to open its own dialog on
  top of the item dialog; two 72% scrims made everything behind them go black. The item
  view now claims in place (`mode="inline"` on `GiftButton`).
- **Destructive buttons need two presses.** `ConfirmButton` is never `type="submit"`.
  Flipping the type inside a click handler changes the attribute *before* the browser
  performs the click's default action, so the first press submitted the form — one click
  deleted an item or a whole list.

## Layout of the code

```
app/
  page.tsx                      landing
  [username]/                   public profile
  [username]/[slug]/            a list — the gallery
    i/[itemId]/                 an item, as its own page
    @modal/(.)i/[itemId]/       the same item, intercepted into a dialog
  (app)/                        the studio: dashboard, list editor, notifications, settings
  gifts/                        the buyer's side, reachable as a guest
  w/[token]/                    share links for link-only lists
lib/
  queries.ts                    reads, access control, and the surprise-mode boundary
  reservations.ts               the claim state machine
  actions/                      server actions (auth, gifts, lists, settings)
components/
  wishlist/                     the gallery: cards, item detail, claim flow, sharing
  app/                          the studio: composer, settings forms, navigation
scripts/                        media pipeline, seed, verification
```

## Notes and limits

- Data lives in a local SQLite file (`.data/wishwell.db`) via `better-sqlite3`. All
  access goes through `lib/queries.ts` and `lib/actions/*`, so moving to Postgres or
  Supabase means replacing that layer, not the app.
- Uploads are written to `public/uploads`. Fine locally; a deployment would want object
  storage.
- Email notifications are modelled and toggleable but not wired to a provider — the
  in-app notification centre is real.
- OAuth is not configured; the schema carries `oauth_provider`/`oauth_subject` for it.
- Photographs are from Unsplash, downloaded once into `public/media` with credit
  recorded in `public/media/credits.json`. The video notes are generated locally with
  ffmpeg from those stills.
- Where an item names a brand, the photo is pinned to a specific photo id in
  `scripts/media-manifest.mjs` (`pin:`) rather than left to search — a watch called a
  Seiko has to actually be a Seiko. Everything else is matched by query, and
  `node scripts/set-photo.mjs <key> <photoId>` pins a new one.
