import { createClient } from "@supabase/supabase-js";

const copy = {
  "Marker Organizer and Holder": {
    short: "Angled marker organizer for art desks, classroom supplies, craft rooms, and drawing stations.",
    desc: `Keep markers visible, sorted, and easy to grab with an angled desktop organizer made for art supplies and everyday desk tools.

This holder is built for people who use markers often: artists, students, teachers, crafters, planner users, and anyone tired of markers rolling around in a drawer. The angled layout makes colors easier to see at a glance, while the compact footprint keeps the desk cleaner.

Best for: alcohol markers, paint markers, drawing markers, pens, pencils, craft tools, classroom supply stations, and home office desks.

This listing is for the 3D printed organizer only. Markers and desk accessories shown in photos are not included.

Materials: PLA 3D printed plastic.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose a color, request a custom color, or ask about sizing before ordering if you need it to fit a specific marker set.`,
    tags: ["marker organizer", "marker holder", "art desk storage", "paint marker holder", "pen holder", "desk organizer", "craft organizer", "classroom supplies", "drawing supplies", "3d printed", "made to order", "artist gift", "desk storage"],
  },
  "Rimmed Aquarium Plant Clip": {
    short: "Clip-on aquarium plant holder for pothos, monstera cuttings, and rimmed fish tanks.",
    desc: `Hold aquarium plant cuttings neatly at the rim of a tank without balancing stems or letting roots drift loose.

This clip is made for aquarium keepers who grow pothos, monstera, or other water-rooting plants from the top edge of a rimmed tank. It helps keep stems upright, roots in the water, and plant placement cleaner around the aquarium.

Best for: rimmed aquariums, plant propagation, pothos cuttings, monstera cuttings, aquaponic setups, and planted tank organization.

Check your tank rim and plant size before ordering. This listing is for the 3D printed accessory only. Live plants, fish, aquarium equipment, and mounting extras are not included.

Materials: PETG or PLA 3D printed plastic depending on selected use/color.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color and ask about fit if your tank rim is unusual.`,
    tags: ["aquarium plant", "plant clip", "pothos holder", "aquarium holder", "rimmed aquarium", "plant holder", "fish tank plant", "monstera cutting", "aquarium decor", "3d printed", "made to order", "plant support", "tank accessory"],
  },
  "Aquarium Plant Holder - Parametric": {
    short: "Aquarium plant holder for hydroponic cuttings, pothos roots, and planted tank setups.",
    desc: `Add a clean plant holder to the side of an aquarium so roots can reach nutrient-rich tank water while the plant stays supported above the rim.

This holder is useful for aquarium owners who grow pothos, herbs, or decorative cuttings from a tank. It helps keep plant stems organized, gives roots a stable place to grow, and can make a planted tank look more intentional.

Best for: aquarium pothos holders, hydroponic fish tank plants, aquaponic display setups, plant propagation, and tank-top greenery.

Measure your tank edge before ordering. This listing is for the 3D printed holder only; plants, substrate, and aquarium equipment are not included.

Materials: PETG or PLA 3D printed plastic depending on selected use/color.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Ask about sizing if you need a custom fit for a specific tank edge.`,
    tags: ["aquarium plant", "plant holder", "pothos holder", "aquarium decor", "fish tank plant", "hydroponic holder", "plant propagation", "aquaponics", "tank accessory", "3d printed", "made to order", "custom size", "plant support"],
  },
  "Wall Mounted Plant Pot with Removable Drip Tray": {
    short: "Wall-mounted plant pot with removable drip tray for small plants, cuttings, and vertical decor.",
    desc: `Add a small plant to a wall without giving up shelf space.

This wall-mounted planter is made for small plants, propagated cuttings, herbs, and decorative greenery. The removable drip tray helps make watering and cleanup easier than a fixed wall pot, while the printed design keeps the look clean and modern.

Best for: small wall plants, plant propagation, herb cuttings, apartment plant decor, office greenery, and compact plant displays.

This listing is for the 3D printed planter and tray only. Plant, soil, wall anchors, and mounting hardware are not included unless selected or requested.

Materials: PLA or PETG 3D printed plastic.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color and ask about sizing before ordering if you need it for a specific plant or wall setup.`,
    tags: ["wall planter", "plant pot", "drip tray", "wall plant holder", "small planter", "plant decor", "propagation pot", "herb planter", "apartment decor", "3d printed", "made to order", "plant gift", "wall mount"],
  },
  "Tray-based coin cell battery holder and box": {
    short: "Stackable coin cell battery storage tray and box for CR2032, button cells, and small batteries.",
    desc: `Stop loose coin cell batteries from scattering through drawers and tool boxes.

This tray-based storage box is made for organizing small button batteries by type so you can quickly find the size you need. The stacked tray format is especially useful for electronics benches, camera bags, workshop drawers, hobby stations, and household battery storage.

Best for: CR2032, CR2025, AG-series batteries, button cells, electronics parts storage, hobby benches, and drawer organization.

This listing is for the 3D printed storage holder only. Batteries are not included.

Materials: PLA 3D printed plastic.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color or request labeling/size preferences before ordering.`,
    tags: ["battery holder", "coin cell holder", "cr2032 storage", "button battery", "battery organizer", "electronics storage", "parts organizer", "drawer organizer", "workbench storage", "3d printed", "made to order", "small parts", "battery box"],
  },
  "Rotating knitting needle organizer": {
    short: "Rotating organizer for knitting needles, crochet hooks, pens, and craft tools.",
    desc: `Keep knitting needles, crochet hooks, and small craft tools upright, separated, and easy to reach.

This rotating organizer is made for craft desks where loose tools pile up quickly. Multiple outer compartments help sort needles or hooks by size, while the center compartment can hold larger tools, pens, scissors, or frequently used supplies.

Best for: knitting needles, crochet hooks, craft tools, sewing stations, desk supplies, and fiber-art workspaces.

This listing is for the 3D printed organizer only. Needles, hooks, yarn, and tools are not included.

Materials: PLA 3D printed plastic.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color or ask about sizing if you use longer tools.`,
    tags: ["knitting organizer", "needle organizer", "crochet hook holder", "craft organizer", "fiber art tools", "desk organizer", "sewing storage", "craft storage", "tool holder", "3d printed", "made to order", "yarn gift", "craft room"],
  },
  "Paint Bottles Shelf": {
    short: "Compact paint bottle shelf for miniature painting, craft paints, model paints, and hobby desks.",
    desc: `Keep hobby paint bottles visible instead of buried in a drawer.

This compact shelf is made for model painters, miniature painters, crafters, and hobby desks that need clean paint storage. The tiered shelf layout makes bottle colors easier to scan and helps keep a painting station ready to use.

Best for: miniature paint bottles, craft paint, model paints, hobby desks, art rooms, and small paint storage setups.

Check your bottle diameter before ordering. This listing is for the 3D printed shelf only. Paint bottles and tools are not included.

Materials: PLA 3D printed plastic.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color and ask about sizing if your paint bottles are larger than typical hobby paint bottles.`,
    tags: ["paint bottle shelf", "paint organizer", "miniature paint", "model paint holder", "craft paint rack", "paint storage", "hobby organizer", "art supply storage", "desk organizer", "3d printed", "made to order", "craft room", "model painting"],
  },
  "Wall-mounted battery dispenser for AA and AAA batteries": {
    short: "Wall-mounted AA and AAA battery dispenser for closets, garages, drawers, and utility rooms.",
    desc: `Store AA and AAA batteries in one visible place so they are easy to grab when something dies.

This wall-mounted battery dispenser is made for household battery storage, workshop walls, utility closets, office supply areas, and garage organization. It keeps batteries upright and accessible instead of loose in a junk drawer.

Best for: AA batteries, AAA batteries, utility rooms, garages, workshops, office supply rooms, and home organization.

This listing is for the 3D printed dispenser only. Batteries and mounting hardware are not included unless selected or requested.

Materials: PLA 3D printed plastic.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color and confirm mounting needs before ordering.`,
    tags: ["battery dispenser", "battery organizer", "aa battery holder", "aaa battery holder", "wall mounted", "garage storage", "utility closet", "battery storage", "home organizer", "3d printed", "made to order", "workshop storage", "wall organizer"],
  },
  "USB and SD card Organizer": {
    short: "Desk and drawer organizer for USB drives, SD cards, and microSD storage.",
    desc: `Keep USB drives, SD cards, and microSD cards together so they are not loose in a drawer, camera bag, or desk tray.

This compact organizer is made for photographers, students, office desks, makers, and anyone who rotates between memory cards or flash drives. It gives each item a visible place so small storage devices are easier to find.

Best for: USB drives, SD cards, microSD cards, camera kits, desk drawers, tech bags, and office organization.

This listing is for the 3D printed organizer only. USB drives and memory cards are not included.

Materials: PLA 3D printed plastic.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color or ask about custom sizing for unusual drives.`,
    tags: ["usb organizer", "sd card holder", "micro sd storage", "flash drive holder", "camera card case", "tech organizer", "desk drawer", "memory card holder", "office organizer", "3d printed", "made to order", "desk storage", "photographer gift"],
  },
  "Parametrized Tea Bag Holder. Wall/Under Shelf Mount": {
    name: "Wall or Under-Shelf Tea Bag Holder",
    short: "Wall or under-shelf tea bag holder for kitchen tea stations, cabinets, and pantry organization.",
    desc: `Turn loose tea bags into a neat tea station without taking over counter space.

This tea bag holder can work as a wall-mounted or under-shelf organizer depending on the selected setup. It is useful for kitchens, coffee bars, office break rooms, pantry shelves, and small apartments where tea boxes clutter the cabinet.

Best for: tea bag storage, kitchen organization, coffee bars, pantry shelves, under-cabinet storage, and office tea stations.

This listing is for the 3D printed holder only. Tea bags, magnets, screws, and mounting hardware are not included unless selected or requested.

Materials: PLA 3D printed plastic.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color and ask about mounting setup before ordering if you need wall, shelf, magnet, or cabinet use.`,
    tags: ["tea bag holder", "tea organizer", "tea storage", "kitchen organizer", "under shelf", "wall mounted", "tea station", "pantry storage", "cabinet organizer", "3d printed", "made to order", "kitchen storage", "tea gift"],
  },
  "Gridify 25mm bottle storage": {
    name: "25mm Bottle Storage Grid",
    short: "Grid-style 25mm bottle storage for paints, oils, small containers, and hobby supplies.",
    desc: `Organize small bottles in a clean grid so they stop tipping over or disappearing in a drawer.

This 25mm bottle storage tray is useful for hobby paints, small oils, craft bottles, model supplies, and compact workbench organization. The grid layout keeps bottles upright and easy to scan while saving desk space.

Best for: 25mm bottles, hobby paints, small craft bottles, model supplies, workbench storage, and drawer organization.

Measure your bottle diameter before ordering. This listing is for the 3D printed storage tray only. Bottles and supplies are not included.

Materials: PLA 3D printed plastic.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color and ask about layout/size if you need a specific bottle count.`,
    tags: ["bottle storage", "paint bottle tray", "hobby organizer", "small bottle holder", "workbench storage", "craft organizer", "grid storage", "desk organizer", "model supplies", "3d printed", "made to order", "drawer storage", "paint storage"],
  },
  "Stackable Organizer Assortment Box with Lid #1": {
    name: "Stackable Organizer Box with Lid",
    short: "Stackable small-parts organizer box with lid for hardware, crafts, beads, and workshop storage.",
    desc: `Give tiny parts a real home instead of letting them mix together in a drawer.

This stackable organizer box is made for small hardware, craft supplies, beads, electronic parts, screws, fishing tackle, and other little items that need divided storage. The lidded design helps keep pieces contained and the stackable shape saves shelf or drawer space.

Best for: screws, beads, hardware, electronics parts, craft supplies, small tools, workshop drawers, and hobby storage.

This listing is for the 3D printed organizer box only. Hardware, beads, tools, and contents are not included.

Materials: PLA 3D printed plastic.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color or ask about multipacks before ordering.`,
    tags: ["parts organizer", "storage box", "small parts box", "hardware storage", "craft organizer", "bead organizer", "stackable box", "box with lid", "workshop storage", "3d printed", "made to order", "drawer organizer", "tool storage"],
  },
};

