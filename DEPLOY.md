# Deploying Wishwell

Wishwell runs on Vercel with its database in Turso. Both have a free tier that
needs no card, and Vercel's Hobby plan stops rather than bills when a limit is
reached. Netlify works too and is documented at the end; it was the first choice
until its free tier paused production deploys.

The whole reason this is straightforward: **Turso is libSQL, which is SQLite**.
The same client in `lib/db` opens a plain file during development and talks to
Turso in production, so no SQL changes between them and nothing to keep in sync.

## What lives where

| | Development | Deployed |
|---|---|---|
| Database | `.data/wishwell.db` | Turso, via `TURSO_DATABASE_URL` |
| Uploads | `public/uploads` | Vercel Blob (or Netlify Blobs on Netlify) |
| Demo photography | `public/media`, committed | the same, served from the build |

Each switch is decided by an environment variable that is already there:
`TURSO_DATABASE_URL` for the database, and for uploads `BLOB_READ_WRITE_TOKEN`
on Vercel or `NETLIFY` on Netlify. No environment has to be told which it is.

## First deploy

1. **Create the database.** At turso.tech, make a database, then copy its URL
   and create an auth token for it. The URL looks like
   `libsql://wishwell-<something>.turso.io`.

2. **Put the credentials in `.env.turso`** (gitignored):

       TURSO_DATABASE_URL=libsql://...
       TURSO_AUTH_TOKEN=...

   Deliberately not `.env.local`: Next loads that file automatically, which would
   point `npm run dev` and every verification suite at the live database. Only the
   `:remote` commands read `.env.turso`, so touching production is always chosen.

3. **Create the schema and load the demo:**

       npm run migrate:remote
       npm run seed:remote

   Migrate prints the table count and whether foreign keys are enforced. Cascade
   deletes matter when an account is removed, so if that says `0`, stop and look
   into it. The seed sends the whole demo as one batch: one round trip, not four
   hundred.

4. **Import the project into Vercel** from `huntershaps/wishingwell`. It detects
   Next.js; nothing needs configuring. Set two environment variables for
   Production, Preview and Development:

       TURSO_DATABASE_URL     libsql://...
       TURSO_AUTH_TOKEN       ...

5. **Add Blob storage** from the project's Storage tab. Creating the store sets
   `BLOB_READ_WRITE_TOKEN` itself, and uploads start going there on the next
   deploy. Without it everything works except uploads, because a serverless
   function has no disk. Hobby storage is capped at a few hundred megabytes, and
   a video note can be 40MB, so it is worth knowing where the ceiling is.

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

    npm run seed:remote

It deletes only `@wishwell.app` accounts and the data hanging off them, then
rebuilds the demo. Real accounts are matched by neither step and are left alone.

**Backups.** `turso db dump` writes the whole database to a file. It is SQLite,
so the dump opens in anything.

## Netlify instead

The code supports it and `netlify.toml` is still here: Netlify detects Next.js and
installs the OpenNext adapter itself, uploads go to Netlify Blobs with no key and
no provisioning, and an object can be 5GB rather than a few hundred megabytes.
Set the same two Turso variables on the site and it works.

What stopped it being the first choice was the free tier: an account running on
operational credits keeps published sites up but **pauses production deploys**,
including deploys from the CLI, until the next billing cycle. Nothing to route
around, so this is worth revisiting when the cycle resets.

## The container fallback

`Dockerfile` still builds a self-contained image: the same app with SQLite on a
volume mounted at `/data`, no Turso and no blob storage involved. It suits any host that
runs a container and mounts a disk (Fly, Railway, Northflank), all of which cost
a couple of dollars a month or want a card on file.

    docker build -t wishwell .
    docker run -p 3000:3000 -v wishwell-data:/data wishwell

`scripts/start.mjs` copies the demo database baked into the image onto an empty
volume and leaves a volume that already has one alone.
