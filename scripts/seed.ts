/**
 * Builds the demo database from scratch.
 *
 *   npm run seed
 *
 * Everything here is written as if a real person typed it, because the product
 * only reads as real when the content does. Prices are in cents.
 */
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, id, now, token } from "../lib/db";

const DAY = 86_400_000;
const T = now();

const credits: Record<string, { alt: string; ratio: number; photographer: string }> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "public", "media", "credits.json"), "utf8"),
);

function hash(password: string) {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function wipe() {
  const tables = [
    "wishlist_events", "notifications", "reservations", "item_media", "items",
    "wishlists", "sessions", "guests", "settings", "profiles", "users",
  ];
  db.pragma("foreign_keys = OFF");
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
  db.pragma("foreign_keys = ON");
}

// ------------------------------------------------------------------ inserts

type UserSpec = {
  key: string;
  email: string;
  username: string;
  name: string;
  bio: string;
  accent: string;
  location?: string;
  links?: { label: string; url: string }[];
  surprise?: boolean;
  guests?: boolean;
  days?: number;
};

const users: Record<string, string> = {};

function addUser(spec: UserSpec) {
  const userId = id();
  users[spec.key] = userId;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`,
  ).run(userId, spec.email, hash("wishwell"), T - 220 * DAY);
  db.prepare(
    `INSERT INTO profiles (user_id, username, display_name, bio, accent, location, links, visibility, discoverable, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'public', 1, ?)`,
  ).run(
    userId,
    spec.username,
    spec.name,
    spec.bio,
    spec.accent,
    spec.location ?? null,
    JSON.stringify(spec.links ?? []),
    T - 220 * DAY,
  );
  db.prepare(
    `INSERT INTO settings (user_id, surprise_mode, allow_guest_reservations, reservations_expire, reservation_days)
     VALUES (?, ?, ?, 1, ?)`,
  ).run(userId, spec.surprise === false ? 0 : 1, spec.guests === false ? 0 : 1, spec.days ?? 7);
  return userId;
}

type ListSpec = {
  key: string;
  owner: string;
  slug: string;
  title: string;
  description: string;
  icon?: string;
  cover?: string;
  accent?: string;
  occasion?: string;
  eventDate?: number;
  visibility: "public" | "link" | "private";
  position: number;
  createdDaysAgo?: number;
};

const lists: Record<string, string> = {};

function addList(spec: ListSpec) {
  const listId = id();
  lists[spec.key] = listId;
  const created = T - (spec.createdDaysAgo ?? 60) * DAY;
  db.prepare(
    `INSERT INTO wishlists
       (id, user_id, slug, title, description, icon, cover_url, accent, occasion, event_date,
        visibility, share_token, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    listId,
    users[spec.owner],
    spec.slug,
    spec.title,
    spec.description,
    spec.icon ?? null,
    spec.cover ? `/media/${spec.cover}.jpg` : null,
    spec.accent ?? "madder",
    spec.occasion ?? null,
    spec.eventDate ?? null,
    spec.visibility,
    token(9),
    spec.position,
    created,
    created,
  );
  return listId;
}

type ItemSpec = {
  key: string;
  list: string;
  name: string;
  price: number | null;
  priority: "someday" | "medium" | "high" | "dream";
  store?: string;
  url?: string;
  category?: string;
  tags?: string[];
  size?: string;
  color?: string;
  variant?: string;
  notes?: string;
  description?: string;
  why?: string;
  feature?: boolean;
  photos: string[];
  video?: { key: string; caption: string };
  addedDaysAgo?: number;
};

const items: Record<string, string> = {};

function addItem(spec: ItemSpec, position: number) {
  const itemId = id();
  items[spec.key] = itemId;
  const created = T - (spec.addedDaysAgo ?? 30) * DAY;
  db.prepare(
    `INSERT INTO items
      (id, wishlist_id, name, url, store, price_cents, currency, description, why_want, priority,
       category, tags, notes, size, color, variant, feature, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemId,
    lists[spec.list],
    spec.name,
    spec.url ?? null,
    spec.store ?? null,
    spec.price,
    spec.description ?? null,
    spec.why ?? null,
    spec.priority,
    spec.category ?? null,
    JSON.stringify(spec.tags ?? []),
    spec.notes ?? null,
    spec.size ?? null,
    spec.color ?? null,
    spec.variant ?? null,
    spec.feature ? 1 : 0,
    position,
    created,
    created,
  );

  let mediaPos = 0;
  if (spec.video) {
    db.prepare(
      `INSERT INTO item_media (id, item_id, kind, url, poster_url, alt, caption, width, height, position, created_at)
       VALUES (?, ?, 'video', ?, ?, ?, ?, 720, 1280, ?, ?)`,
    ).run(
      id(),
      itemId,
      `/media/${spec.video.key}.mp4`,
      `/media/${spec.video.key}.jpg`,
      `Video note about ${spec.name}`,
      spec.video.caption,
      mediaPos++,
      created,
    );
  }
  for (const photo of spec.photos) {
    const credit = credits[photo];
    db.prepare(
      `INSERT INTO item_media (id, item_id, kind, url, alt, caption, width, height, position, created_at)
       VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id(),
      itemId,
      `/media/${photo}.jpg`,
      credit?.alt ? `${spec.name}: ${credit.alt}` : spec.name,
      credit?.photographer ? `Photo: ${credit.photographer}` : null,
      1600,
      Math.round(1600 / (credit?.ratio ?? 1.5)),
      mediaPos++,
      created,
    );
  }
  return itemId;
}

