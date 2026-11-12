// What the order tool offers. Wording comes from the approved mock-up.
// Each item has English fields and an `nl` block with the Dutch. Planners see the English.

export const PROJECTS = [
  // The five uses from SL's old shop (betonconcurrent.nl). Strength class of the standard mix to confirm.
  { id: 'floor', label: 'Rough concrete floor', sub: 'Shed bases, sheds, sub-floors', mix: 'Standard mix', why: 'For floors that get a finish on top or stay rough.',
    nl: { label: 'Ruwe betonvloer', sub: 'Tuinhuisjes, schuren, ondervloeren', mix: 'Standaardmengsel', why: 'Voor vloeren die nog worden afgewerkt of ruw blijven.' } },
  { id: 'foundation', label: 'Foundations', sub: 'Extensions, walls, house builds', mix: 'Standard mix', why: 'Standard for strip and slab foundations.',
    nl: { label: 'Fundering', sub: 'Aanbouwen, muren, nieuwbouw', mix: 'Standaardmengsel', why: 'Standaard voor stroken- en plaatfunderingen.' } },
  { id: 'wall', label: 'Wall', sub: 'Poured walls, retaining walls', mix: 'Standard mix', why: 'Poured into formwork.',
    nl: { label: 'Wand', sub: 'Gestorte wanden, keerwanden', mix: 'Standaardmengsel', why: 'Gestort in een bekisting.' } },
  { id: 'power', label: 'Power-floated floor', sub: 'Smooth finished floors, garages, workshops', mix: 'Standard mix', why: 'Finished smooth with a power float.',
    nl: { label: 'Vlinderbeton', sub: 'Glad afgewerkte vloeren, garages, werkplaatsen', mix: 'Standaardmengsel', why: 'Glad afgewerkt met een vlindermachine.' } },
  { id: 'farm', label: 'Agricultural', sub: 'Barns, farmyards, stables', mix: 'Standard mix', why: 'Durable against heavy use.',
    nl: { label: 'Agrarisch', sub: 'Schuren, erven, stallen', mix: 'Standaardmengsel', why: 'Duurzaam bij intensief gebruik.' } },
  { id: 'unsure', label: 'Not sure', sub: "We'll recommend the right mix", mix: null, why: '',
    nl: { label: 'Weet ik niet', sub: 'Wij adviseren het juiste mengsel', why: '' } },
];

// Extras from the old shop, priced per m³ excl. BTW (see CONFIG.pricing.addOnsPerM3).
export const ADD_ONS = [
  { id: 'highStrength', label: 'Extra high strength C30/37', sub: 'For heavier loads', projectOnly: true,
    nl: { label: 'Extra hoge sterkte C30/37', sub: 'Voor zwaardere belasting' } },
  { id: 'fastSetting', label: 'Fast-setting', sub: 'Hardens sooner, useful in cold weather',
    nl: { label: 'Snelhardend', sub: 'Sneller hard, handig bij koud weer' } },
];

export const MIX_CODES = [
  { code: 'C12/15', use: 'Blinding, fill', nl: { use: 'Werkvloer, opvulling' } },
  { code: 'C20/25', use: 'Light foundations, shed bases', nl: { use: 'Lichte funderingen, tuinhuisjes' } },
  { code: 'C25/30', use: 'Floors, heavier foundations', nl: { use: 'Vloeren, zwaardere funderingen' } },
  { code: 'C28/35', use: 'Structural slabs, paths', nl: { use: 'Constructieve vloeren, paden' } },
  { code: 'C30/37', use: 'Driveways, garage floors', nl: { use: 'Opritten, garagevloeren' } },
  { code: 'C35/45', use: 'Heavy duty, yards', nl: { use: 'Zwaar belast, erven' } },
  { code: 'C45/55', use: 'High strength, structural', nl: { use: 'Hoge sterkte, constructief' } },
  { code: 'Other', use: 'Tell us your spec', nl: { code: 'Anders', use: 'Geef je specificatie door' } },
];

export const OFFLOADS = [
  // `short` is what planners see in the inbox.
  { id: 'chute', label: 'Straight from the truck', sub: 'Most common · poured from the chute', short: 'Chute',
    nl: { label: 'Direct uit de truck', sub: 'Meest gekozen · via de stortgoot' } },
  { id: 'barrow', label: 'Wheelbarrow', sub: 'You barrow from the truck', short: 'Wheelbarrow',
    nl: { label: 'Kruiwagen', sub: 'Je rijdt het zelf weg vanaf de truck' } },
  { id: 'pumpown', label: 'Pump, I arrange it', sub: 'Your own pump on site', short: 'Own pump',
    nl: { label: 'Pomp, zelf geregeld', sub: 'Je eigen pomp op locatie' } },
  { id: 'pumpsl', label: 'Pump, SL arranges it', sub: 'Charged separately · we get in touch', short: 'Pump (SL)',
    nl: { label: 'Pomp, via SL', sub: 'Apart berekend · wij nemen contact op' } },
];

export const CONSISTENCY = [
  { id: 'S1', label: 'S1 · Stiff', sub: 'Kerbs, slopes', nl: { label: 'S1 · Stijf', sub: 'Banden, hellingen' } },
  { id: 'S2', label: 'S2 · Plastic', sub: 'Hand-placed slabs', nl: { label: 'S2 · Plastisch', sub: 'Met de hand gestorte vloeren' } },
  { id: 'S3', label: 'S3 · Standard', sub: 'Most jobs', nl: { label: 'S3 · Standaard', sub: 'De meeste klussen' } },
  { id: 'S4', label: 'S4 · Highly fluid', sub: 'Pumping, dense rebar', nl: { label: 'S4 · Hoog vloeibaar', sub: 'Pompen, veel wapening' } },
];

export const STONE_SIZES = [
  { id: 'std', label: '4–32 mm', sub: 'Standard', nl: { sub: 'Standaard' } },
  { id: 'mid', label: '4–16 mm' },
  { id: 'fine', label: '2–8 mm' },
];

export const QUOTE_PROJECT_TYPES = [
  { en: 'Foundations', nl: 'Funderingen' },
  { en: 'Floors and slabs', nl: 'Vloeren en platen' },
  { en: 'Driveway or yard', nl: 'Oprit of erf' },
  { en: 'Piling', nl: 'Heiwerk' },
  { en: 'Pumped pour', nl: 'Pompstort' },
  { en: 'Specified mix / tender', nl: 'Voorgeschreven mengsel / aanbesteding' },
  { en: 'Other', nl: 'Anders' },
];
