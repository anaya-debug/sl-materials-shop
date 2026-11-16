// Every price, rule and contact detail the shop uses lives here.
// A value of null means "still to agree": the site shows a [placeholder]
// and leaves it out of the total until a real number is filled in.
// Values marked SUGGESTED are researched starting points for the team to check.

export const CONFIG = {
  locale: 'en-GB',

  pricing: {
    // Prices set 16 Nov 2026 at about 5% under ikwilbetonbestellen.nl (checked for Amsterdam 1013,
    // excl. BTW): they charge €126/m³ + €225 delivery under 10 m³, and €151/m³ all-in from 10 m³.
    // Recheck every month or two: their prices follow diesel and cement costs.

    // Price per m³ excl. BTW, for orders under `bulk.fromM3`.
    basePerM3: 119.5,
    fromPricePerM3: 119.5,     // "From ... per m³" on the homepage
    // One delivery charge per order under `bulk.fromM3`.
    deliveryUnderBulk: 213,
    // From this size: one all-in price per m³, delivery included.
    bulk: { fromM3: 10, perM3: 143.5 },

    // Extra per m³ by stone size (theirs: fine gravel +€8).
    // Two sizes since 16 Nov: standard 4–32 mm and fine 4–16 mm.
    stoneAddPerM3: { std: 0, fine: 7.6 },
    // Extras per m³ (theirs: high strength +€11, fast-setting +€5, highly fluid +€4.50).
    addOnsPerM3: { highStrength: 10.45, fastSetting: 4.75 },
    consistencyAddPerM3: { S1: 0, S2: 0, S3: 0, S4: 4.28 },
    // BTW (Dutch VAT). Private customers see prices including it; business customers see it added.
    vatPct: 21,
    // Allowance added to the card hold for small changes on site or extra waiting time.
    contingencyPct: 15,

    // SUGGESTED: polypropylene micro-fibres usually add €5–10 per m³ (competitor does not list fibres).
    fibresPerM3: 8,
    // Fibres hidden for now (meeting 16 Nov: price unclear, launch lean). Set true to offer them again.
    offerFibres: false,

    // Trucks carry up to 12 m³. A bigger order is split evenly over the fewest trucks.
    truckM3: 12,

    // No separate part-load charge any more: the delivery charge covers small loads.
    partLoad: null,

    // Pump arranged by SL: €560 per order excl. BTW, any volume (meeting 16 Nov).
    pumpBySL: { flat: 560, perM3: 0 },

    // Not set yet:
    saturdaySurcharge: null,
    // Waiting time after the free 30 minutes (James, 9 Nov): €50 per started 15 minutes.
    waiting: { perBlock: 50, blockMinutes: 15 },
  },

  // Unloading time included with every delivery.
  freeUnloadMinutes: 30,
  // Above this, wheelbarrow orders get a stronger warning.
  barrowWarnM3: 2,
  // Consistencies that can go through a pump.
  pumpableConsistency: ['S3', 'S4'],

  volume: { min: 1, max: 48, step: 0.5, default: 2, wastagePct: 10 },

  delivery: {
    // Rough area around Zaandam (to confirm). First four digits of the postcode.
    postcodeRanges: [[1000, 1199], [1300, 1999], [2000, 2199]],
    daysShown: 6,
    // Saturday delivery hidden until SL sets a Saturday price (decided 16 Nov).
    saturday: false,
    nextDayCutoff: '12:00',    // 24-hour clock; after this, tomorrow is not offered (meeting 16 Nov: match competitor)
    radiusKm: 30,
  },

  responseTimes: { quote: '48 hours', quoteNl: '48 uur', callback: null },

  contact: {
    orderPhone: '+31 6 57 76 13 12',
    orderPhoneHref: 'tel:+31657761312',
    orderEmail: 'betonplanning@sl-materials.nl',
    salesEmail: 'info@sl-materials.nl',
    mainPhone: '020 280 59 00',
    mainPhoneHref: 'tel:+31202805900',
    address: 'Kruisbaken 2, 1505 HS Zaandam',
    hours: 'Mon–Fri 7:00–16:00',
    hoursNl: 'ma–vr 7:00–16:00',
    saturdayHours: null,
    whatsapp: null,
    tradePaymentTerms: null,
    termsUrl: 'https://www.sl-materials.nl/en/algemene-voorwaarden',
    mainSite: 'https://www.sl-materials.nl/en',
  },
};