function reserve(opts: {
  item: string;
  buyer?: string;
  guest?: string;
  guestName?: string;
  status: "reserved" | "purchased" | "released" | "expired";
  daysAgo: number;
  expiresInDays?: number;
  note?: string;
}) {
  const reservedAt = T - opts.daysAgo * DAY;
  db.prepare(
    `INSERT INTO reservations
      (id, item_id, buyer_user_id, guest_token, guest_name, status, note, reserved_at, expires_at, purchased_at, released_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id(),
    items[opts.item],
    opts.buyer ? users[opts.buyer] : null,
    opts.guest ?? null,
    opts.guestName ?? null,
    opts.status,
    opts.note ?? null,
    reservedAt,
    opts.expiresInDays != null ? T + opts.expiresInDays * DAY : null,
    opts.status === "purchased" ? reservedAt + DAY : null,
    opts.status === "released" ? reservedAt + 2 * DAY : null,
  );
}

function notify(opts: {
  user: string;
  audience: "owner" | "buyer";
  type: string;
  title: string;
  body?: string;
  href?: string;
  daysAgo: number;
  read?: boolean;
}) {
  const created = T - Math.round(opts.daysAgo * DAY);
  db.prepare(
    `INSERT INTO notifications (id, user_id, audience, type, title, body, href, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id(),
    users[opts.user],
    opts.audience,
    opts.type,
    opts.title,
    opts.body ?? null,
    opts.href ?? null,
    opts.read ? created + 3600_000 : null,
    created,
  );
}

function events(list: string, views: number, shares: number, overDays = 30) {
  const stmt = db.prepare(
    `INSERT INTO wishlist_events (id, wishlist_id, kind, created_at) VALUES (?, ?, ?, ?)`,
  );
  for (let i = 0; i < views; i++)
    stmt.run(id(), lists[list], "view", T - Math.floor(Math.random() * overDays * DAY));
  for (let i = 0; i < shares; i++)
    stmt.run(id(), lists[list], "share", T - Math.floor(Math.random() * overDays * DAY));
}

// --------------------------------------------------------------------- data

wipe();

addUser({
  key: "hunter",
  email: "hunter@wishwell.app",
  username: "hunter",
  name: "Hunter Shapiro",
  bio: "Photographer, card collector, graduating in September. A few things I love, want, and am saving for.",
  accent: "madder",
  location: "Chicago, IL",
  links: [
    { label: "Portfolio", url: "https://huntermshaps.com" },
    { label: "Instagram", url: "https://instagram.com" },
  ],
});

addUser({
  key: "maya",
  email: "maya@wishwell.app",
  username: "maya",
  name: "Maya Okonkwo",
  bio: "Record store regular. Cooking my way through a first apartment with four pans and a lot of optimism.",
  accent: "plum",
  location: "Philadelphia, PA",
  surprise: false, // she would rather know — demonstrates the setting being off
});

addUser({
  key: "dev",
  email: "dev@wishwell.app",
  username: "dev",
  name: "Dev Ramanathan",
  bio: "Runs early, plans one big trip a year, packs the night before anyway.",
  accent: "indigo",
  location: "Austin, TX",
});

addUser({
  key: "nora",
  email: "nora@wishwell.app",
  username: "nora",
  name: "Nora Whitfield",
  bio: "Getting married in the spring. Slowly making a home that feels like both of us.",
  accent: "moss",
  location: "Portland, OR",
});

addUser({
  key: "theo",
  email: "theo@wishwell.app",
  username: "theo",
  name: "Theo Brandt",
  bio: "Chronic over-thinker of gifts. This is my attempt to be better about it.",
  accent: "saffron",
  location: "Chicago, IL",
});

// ---------------------------------------------------------------- Hunter --

addList({
  key: "grad",
  owner: "hunter",
  slug: "graduation",
  title: "Graduation",
  icon: "🎓",
  description:
    "Walking on September 5th. My family keeps asking, so here it is. Mostly things I will still be using in ten years.",
  cover: "cover-graduation",
  accent: "madder",
  occasion: "graduation",
  eventDate: T + 18 * DAY,
  visibility: "public",
  position: 0,
  createdDaysAgo: 42,
});

addList({
  key: "photo",
  owner: "hunter",
  slug: "photography",
  title: "Photography",
  icon: "📷",
  description:
    "The running list. Some of it is for card work, some of it is for me. Nothing here is urgent, all of it gets used.",
  cover: "cover-photography",
  accent: "madder",
  visibility: "public",
  position: 1,
  createdDaysAgo: 180,
});

addList({
  key: "cards",
  owner: "hunter",
  slug: "cards",
  title: "Sports & Collectibles",
  icon: "🃏",
  description: "The shoebox situation has gotten out of hand. Sharing this one only with people who get it.",
  cover: "trading-cards",
  accent: "saffron",
  visibility: "link",
  position: 2,
  createdDaysAgo: 90,
});

addList({
  key: "saving",
  owner: "hunter",
  slug: "saving-for",
  title: "Things I'm Saving For",
  icon: "🐖",
  description:
    "Not asking anyone for these. Keeping them somewhere I can see them so I stop buying smaller things instead.",
  cover: "cover-desk",
  accent: "indigo",
  visibility: "public",
  position: 3,
  createdDaysAgo: 120,
});

let p = 0;
addItem(
  {
    key: "sony",
    list: "photo",
    name: "Sony α7 IV",
    price: 249_800,
    priority: "dream",
    store: "B&H Photo",
    url: "https://www.bhphotovideo.com",
    category: "Cameras",
    tags: ["full frame", "mirrorless"],
    color: "Black",
    variant: "Body only",
    feature: true,
    description:
      "33MP full frame, 4K60, two card slots. Body only. The lens I want is already further down this list.",
    why:
      "I have been shooting cards and events on a borrowed body for two years, and I am tired of handing it back. The files hold up when I crop deep into a corner, which is the whole job with cards, and it finally handles a badly lit gym without turning everyone to mush. This is the one I would keep for a decade.",
    photos: ["sony-a7", "sony-a7-alt", "darkroom"],
    video: { key: "note-camera", caption: "Why this camera, in about a minute" },
    addedDaysAgo: 62,
  },
  p++,
);

addItem(
  {
    key: "sigma",
    list: "photo",
    name: "Sigma 35mm f/1.4 DG DN Art",
    price: 79_900,
    priority: "high",
    store: "B&H Photo",
    url: "https://www.bhphotovideo.com",
    category: "Lenses",
    tags: ["prime", "35mm"],
    description: "E-mount. The newer DN version, which is lighter, and the focus is quiet enough for video.",
    why:
      "Every photo I like, I have already cropped to about 35mm. Fast enough for gym light, wide enough for a table of cards without bending the corners.",
    photos: ["sigma-lens"],
    addedDaysAgo: 48,
  },
  p++,
);

addItem(
  {
    key: "godox",
    list: "photo",
    name: "Godox AD200 Pro",
    price: 34_900,
    priority: "high",
    store: "Adorama",
    url: "https://www.adorama.com",
    category: "Lighting",
    tags: ["strobe", "studio"],
    description: "200Ws pocket strobe with the bare bulb head. Battery powered, so it works anywhere.",
    why:
      "Every card photo I actually like turns out to be one hard light and one flag. This is the small version of what those photos were shot with.",
    photos: ["godox-flash"],
    addedDaysAgo: 35,
  },
  p++,
);

addItem(
  {
    key: "peakpack",
    list: "photo",
    name: "Vinta Type II camera backpack",
    price: 31_900,
    priority: "medium",
    store: "Vinta",
    url: "https://vinta.co",
    category: "Bags",
    color: "Olive, with the tan leather",
    description: "Fits a body, two lenses, and a laptop, and does not announce that it is a camera bag.",
    why:
      "At the moment the camera rides in a tote bag with a sweatshirt wrapped around it. I would like to stop doing that before something expensive breaks.",
    photos: ["peak-backpack"],
    addedDaysAgo: 30,
  },
  p++,
);

addItem(
  {
    key: "canonet",
    list: "photo",
    name: "Fujifilm X100F (used)",
    price: 89_900,
    priority: "medium",
    store: "KEH Camera",
    url: "https://www.keh.com",
    category: "Cameras",
    tags: ["compact", "fixed lens"],
    color: "Silver",
    description:
      "Silver body, the fixed 23mm. Used is completely fine. I would rather have one that has already been somewhere.",
    why:
      "Something to carry on days when I do not want to make any decisions. My grandfather kept a little rangefinder in his coat pocket for forty years, and this is the closest thing to that habit I can actually buy.",
    photos: ["film-camera"],
    addedDaysAgo: 24,
  },
  p++,
);

addItem(
  {
    key: "tripod",
    list: "photo",
    name: "Manfrotto Befree Advanced",
    price: 18_900,
    priority: "medium",
    store: "B&H Photo",
    category: "Support",
    description: "Aluminium, ball head, folds down to something that fits in the side of a pack.",
    why: "For long exposures on cold mornings, and for copy work when I photograph cards flat.",
    photos: ["tripod"],
    addedDaysAgo: 20,
  },
  p++,
);

addItem(
  {
    key: "cinestill",
    list: "photo",
    name: "CineStill 800T, five rolls",
    price: 5_995,
    priority: "someday",
    store: "Freestyle Photo",
    category: "Film",
    tags: ["35mm", "tungsten"],
    description: "35mm, 36 exposures, five-pack. Keep it in the fridge.",
    why:
      "For night walks. Tungsten-balanced film makes street lights look the way they actually feel at eleven at night.",
    photos: ["cinestill-film"],
    addedDaysAgo: 14,
  },
  p++,
);

p = 0;
addItem(
  {
    key: "seiko",
    list: "grad",
    name: "Seiko Presage Cocktail Time",
    price: 47_500,
    priority: "high",
    store: "Seiko",
    url: "https://www.seikowatches.com",
    category: "Watches",
    tags: ["automatic", "dress"],
    color: "Sunburst, almost black",
    variant: "Automatic · 40.5mm · leather strap",
    feature: true,
    description: "Automatic, 40.5mm, that sunburst dial that goes almost black at the edges.",
    why:
      "I want exactly one nice thing that is not a screen. My dad wore the same Seiko every working day of his life and never once talked about it, which is somehow the whole appeal.",
    photos: ["seiko-watch"],
    addedDaysAgo: 40,
  },
  p++,
);

addItem(
  {
    key: "bellroy",
    list: "grad",
    name: "Bellroy Transit Workpack",
    price: 25_900,
    priority: "high",
    store: "Bellroy",
    url: "https://bellroy.com",
    category: "Bags",
    description: "20L, opens flat, has a real laptop compartment rather than a slot. Any colour but black.",
    why: "Something that does not look like a school bag on the first day of a real job.",
    photos: ["bellroy-pack"],
    addedDaysAgo: 38,
  },
  p++,
);

addItem(
  {
    key: "away",
    list: "grad",
    name: "Away Bigger Carry-On",
    price: 32_500,
    priority: "medium",
    store: "Away",
    url: "https://www.awaytravel.com",
    category: "Travel",
    color: "Coast",
    description: "Aluminium edge, the bigger carry-on, no battery.",
    why: "Because the duffel I have been using since sophomore year has started to smell like sophomore year.",
    photos: ["suitcase"],
    addedDaysAgo: 33,
  },
  p++,
);

addItem(
  {
    key: "notebook",
    list: "grad",
    name: "Leuchtturm1917 and a Kaweco Sport",
    price: 7_800,
    priority: "someday",
    store: "Goulet Pens",
    category: "Desk",
    tags: ["stationery"],
    description: "A5 dotted in black, and the brass Sport with a fine nib.",
    why:
      "Half my shot lists live in my phone where I never look at them again. Paper seems to work better for me, and brass gets better looking the more it is handled.",
    photos: ["notebook"],
    addedDaysAgo: 26,
  },
  p++,
);

addItem(
  {
    key: "books",
    list: "grad",
    name: "Four books I keep almost buying",
    price: 6_400,
    priority: "someday",
    store: "Bookshop.org",
    url: "https://bookshop.org",
    category: "Books",
    description:
      "Let My People Go Surfing · On Photography · The Creative Act · Shoe Dog. Used copies are completely fine.",
    why: "I have read the first chapter of all four in a bookstore. Time to own them and finish the job.",
    photos: ["books"],
    addedDaysAgo: 22,
  },
  p++,
);

p = 0;
addItem(
  {
    key: "topps75",
    list: "cards",
    name: "1989-90 Hoops starter lot",
    price: 42_000,
    priority: "high",
    store: "COMC",
    url: "https://www.comc.com",
    category: "Cards",
    tags: ["basketball", "set build"],
    feature: true,
    description: "A few hundred commons in decent shape. Condition matters less than getting a running start.",
    why:
      "The '89 Hoops set is the one I actually want to finish rather than just own. Buying a lot of commons means the hunt is for the last twenty cards instead of the first two hundred.",
    photos: ["trading-cards", "card-sleeves"],
    addedDaysAgo: 55,
  },
  p++,
);

addItem(
  {
    key: "ball",
    list: "cards",
    name: "Frame for the 1963 run",
    price: 22_000,
    priority: "medium",
    store: "Ballqube",
    category: "Display",
    description: "A proper wall frame for the twelve cards that started all of this. UV acrylic, black surround.",
    why: "They have been in a box since my grandfather handed them over. Six years in a drawer is not honouring the man or the cards.",
    photos: ["card-packs"],
    addedDaysAgo: 44,
  },
  p++,
);

addItem(
  {
    key: "case",
    list: "cards",
    name: "Shelves for the graded ones",
    price: 12_900,
    priority: "medium",
    store: "BCW Supplies",
    category: "Display",
    description:
      "Wall mounted, deep enough for a slab to stand up on its own. The wall gets afternoon sun, so nothing that magnifies it.",
    why: "The good cards should be on a wall where I see them, not in a box where I forget them.",
    photos: ["display-case"],
    addedDaysAgo: 36,
  },
  p++,
);

addItem(
  {
    key: "storage",
    list: "cards",
    name: "Storage: 800-count boxes and penny sleeves",
    price: 4_200,
    priority: "someday",
    store: "BCW Supplies",
    category: "Supplies",
    description: "Ten boxes, a thousand sleeves. The least interesting thing on any of my lists.",
    why: "Unglamorous, but the shoebox has officially become a problem and I would rather fix it than photograph around it.",
    photos: ["card-sleeves"],
    addedDaysAgo: 18,
  },
  p++,
);

p = 0;
addItem(
  {
    key: "kyoto",
    list: "saving",
    name: "Ten days in Kyoto",
    price: 240_000,
    priority: "dream",
    store: "Saving for it",
    category: "Travel",
    tags: ["experience", "november"],
    feature: true,
    description: "Flights, ten nights, and enough left over to eat properly. Going in November for the maples.",
    why:
      "I have a folder of other people's photographs of the same five places, and at some point that stops being research and starts being an excuse. I would like some of my own.",
    photos: ["kyoto"],
    addedDaysAgo: 100,
  },
  p++,
);

addItem(
  {
    key: "aeron",
    list: "saving",
    name: "Herman Miller Aeron, remastered",
    price: 139_500,
    priority: "dream",
    store: "Herman Miller",
    url: "https://store.hermanmiller.com",
    category: "Home office",
    size: "Size B",
    color: "Graphite",
    description: "Size B, graphite, fully loaded. Open-box counts.",
    why: "I edit for six hours at a stretch and my current chair came free with an apartment. My back has opinions now.",
    photos: ["aeron"],
    addedDaysAgo: 70,
  },
  p++,
);

addItem(
  {
    key: "espresso",
    list: "saving",
    name: "Breville Barista Express Impress",
    price: 74_900,
    priority: "high",
    store: "Breville",
    url: "https://www.breville.com",
    category: "Kitchen",
    color: "Stainless",
    description: "Built-in grinder, assisted tamp. The one that removes the part I am bad at.",
    why:
      "Two flat whites a day works out to more than this machine costs in about seven months. I did the maths twice because I wanted it to be true.",
    photos: ["espresso"],
    addedDaysAgo: 52,
  },
  p++,
);

// ------------------------------------------------------------------ Maya --

addList({
  key: "vinyl",
  owner: "maya",
  slug: "vinyl",
  title: "Vinyl & Hi-Fi",
  icon: "🎧",
  description: "Slowly replacing the suitcase player I have had since college. Recommendations welcome.",
  cover: "record-shop",
  accent: "plum",
  visibility: "public",
  position: 0,
  createdDaysAgo: 75,
});

addList({
  key: "apartment",
  owner: "maya",
  slug: "first-apartment",
  title: "First Apartment",
  icon: "🕯️",
  description: "Things that make a rental feel like a home. Nothing here is fragile or beige.",
  cover: "cover-apartment",
  accent: "plum",
  visibility: "link",
  position: 1,
  createdDaysAgo: 50,
});

p = 0;
addItem(
  {
    key: "rega",
    list: "vinyl",
    name: "Rega Planar 2",
    price: 67_500,
    priority: "dream",
    store: "Turntable Lab",
    url: "https://www.turntablelab.com",
    category: "Hi-fi",
    color: "Matte white",
    feature: true,
    description: "With the Carbon cartridge fitted. White plinth if there is a choice.",
    why:
      "I have been playing records through a suitcase player since college and I can hear every bit of it. This is the last turntable I would ever need to buy, which makes it the cheapest one.",
    photos: ["turntable", "turntable-alt"],
    video: { key: "note-turntable", caption: "Maya on why this one" },
    addedDaysAgo: 40,
  },
  p++,
);

addItem(
  {
    key: "kef",
    list: "vinyl",
    name: "KEF LSX II",
    price: 139_900,
    priority: "high",
    store: "KEF",
    category: "Hi-fi",
    color: "Mineral white",
    description: "Powered, so no separate amp. White pair.",
    why: "Small enough for the shelf they have to live on, good enough that I will stop thinking about speakers.",
    photos: ["speakers"],
    addedDaysAgo: 28,
  },
  p++,
);

addItem(
  {
    key: "crate",
    list: "vinyl",
    name: "Walnut record crate",
    price: 14_500,
    priority: "medium",
    store: "Line Phono",
    category: "Storage",
    description: "Holds about 80. Walnut, on casters.",
    why: "The stack by the window has started to lean and I am not ready to talk about it.",
    photos: ["vinyl"],
    addedDaysAgo: 21,
  },
  p++,
);

p = 0;
addItem(
  {
    key: "lecreuset",
    list: "apartment",
    name: "Le Creuset 5.5qt Dutch oven",
    price: 42_000,
    priority: "high",
    store: "Le Creuset",
    category: "Kitchen",
    color: "Sea salt",
    feature: true,
    description: "Round, 5.5 quart. Any colour except red, honestly.",
    why: "My mother still cooks in the one she got as a wedding present in 1994. That is the kind of purchase I want to make.",
    photos: ["dutch-oven"],
    addedDaysAgo: 34,
  },
  p++,
);

addItem(
  {
    key: "knife",
    list: "apartment",
    name: "8-inch chef's knife",
    price: 16_500,
    priority: "high",
    store: "Cutlery and More",
    category: "Kitchen",
    description: "Something in the middle: sharp, balanced, dishwasher-never.",
    why: "I have been cooking with a knife that came in a block set and I am starting to suspect it is the reason I dislike chopping onions.",
    photos: ["chef-knife"],
    addedDaysAgo: 27,
  },
  p++,
);

addItem(
  {
    key: "linens",
    list: "apartment",
    name: "Linen sheet set, oatmeal",
    price: 22_900,
    priority: "medium",
    store: "Cultiver",
    category: "Bedroom",
    size: "Queen",
    color: "Oatmeal",
    description: "Queen. Flat sheet included, please.",
    why: "The bedroom gets afternoon sun and everything in it should feel like that.",
    photos: ["linen-bed"],
    addedDaysAgo: 19,
  },
  p++,
);

addItem(
  {
    key: "lamp",
    list: "apartment",
    name: "Arc floor lamp",
    price: 18_900,
    priority: "medium",
    store: "Article",
    category: "Lighting",
    description: "Something with a warm bulb that reaches over the sofa.",
    why: "There is exactly one ceiling light in this apartment and it is directly above nothing useful.",
    photos: ["floor-lamp"],
    addedDaysAgo: 12,
  },
  p++,
);

// ------------------------------------------------------------------- Dev --

addList({
  key: "japan",
  owner: "dev",
  slug: "japan",
  title: "Japan in November",
  icon: "🗾",
  description: "Two weeks, mostly on trains. The list is half gear and half things I am paying for in advance.",
  cover: "tokyo-night",
  accent: "indigo",
  occasion: "trip",
  eventDate: T + 82 * DAY,
  visibility: "public",
  position: 0,
  createdDaysAgo: 45,
});

addList({
  key: "running",
  owner: "dev",
  slug: "running",
  title: "Running",
  icon: "👟",
  description: "Replacing things at roughly the rate I wear them out.",
  accent: "indigo",
  visibility: "link",
  position: 1,
  createdDaysAgo: 30,
});

p = 0;
addItem(
  {
    key: "ryokan",
    list: "japan",
    name: "Two nights at a ryokan in Hakone",
    price: 34_000,
    priority: "dream",
    store: "Booking",
    category: "Stay",
    tags: ["experience", "onsen"],
    feature: true,
    description: "Tatami room, private onsen, dinner included. Nights four and five of the trip.",
    why:
      "The whole trip is built around one evening in an onsen town with the mountain out of the window. Everything else on this list is logistics.",
    photos: ["ryokan", "hakone"],
    video: { key: "note-ryokan", caption: "The room I keep looking at" },
    addedDaysAgo: 40,
  },
  p++,
);

addItem(
  {
    key: "jrpass",
    list: "japan",
    name: "JR Pass, 14 days",
    price: 43_500,
    priority: "high",
    store: "JR Rail",
    category: "Travel",
    description: "Ordinary class, ordered before we fly so it arrives in time.",
    why: "Six long train legs. It pays for itself somewhere around the third one.",
    photos: ["hakone"],
    addedDaysAgo: 30,
  },
  p++,
);

p = 0;
addItem(
  {
    key: "trail",
    list: "running",
    name: "Trail shoes for the Nakasendo",
    price: 15_000,
    priority: "high",
    store: "Running Warehouse",
    category: "Shoes",
    size: "US 10.5",
    description: "Something with grip for wet stone steps. Half size up.",
    why: "Two days of the trip are on old post road, and my road shoes have the tread of a bowling ball.",
    photos: ["running-shoes"],
    addedDaysAgo: 16,
  },
  p++,
);

addItem(
  {
    key: "everyday",
    list: "running",
    name: "Everyday trainers",
    price: 11_000,
    priority: "medium",
    store: "New Balance",
    category: "Shoes",
    size: "US 10.5",
    color: "White",
    description: "The plain white ones. Wear them until they are grey.",
    why: "For the four miles that are not training for anything.",
    photos: ["sneakers", "sneakers-alt"],
    addedDaysAgo: 10,
  },
  p++,
);

// ------------------------------------------------------------------ Nora --

addList({
  key: "wedding",
  owner: "nora",
  slug: "wedding",
  title: "The Wedding",
  icon: "🌿",
  description: "April 17th, small, outdoors, fingers crossed on the weather. No gift is expected. This is only if you ask.",
  cover: "wedding-table",
  accent: "moss",
  occasion: "wedding",
  eventDate: T + 242 * DAY,
  visibility: "public",
  position: 0,
  createdDaysAgo: 25,
});

p = 0;
addItem(
  {
    key: "stoneware",
    list: "wedding",
    name: "Stoneware dinner set for eight",
    price: 34_000,
    priority: "high",
    store: "East Fork",
    category: "Kitchen",
    color: "Eggshell",
    feature: true,
    description: "Dinner plates, side plates, bowls. Made to be used every day, not kept in a cabinet.",
    why:
      "We eat at the table every night, which is the one habit we brought into this together. Plates that can go in a dishwasher and still look like something.",
    photos: ["ceramics"],
    addedDaysAgo: 24,
  },
  p++,
);

addItem(
  {
    key: "linennapkins",
    list: "wedding",
    name: "Table linens for the long table",
    price: 18_000,
    priority: "medium",
    store: "Hawkins New York",
    category: "Home",
    description: "One long cloth and twelve napkins, in something washable and undyed.",
    why: "The table is borrowed and the chairs do not match, so the cloth is doing the work.",
    photos: ["wedding-table"],
    addedDaysAgo: 20,
  },
  p++,
);

// ------------------------------------------------------------------ Theo --

addList({
  key: "justbecause",
  owner: "theo",
  slug: "just-because",
  title: "Just Because",
  icon: "🎈",
  description: "No occasion. People kept asking, so I wrote some things down.",
  accent: "saffron",
  visibility: "link",
  position: 0,
  createdDaysAgo: 15,
});

p = 0;
addItem(
  {
    key: "retro",
    list: "justbecause",
    name: "Retro runners, off-white",
    price: 9_500,
    priority: "medium",
    store: "Adidas",
    category: "Shoes",
    size: "US 11",
    description: "The suede ones. Off-white, not bright white.",
    why: "I have worn the same pair for three years and they have finally stopped being charming.",
    photos: ["sneakers-alt"],
    addedDaysAgo: 14,
  },
  p++,
);

// --------------------------------------------------------- gift activity --

const guestToken = "demo-guest-ro";
db.prepare(`INSERT INTO guests (token, name, email, created_at) VALUES (?, ?, ?, ?)`).run(
  guestToken,
  "Ro",
  null,
  T - 12 * DAY,
);

// On Hunter's lists — he must never learn which of these are which.
reserve({ item: "sigma", buyer: "theo", status: "reserved", daysAgo: 3, expiresInDays: 4 });
reserve({ item: "seiko", buyer: "maya", status: "reserved", daysAgo: 6, expiresInDays: 1 });
reserve({ item: "bellroy", buyer: "nora", status: "purchased", daysAgo: 11 });
reserve({ item: "cinestill", guest: guestToken, guestName: "Ro", status: "purchased", daysAgo: 9 });
reserve({ item: "storage", buyer: "theo", status: "released", daysAgo: 20 });

// Hunter as a buyer, so his own gift dashboard has something in it.
reserve({
  item: "rega",
  buyer: "hunter",
  status: "reserved",
  daysAgo: 2,
  expiresInDays: 5,
  note: "Her birthday is the 2nd. Do not let me forget the cartridge.",
});
reserve({ item: "ryokan", buyer: "hunter", status: "purchased", daysAgo: 5 });
reserve({ item: "stoneware", buyer: "hunter", status: "reserved", daysAgo: 6, expiresInDays: 1 });
reserve({ item: "lecreuset", buyer: "theo", status: "reserved", daysAgo: 4, expiresInDays: 3 });

// ------------------------------------------------------------ notifications

notify({
  user: "hunter",
  audience: "owner",
  type: "gift_activity",
  title: "Someone is planning something for Graduation",
  body: "Surprise mode is on, so the details stay hidden until you unwrap it.",
  href: "/hunter/graduation",
  daysAgo: 6,
});
notify({
  user: "hunter",
  audience: "owner",
  type: "gift_activity",
  title: "Someone is planning something for Photography",
  body: "Surprise mode is on, so the details stay hidden until you unwrap it.",
  href: "/hunter/photography",
  daysAgo: 3,
});
notify({
  user: "hunter",
  audience: "buyer",
  type: "reservation_expiring",
  title: "Still getting Stoneware dinner set for eight?",
  body: "Your hold runs out tomorrow. Confirm the purchase or keep the hold going.",
  href: "/gifts",
  daysAgo: 0.4,
});
notify({
  user: "hunter",
  audience: "owner",
  type: "list_view",
  title: "Graduation was opened 14 times this week",
  body: "Mostly from the link you shared on Sunday.",
  href: "/hunter/graduation",
  daysAgo: 1.5,
  read: true,
});
notify({
  user: "maya",
  audience: "owner",
  type: "gift_activity",
  title: "Le Creuset 5.5qt Dutch oven was claimed",
  body: "On First Apartment. You have surprise mode off, so you see item updates.",
  href: "/maya/first-apartment",
  daysAgo: 4,
});
notify({
  user: "theo",
  audience: "buyer",
  type: "reservation_expiring",
  title: "Still getting Sigma 35mm f/1.4 DG DN Art?",
  body: "Your hold runs out in four days. Confirm the purchase or keep the hold going.",
  href: "/gifts",
  daysAgo: 0.8,
});

events("grad", 148, 9, 30);
events("photo", 96, 4, 60);
events("cards", 23, 2, 45);
events("saving", 61, 1, 60);
events("vinyl", 74, 5, 40);
events("apartment", 38, 3, 30);
events("japan", 52, 4, 40);
events("wedding", 119, 12, 25);
events("justbecause", 11, 1, 15);

// A list is only as fresh as the last thing added to it.
db.prepare(
  `UPDATE wishlists SET updated_at = COALESCE(
     (SELECT MAX(created_at) FROM items WHERE wishlist_id = wishlists.id), created_at)`,
).run();

const counts = db
  .prepare(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM wishlists) AS lists,
            (SELECT COUNT(*) FROM items) AS items,
            (SELECT COUNT(*) FROM item_media) AS media,
            (SELECT COUNT(*) FROM reservations) AS reservations`,
  )
  .get();

process.stdout.write(`Seeded ${JSON.stringify(counts)}\n`);
process.stdout.write(`Sign in with hunter@wishwell.app / wishwell\n`);
