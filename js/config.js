// Every price, rule and contact detail the shop uses lives here.
// A value of null means "still to agree": the site shows a [placeholder]
// and leaves it out of the total until a real number is filled in.
// Values marked SUGGESTED are researched starting points for the team to check.

export const CONFIG = {
  locale: 'en-GB',

  pricing: {
    // Price per m³ excl. BTW (James, 9 Nov: "from €120 + BTW").
    basePerM3: 120,
    fromPricePerM3: 120,       // "From ... per m³" on the homepage
    // Extra per m³ by stone size.
    stoneAddPerM3: { std: 0, mid: 8.5, fine: 14 },
    // BTW (Dutch VAT). Private customers see prices including it; business customers see it added.
    vatPct: 21,
    // Allowance added to the card hold for small changes on site or extra waiting time.
    contingencyPct: 15,

    // SUGGESTED: polypropylene micro-fibres usually add €5–10 per m³.
    fibresPerM3: 8,

    // Trucks carry up to 12 m³. A bigger order is split evenly over the fewest trucks
    // (14 m³ goes as 2 × 7 m³), so buying a little extra stays fair.
    truckM3: 12,

    // SUGGESTED: part-load charge per m³ the truck is short of a full load.
    // A truck carrying less than `underM3` pays `perM3Short` for every m³ below it,
    // so 1 m³ pays a lot more than 7 m³ (common practice with UK and Dutch suppliers).
    partLoad: { underM3: 8, perM3Short: 35 },

    // SUGGESTED: flat delivery charge per truck.
    deliveryPerTruck: 95,

    // Not set yet:
    pumpBySL: null,            // pump hire is priced by the planner and charged separately
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
    nextDayCutoff: '11:00',    // 24-hour clock; after this, tomorrow is not offered
    radiusKm: 30,
  },

  responseTimes: { quote: '48 hours', callback: null },

  contact: {
    orderPhone: '+31 6 57 76 13 12',
    orderPhoneHref: 'tel:+31657761312',
    orderEmail: 'betonplanning@sl-materials.nl',
    salesEmail: 'info@sl-materials.nl',
    mainPhone: '020 280 59 00',
    mainPhoneHref: 'tel:+31202805900',
    address: 'Kruisbaken 2, 1505 HS Zaandam',
    hours: 'Mon–Fri 7:00–16:00',
    saturdayHours: null,
    whatsapp: null,
    tradePaymentTerms: null,
    termsUrl: 'https://www.sl-materials.nl/en/algemene-voorwaarden',
    mainSite: 'https://www.sl-materials.nl/en',
  },
};