const extraNames = new Map([
  ["Long & short earrings display Stand - 18min print!", "Adjustable Earring Display Stand"],
  ["Parametrized Tea Bag Holder. Wall/Under Shelf Mount", "Wall or Under-Shelf Tea Bag Holder"],
  ["Gridify 25mm bottle storage", "25mm Bottle Storage Grid"],
  ["Stackable Organizer Assortment Box with Lid #1", "Stackable Organizer Box with Lid"],
]);

const supabase = createSupabaseAdminClient();
const token = await getValidEtsyOAuthToken(supabase);
const settings = await getRuntimeSettings(supabase);
const apiKey = process.env.ETSY_API_KEY || "";
if (!apiKey || !token?.access_token) throw new Error("Etsy credentials are required.");

const { data: products, error } = await supabase.from("products").select("*").eq("etsy_state", "active").not("etsy_listing_id", "is", null);
if (error) throw error;

const results = [];
for (const product of products || []) {
  const override = copy[product.name] || copy[extraNames.get(product.name)];
  if (!override) {
    const generated = generatedCopy(product);
    if (!generated) {
      results.push({ name: product.name, synced: false, errors: ["No copy rule"] });
      continue;
    }
    await syncProduct(product, generated, results);
  } else {
    await syncProduct(product, override, results);
  }
  await delay(900);
}

