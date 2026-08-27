# Deploying Wishwell

The whole deployment is one container and one disk. The container is built from
`Dockerfile`; the disk is mounted at `/data` and holds two things that have to
outlive a deploy:

    /data/wishwell.db     the database
    /data/uploads/        photographs and video notes people upload

Everything else, including the demo photography, is baked into the image.

`scripts/start.mjs` runs at boot. If `/data` has no database yet it copies in the
demo world, which was seeded at image build time and stored at
`/app/seed/wishwell.db`. If a database is already there it is left alone. So the
first deploy comes up looking like the demo, and every deploy after that keeps
whatever is really on the volume.

## Northflank (the free option, and what the portfolio points at)

Northflank's free Sandbox plan runs a container that does not sleep, gives it a
small persistent volume, and puts a custom domain on it with a managed
certificate. Signing up verifies a card without charging it.

1. **Create the service.** New project, then Service → Deployment → *Build from
   Git*, pointing at `huntershaps/wishingwell`, branch `main`. Build type
   **Dockerfile**, path `/Dockerfile`, context `/`.
2. **Attach the volume before the first deploy.** 0.5 GB, mount path `/data`. A
   volume added later starts empty, which means a second copy of the demo and
   the loss of anything real that was created in between.
3. **Port.** 3000, HTTP, public.
4. **Health check.** `GET /api/health`, which answers only once the database
   opens.
5. **Environment.** Nothing is required. `Dockerfile` already sets
   `WISHWELL_DATA_DIR=/data`, `WISHWELL_UPLOAD_DIR=/data/uploads` and
   `WISHWELL_SEED_DB=/app/seed/wishwell.db`.
6. **Domain.** Add `wishwell.huntermshaps.com` to the service, then create the
   DNS record Northflank shows, wherever huntermshaps.com's DNS lives:

       CNAME   wishwell   <the host Northflank gives you>

   The certificate is issued once the record resolves.

The build takes a few minutes, most of it compiling `better-sqlite3`.

## Running the same image locally

    docker build -t wishwell .
    docker run -p 3000:3000 -v wishwell-data:/data wishwell

Same image, same entrypoint, same first-boot behaviour as the deployed one.

## Somewhere else

Nothing here is Northflank-specific. Any host that runs a Dockerfile and mounts
a disk works the same way, and the two obvious ones are Fly.io (`fly launch`,
then `fly volumes create data -s 1` and a `[mounts]` block pointing at `/data`)
and Railway (attach a volume at `/data`). Both are a couple of dollars a month
rather than free.

## After the first deploy

**Your own account is separate from the demo.** Sign up at `/signup` with a real
email. The seeded demo people all have `@wishwell.app` addresses, and one of them
already holds the username `hunter`, so pick another one for yourself; whatever
you choose is your public address, `wishwell.huntermshaps.com/<username>`.

**Friends do not need accounts.** A share link grants the browser that opens it
access to a link-only list, and claiming a gift works without signing up.

**Putting the demo back.** Visitors sign in as `hunter@wishwell.app` and can edit
what they find, so the demo drifts. From the service's shell:

    node scripts/reset-demo.mjs

It deletes every account with a `@wishwell.app` address, copies the demo back out
of the template baked into the image, and does not touch any other account. It
prints how many real accounts it left alone.

**Backups.** The database is a single file. Copy `/data/wishwell.db` off the
volume from the shell before doing anything drastic.
