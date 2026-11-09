// Every price, rule and contact detail the shop uses lives here.
// A value of null means "still to agree": the site shows a [placeholder]
// and leaves it out of the total until a real number is filled in.

export const CONFIG = {
  locale: 'en-GB',

  pricing: {
    // Example price per m³ for the preview.
    basePerM3: 135.25,
    // Extra per m³ by stone size.
    stoneAddPerM3: { std: 0, mid: 8.5, fine: 14 },
    // Allowance added to the card hold for small changes on site.
    contingencyPct: 15,

    // Not set yet:
    fromPricePerM3: null,      // "From ... per m³" on the homepage
    fibresPerM3: null,
    pumpBySL: null,            // flat price when SL arranges the pump
    saturdaySurcharge: null,
    partLoad: { underM3: null, charge: null },
    deliveryCharge: null,
  },

  volume: { min: 1, max: 16, step: 0.5, default: 2, wastagePct: 10 },

  delivery: {
    // Rough area, about 40 km around Zaandam (to confirm). First four digits of the postcode.
    postcodeRanges: [[1000, 1199], [1300, 1999], [2000, 2199]],
    daysShown: 6,
    nextDayCutoff: null,       // e.g. '12:00'
    radiusKm: null,
  },

  responseTimes: { quote: null, callback: null },

  contact: {
    orderPhone: '+31 6 57 76 13 12',
    orderPhoneHref: 'tel:+31657761312',
    orderEmail: 'betonplanning@sl-materials.nl',
    mainPhone: '020 280 59 00',
    address: 'Kruisbaken 2, 1505 HS Zaandam',
    hours: 'Mon–Fri 7:00–16:00',
    saturdayHours: null,
    whatsapp: null,
    tradePaymentTerms: null,
    termsUrl: 'https://www.sl-materials.nl/en/algemene-voorwaarden',
    mainSite: 'https://www.sl-materials.nl/en',
  },
};
