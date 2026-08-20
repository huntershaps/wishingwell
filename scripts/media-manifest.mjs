// Every photograph in the demo, with the search that finds it. Keeping the
// queries here means the whole media set can be rebuilt from scratch.
//
// `pin` names an exact photo id. Search cannot be trusted where the item names
// a brand — a watch called a Seiko has to actually be a Seiko.
export const PHOTOS = [
  // Photography list
  { key: "sony-a7", q: "sony alpha camera", o: "landscape" },
  { key: "sony-a7-alt", q: "camera on desk photographer", o: "landscape" },
  { key: "sigma-lens", q: "sigma camera lens", o: "landscape", pin: "lRgkUlxJCkA" },
  { key: "film-camera", q: "film rangefinder camera", o: "landscape" },
  { key: "peak-backpack", q: "camera backpack photographer", o: "portrait", pin: "BmH09wAkJa8" },
  { key: "cinestill-film", q: "35mm film rolls", o: "landscape" },
  { key: "tripod", q: "tripod camera outdoors landscape", o: "portrait" },
  { key: "godox-flash", q: "studio lighting portrait setup", o: "landscape" },
  { key: "darkroom", q: "film photography prints", o: "landscape" },

  // Graduation list
  { key: "bellroy-pack", q: "leather backpack minimal", o: "portrait" },
  { key: "seiko-watch", q: "wristwatch leather strap close up", o: "landscape", pin: "5_kn5-AC9SQ" },
  { key: "books", q: "stack of books reading", o: "portrait" },
  { key: "suitcase", q: "carry on suitcase travel", o: "portrait" },
  { key: "notebook", q: "leather notebook pen desk", o: "landscape" },

  // Sports cards list
  { key: "trading-cards", q: "sports card collection", o: "landscape", pick: 2 },
  { key: "card-sleeves", q: "baseball cards vintage", o: "landscape" },
  { key: "display-case", q: "wall shelf display collectibles", o: "portrait" },
  { key: "card-packs", q: "baseball card pack collector", o: "landscape" },

  // Saving for
  { key: "espresso", q: "espresso machine kitchen", o: "portrait" },
  { key: "aeron", q: "ergonomic office desk chair", o: "portrait" },
  { key: "kyoto", q: "kyoto temple autumn", o: "landscape" },

  // Music / Maya
  { key: "turntable", q: "record player turntable", o: "landscape" },
  { key: "turntable-alt", q: "vinyl record spinning", o: "portrait" },
  { key: "vinyl", q: "vinyl records crate", o: "landscape" },
  { key: "speakers", q: "bookshelf speakers hifi", o: "portrait" },
  { key: "record-shop", q: "record store shopping vinyl", o: "landscape", pick: 3 },

  // First apartment / Maya
  { key: "dutch-oven", q: "dutch oven", o: "portrait" },
  { key: "linen-bed", q: "linen bedding bedroom", o: "landscape" },
  { key: "floor-lamp", q: "floor lamp living room", o: "portrait" },
  { key: "chef-knife", q: "chef knife kitchen", o: "landscape" },

  // Travel / Dev
  { key: "ryokan", q: "japanese ryokan tatami room", o: "landscape" },
  { key: "hakone", q: "hakone japan mountain", o: "portrait" },
  { key: "tokyo-night", q: "tokyo street at night", o: "landscape" },
  { key: "running-shoes", q: "running shoes trail", o: "landscape" },

  // Sneakers + wedding + covers
  { key: "sneakers", q: "white sneakers studio", o: "landscape" },
  { key: "sneakers-alt", q: "sneakers detail shot", o: "portrait" },
  { key: "wedding-table", q: "wedding table setting", o: "landscape" },
  { key: "ceramics", q: "handmade ceramic bowls", o: "portrait" },
  { key: "cover-graduation", q: "university graduation gown ceremony", o: "landscape" },
  { key: "cover-photography", q: "photographer at work", o: "landscape" },
  { key: "cover-apartment", q: "cozy apartment interior", o: "landscape" },
  { key: "cover-desk", q: "minimal desk workspace", o: "landscape" },
];
