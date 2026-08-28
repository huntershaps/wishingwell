# Deploying Wishwell

Wishwell runs on Vercel with its database in Turso. Both have a free tier that
needs no card, and both stop rather than bill when a limit is reached.

The whole reason this is straightforward: **Turso is libSQL, which is SQLite**.
The same client in `lib/db` opens a plain file during development and talks to
Turso in production, so no SQL changes between them and nothing to keep in sync.

## What lives where

| | Development | Deployed |
|---|---|---|
| Database | `.data/wishwell.db` | Turso, via `TURSO_DATABASE_URL` |
| Uploads | `public/uploads` | Vercel Blob, via `BLOB_READ_WRITE_TOKEN` |
| Demo photography | `public/media`, committed | the same, served from the build |

Each switch is decided by whether its environment variable exists, so neither
environment has to be told which one it is.

## First deploy

1. **Create the database.** At turso.tech, make a database, then copy its URL
   and create an auth token for it. The URL looks like
   `libsql://wishwell-<something>.turso.io`.

2. **Create the schema.** From this repository:

       TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run migrate

   It prints the table count and whether foreign keys are enforced. Cascade
   deletes matter when an account is removed, so if that says `0`, say so before
   going further.

3. **Load the demo.** Same two variables, then `npm run seed`. It sends the whole
   demo as one batch, so this is a single round trip rather than four hundred.

4. **Import the project into Vercel** from `huntershaps/wishingwell`. It detects
   Next.js; nothing needs configuring. Set these environment variables for
   Production, Preview and Development:

       TURSO_DATABASE_URL     libsql://...
       TURSO_AUTH_TOKEN       ...

5. **Add Blob storage** from the project's Storage tab. Creating the store sets
   `BLOB_READ_WRITE_TOKEN` for you, and uploads start going there on the next
   deploy. Skip this and uploads will fail on Vercel, because there is no disk to
   write to; everything else works.

6. **Add the domain.** `wishwell.huntermshaps.com` in the project's Domains tab,
   then create the record it shows you wherever huntermshaps.com's DNS lives:

       CNAME   wishwell   cname.vercel-dns.com

   The certificate is issued once that resolves.

## After it is up

**Your account is separate from the demo.** Sign up at `/signup` with a real
email. The seeded people all have `@wishwell.app` addresses and one of them
already holds the username `hunter`, so choose another; whatever you pick is your
public address, `wishwell.huntermshaps.com/<username>`.

**Friends do not need accounts.** A share link grants the browser that opens it
access to a link-only list, and claiming a gift works without signing up.

**Putting the demo back.** Visitors sign in as `hunter@wishwell.app` and can edit
what they find, so it drifts. Re-run the seed against the deployed database:

    TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run seed

It deletes only `@wishwell.app` accounts and the data hanging off them, then
rebuilds the demo. Real accounts are matched by neither step and are left alone.

**Backups.** `turso db dump` writes the whole database to a file. It is SQLite,
so the dump opens in anything.

## The container fallback

`Dockerfile` still builds a self-contained image: the same app with SQLite on a
volume mounted at `/data`, no Turso and no Blob involved. It suits any host that
runs a container and mounts a disk (Fly, Railway, Northflank), all of which cost
a couple of dollars a month or want a card on file.

    docker build -t wishwell .
    docker run -p 3000:3000 -v wishwell-data:/data wishwell

`scripts/start.mjs` copies the demo database baked into the image onto an empty
volume and leaves a volume that already has one alone.