console.log(JSON.stringify({
  attempted: results.length,
  synced: results.filter((item) => item.synced).length,
  failed: results.filter((item) => !item.synced).length,
  failedResults: results.filter((item) => !item.synced),
}, null, 2));
if (results.some((item) => !item.synced)) process.exit(1);

async function syncProduct(product, override, results) {
  const name = override.name || product.name;
  const patch = {
    name,
    short_description: override.short,
    full_description: override.desc,
    tags: override.tags,
    updated_at: new Date().toISOString(),
  };
  if (name !== product.name) {
    patch.slug = await uniqueSlug(slugify(name), product.id);
  }
  const { data: updated, error: updateError } = await supabase.from("products").update(patch).eq("id", product.id).select("*").single();
  if (updateError) throw updateError;
  const media = await mediaFor(product.id);
  const sync = await createOrSyncEtsyListing({ product: updated, media, publish: true, settings, apiKey, accessToken: token.access_token });
  const live = await fetchListing(sync.listingId);
  const images = await fetchImages(sync.listingId);
  const errors = validateLiveDescription(updated, live, images);
  results.push({ name: updated.name, listingId: sync.listingId, title: live.title, images, synced: errors.length === 0, errors });
}

function generatedCopy(product) {
  const name = product.name;
  const text = [name, product.category, product.tags?.join(" ")].join(" ").toLowerCase();
  if (text.includes("soap")) {
    return makeCopy(product, "Keep bar soap lifted and draining between uses.", "bathroom sinks, showers, guest bathrooms, kitchen sinks, and compact counter organization", ["soap dish", "bar soap holder", "bathroom organizer", "shower soap dish", "sink tray", "soap saver", "home organizer", "3d printed", "made to order", "bathroom decor", "soap holder", "bathroom storage", "draining dish"]);
  }
  if (text.includes("earring") || text.includes("jewelry")) {
    return makeCopy(product, "Display earrings upright for photos, craft shows, retail tables, or personal jewelry storage.", "handmade earrings, jewelry photos, vendor booths, boutiques, retail tables, and personal earring organization", ["earring display", "jewelry display", "earring stand", "vendor display", "craft show display", "jewelry photos", "retail display", "3d printed", "made to order", "earring holder", "jewelry stand", "booth display", "handmade jewelry"]);
  }
  if (text.includes("paint") || text.includes("brush") || text.includes("marker")) {
    return makeCopy(product, "Keep art tools visible, upright, and easier to grab while you work.", "paint brushes, markers, miniature painting stations, art desks, craft rooms, model painting, and hobby storage", ["art organizer", "paint holder", "brush holder", "marker organizer", "craft organizer", "hobby storage", "art supply holder", "desk organizer", "3d printed", "made to order", "craft room", "artist gift", "paint storage"]);
  }
  if (text.includes("file") || text.includes("folder") || text.includes("desk") || text.includes("stamp")) {
    return makeCopy(product, "Give papers, stamps, and desk supplies a dedicated place instead of letting them pile up.", "home offices, work desks, teacher desks, printer stations, reception counters, and everyday office organization", ["desk organizer", "office organizer", "home office", "desk storage", "teacher desk", "office supplies", "printer station", "3d printed", "made to order", "workspace setup", "paper organizer", "desk gift", "office storage"]);
  }
  if (text.includes("tea") || text.includes("mason") || text.includes("jar") || text.includes("kitchen")) {
    return makeCopy(product, "Organize small kitchen items so they are easier to see, grab, and store.", "tea stations, pantry shelves, kitchen drawers, jar-lid storage, coffee bars, and compact kitchen organization", ["kitchen organizer", "pantry storage", "tea storage", "jar lid holder", "counter organizer", "home organizer", "kitchen storage", "3d printed", "made to order", "tea gift", "drawer organizer", "small kitchen", "storage holder"]);
  }
  if (text.includes("pegboard") || text.includes("bit") || text.includes("tool") || text.includes("workshop")) {
    return makeCopy(product, "Keep small tools and workshop parts easier to find.", "pegboard walls, tool drawers, maker benches, garage storage, craft rooms, and workshop organization", ["tool organizer", "workshop storage", "pegboard storage", "small parts", "garage organizer", "maker tools", "tool holder", "3d printed", "made to order", "workbench storage", "wall storage", "tool storage", "shop organizer"]);
  }
  if (text.includes("book") || text.includes("tablet")) {
    return makeCopy(product, "Hold a book or tablet at a useful angle while keeping your hands free.", "recipes, studying, reading, video calls, kitchen counters, and compact desk setups", ["tablet stand", "book stand", "recipe holder", "reading stand", "desk stand", "cookbook holder", "book holder", "tablet holder", "3d printed", "made to order", "study desk", "kitchen stand", "foldable stand"]);
  }
  return makeCopy(product, "Keep everyday items sorted in a compact made-to-order organizer.", "desk storage, home organization, hobby supplies, craft rooms, and small-space utility", ["desk organizer", "home organizer", "storage tray", "small organizer", "3d printed", "made to order", "custom color", "desk storage", "utility organizer", "gift organizer", "craft storage", "workspace", "home storage"]);
}

function makeCopy(product, opener, useCases, tags) {
  return {
    short: `${product.name} for ${useCases.split(",").slice(0, 2).join(" and")}.`.slice(0, 180),
    desc: `${opener}

This made-to-order 3D printed item is intended for ${useCases}. It is useful when a standard store-bought organizer is too generic or does not fit the exact space, tool, or workflow you need.

Best for: ${useCases}.

This listing is for the 3D printed item only. Props, tools, supplies, and accessories shown in photos are not included.

Materials: ${product.materials || "PLA 3D printed plastic"}.

What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.

Options: Choose color or ask about sizing before ordering if fit is important.`,
    tags,
  };
}

function validateLiveDescription(product, listing, images) {
  const description = String(listing.description || "");
  const errors = [];
  if (listing.state !== "active") errors.push(`state ${listing.state}`);
  if (images < 5) errors.push(`only ${images} images`);
  if (description.includes("selected for clean utility") || description.includes("Review final color")) errors.push("generic draft copy remains");
  if (!description.includes("Source and license:")) errors.push("missing source/license section");
  if (product.source_url && !description.includes(product.source_url)) errors.push("missing source URL");
  if (product.attribution_required && !description.includes("Attribution notice:")) errors.push("missing attribution notice");
  if (!description.includes("This listing is for the 3D printed")) errors.push("missing what-is-included line");
  return errors;
}

async function mediaFor(productId) {
  const { data, error } = await supabase.from("product_media").select("*").eq("product_id", productId).order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchListing(id) {
  const response = await fetch(`https://api.etsy.com/v3/application/listings/${id}`, { headers: etsyHeaders() });
  const text = await response.text();
  if (!response.ok) throw new Error(`Fetch listing ${id} failed ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function fetchImages(id) {
  const response = await fetch(`https://api.etsy.com/v3/application/listings/${id}/images`, { headers: etsyHeaders() });
  const text = await response.text();
  if (!response.ok) throw new Error(`Fetch images ${id} failed ${response.status}: ${text.slice(0, 300)}`);
  const payload = JSON.parse(text);
  return payload.count ?? payload.results?.length ?? 0;
}

function etsyHeaders() {
  return { Authorization: `Bearer ${token.access_token}`, "x-api-key": apiKey };
}

function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin credentials are required.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getValidEtsyOAuthToken(supabase) {
  const { data, error } = await supabase.from("private_app_settings").select("value").eq("key", "etsy_oauth_token").maybeSingle();
  if (error) throw error;
  const tokenValue = data?.value;
  if (!tokenValue?.access_token) return null;
  if (!tokenValue.expires_at || tokenValue.expires_at > Date.now() + 5 * 60 * 1000) return tokenValue;
  if (!tokenValue.refresh_token) return tokenValue;
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", (process.env.ETSY_API_KEY || "").split(":")[0]);
  body.set("refresh_token", tokenValue.refresh_token);
  const response = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const refreshed = await response.json();
  if (!response.ok || !refreshed.access_token) throw new Error("Could not refresh Etsy token.");
  const next = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || tokenValue.refresh_token,
    expires_at: Date.now() + (refreshed.expires_in || 3600) * 1000,
  };
  await supabase.from("private_app_settings").upsert({ key: "etsy_oauth_token", value: next, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return next;
}

async function getRuntimeSettings(supabase) {
  const { data } = await supabase.from("private_app_settings").select("value").eq("key", "etsy_runtime_settings").maybeSingle();
  const saved = data?.value || {};
  return {
    shopId: process.env.ETSY_SHOP_ID || saved.shopId || "",
    taxonomyId: process.env.ETSY_DEFAULT_TAXONOMY_ID || saved.taxonomyId || "",
    shippingProfileId: process.env.ETSY_SHIPPING_PROFILE_ID || saved.shippingProfileId || "",
    readinessStateId: process.env.ETSY_READINESS_STATE_ID || saved.readinessStateId || "",
    returnPolicyId: process.env.ETSY_RETURN_POLICY_ID || saved.returnPolicyId || "",
  };
}

function productToEtsyDraft(product, taxonomyId) {
  const body = new URLSearchParams();
  body.set("quantity", "10");
  body.set("title", `${buyerSafeTitle(product.name)} - ${physicalTitleSuffix(product)}, PRINTZ By Khan`.slice(0, 140));
  body.set("description", etsyDescription(product));
  body.set("price", String(product.price || 19.99));
  body.set("who_made", "i_did");
  body.set("when_made", "made_to_order");
  body.set("taxonomy_id", taxonomyId);
  body.set("is_supply", "false");
  body.set("item_weight", "8");
  body.set("item_length", "8");
  body.set("item_width", "6");
  body.set("item_height", "4");
  body.set("item_weight_unit", "oz");
  body.set("item_dimensions_unit", "in");
  const tags = etsyTags(product);
  if (tags.length) body.set("tags", tags.join(","));
  return body;
}

async function createOrSyncEtsyListing({ apiKey, accessToken, settings, product, media, publish }) {
  const body = productToEtsyDraft(product, settings.taxonomyId);
  body.set("shipping_profile_id", settings.shippingProfileId);
  body.set("readiness_state_id", settings.readinessStateId);
  body.set("return_policy_id", settings.returnPolicyId);
  if (publish) body.set("state", "active");
  const response = await fetch(`https://api.etsy.com/v3/application/shops/${settings.shopId}/listings/${product.etsy_listing_id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded", "x-api-key": apiKey },
    body,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Etsy update failed ${response.status}: ${text.slice(0, 500)}`);
  await syncImages({ apiKey, accessToken, settings, listingId: product.etsy_listing_id, product, media });
  return { listingId: product.etsy_listing_id, url: product.etsy_url || `https://www.etsy.com/listing/${product.etsy_listing_id}` };
}

async function syncImages({ apiKey, accessToken, settings, listingId, product, media }) {
  const imageUrls = Array.from(new Set([product.main_image_url, ...media.filter((item) => item.media_type === "image").map((item) => item.url)].filter(Boolean))).slice(0, 10);
  if (!imageUrls.length) return;
  const existing = await fetchImages(listingId).catch(() => 0);
  if (existing >= imageUrls.length) return;
  for (const [index, url] of imageUrls.entries()) {
    const image = await downloadImage(url).catch(() => null);
    if (!image) continue;
    const body = new FormData();
    body.set("rank", String(index + 1));
    body.set("image", new Blob([image.bytes], { type: image.contentType }), image.fileName);
    const response = await fetch(`https://api.etsy.com/v3/application/shops/${settings.shopId}/listings/${listingId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "x-api-key": apiKey },
      body,
    });
    if (!response.ok) break;
    await delay(250);
  }
}

async function downloadImage(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not download image ${url}`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const pathname = new URL(url).pathname;
  const name = pathname.split("/").filter(Boolean).pop() || "printz-product-image.jpg";
  return { bytes: new Uint8Array(await response.arrayBuffer()), contentType, fileName: name };
}

function etsyDescription(product) {
  const sourceSection = sourceAttributionSection(product);
  return `${product.name}

${cleanBuyerText(product.full_description || product.short_description)}

Details:
- Category: ${product.category}
- Materials: ${product.materials || "PLA 3D printed plastic"}
- Dimensions: ${product.dimensions || "See listing photos/details"}
- Processing time: ${product.processing_time || "Made to order in 2-4 business days"}

Customization:
${product.customization_notes || "Choose available color and sizing options before production."}
Color options: ${(product.color_options || ["Black", "White", "Custom color"]).join(", ")}
Size options: ${(product.size_options || ["Standard"]).join(", ")}
Finish options: ${(product.finish_options || ["Standard"]).join(", ")}

Care:
${product.care_instructions || "Keep away from high heat. Clean gently with a dry or slightly damp cloth. Layer lines and small surface variations are normal for 3D printed items."}

Notes:
- Created by PRINTZ By Khan.
- For physical 3D printed items, minor layer lines are normal.
- Review sizing and color options before ordering.
${sourceSection ? `\nSource and license:\n${sourceSection}` : ""}`.slice(0, 13000);
}

function sourceAttributionSection(product) {
  const lines = [];
  const sourcePlatform = product.source_platform || (product.source_url?.includes("makerworld.com") ? "MakerWorld" : "");
  const creator = product.creator_name?.trim();
  const license = product.license_type?.trim();
  if (license || product.source_url || creator || sourcePlatform) {
    lines.push(`Model: ${sourceModelTitle(product) || product.name}`);
    if (creator) lines.push(`Creator: ${creator}`);
    if (sourcePlatform) lines.push(`Platform: ${sourcePlatform}`);
    if (product.source_url) lines.push(`Source: ${product.source_url}`);
    if (license) lines.push(`License: ${license}${product.license_url ? ` - ${product.license_url}` : ""}`);
    lines.push(`Changes / use: ${attributionChangeStatement(product)}`);
  }
  if (product.attribution_required === true) lines.push("Attribution notice: This listing provides creator, source, license, and use/change details for the source model.");
  else if (product.attribution_required === false && license) lines.push("Attribution notice: Attribution is optional under this license, but source details are included for transparency.");
  if (product.share_alike_required) lines.push("Share-alike terms apply to adaptations where required by the source license.");
  return lines.join("\n");
}

function sourceModelTitle(product) {
  const attribution = product.attribution_text?.trim();
  return attribution?.split(/\s+by\s+/i)[0]?.replace(/^["“”]+|["“”]+$/g, "").trim() || "";
}

function attributionChangeStatement(product) {
  const license = product.license_type?.toLowerCase() || "";
  if (license.includes("cc0")) return "Physical 3D printed item made by PRINTZ By Khan from the source model. Attribution is not required under CC0.";
  if (product.modification_allowed === false || license.includes("by-nd")) return "Physical 3D printed item made by PRINTZ By Khan from the unmodified source model; color, material, scale, and print settings may vary. No modified model files are redistributed.";
  if (product.share_alike_required || license.includes("by-sa")) return "Physical 3D printed item made by PRINTZ By Khan. Color, material, scale, and print-setting adjustments may be used; adaptations remain subject to the share-alike license terms where applicable. No digital model files are redistributed.";
  return "Physical 3D printed item made by PRINTZ By Khan. Color, material, scale, and print-setting adjustments may be used. No digital model files are redistributed.";
}

function etsyTags(product) {
  const internalTags = new Set(["first-publish-batch", "first-publish-batch-2026-06-30", "etsy-ads-test"]);
  return Array.from(new Set([...(product.tags || []).filter((tag) => !internalTags.has(tag)), product.category, "3d printed", "printz by khan"]
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim())
    .filter(Boolean)
    .map((tag) => tag.slice(0, 20))))
    .slice(0, 13);
}

function buyerSafeTitle(value) {
  return String(value || "").replace(/\s{2,}/g, " ").trim();
}

function physicalTitleSuffix(product) {
  const text = [product.name, product.category, product.short_description, ...(product.tags || [])].join(" ").toLowerCase();
  if (text.includes("aquarium")) return "3D Printed Aquarium Plant Holder";
  if (text.includes("plant") || text.includes("planter")) return "3D Printed Plant Organizer";
  if (text.includes("paint") || text.includes("brush") || text.includes("marker")) return "3D Printed Art Supply Organizer";
  if (text.includes("earring") || text.includes("jewelry")) return "3D Printed Jewelry Display";
  if (text.includes("battery")) return "3D Printed Battery Storage Organizer";
  if (text.includes("usb") || text.includes("sd card") || text.includes("cable") || text.includes("wire")) return "3D Printed Tech Organizer";
  if (text.includes("tea") || text.includes("mason") || text.includes("soap")) return "3D Printed Home Organizer";
  if (text.includes("pegboard") || text.includes("bit") || text.includes("workshop")) return "3D Printed Workshop Organizer";
  if (text.includes("file") || text.includes("stamp") || text.includes("desk") || text.includes("printer")) return "3D Printed Desk Organizer";
  return "3D Printed Organizer";
}

function cleanBuyerText(value) {
  return String(value || "")
    .replace(/Source model notes:[\s\S]*?(?=\n\nMaterials:|\n\nWhat to expect:|\n\nOptions:|\n\nMakerWorld source verified|$)/gi, "")
    .replace(/Admin production note:[^\n]*(\n\n)?/gi, "")
    .replace(/Source model\/listing is attached[\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function uniqueSlug(base, productId) {
  let candidate = base;
  for (let index = 2; index < 20; index++) {
    const { data, error } = await supabase.from("products").select("id").eq("slug", candidate).maybeSingle();
    if (error) throw error;
    if (!data || data.id === productId) return candidate;
    candidate = `${base}-${index}`;
  }
  return `${base}-${Date.now()}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
