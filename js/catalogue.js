// What the order tool offers. Wording comes from the approved mock-up.

export const PROJECTS = [
  { id: 'shed', label: 'Shed base', sub: 'Garden buildings, light paths', mix: 'C20/25', why: 'Suits light, unreinforced slabs.' },
  { id: 'footing1', label: 'Single-storey foundations', sub: 'Extensions, garden walls', mix: 'C20/25', why: 'Standard for strip footings.' },
  { id: 'footing2', label: 'Two-storey foundations', sub: 'House builds, larger extensions', mix: 'C25/30', why: 'Extra strength for heavier loads.' },
  { id: 'garage', label: 'Garage floor', sub: 'Garage slabs, workshops', mix: 'C30/37', why: 'Takes vehicle loads and wear.' },
  { id: 'floor', label: 'Indoor floor', sub: 'Ground-floor slabs', mix: 'C25/30', why: 'Typical for domestic floors.' },
  { id: 'drive', label: 'Driveway', sub: 'Cars, light vans', mix: 'C30/37', why: 'Outdoor, frost-resistant strength.' },
  { id: 'drivehd', label: 'Heavy-duty driveway', sub: 'Heavy vehicles, yards', mix: 'C35/45', why: 'For heavy traffic and loads.' },
  { id: 'farm', label: 'Yard or agricultural', sub: 'Barns, farmyards', mix: 'C35/45', why: 'Durable against heavy use.' },
  { id: 'pump', label: 'Pumped concrete', sub: 'Hard to reach, upper floors', mix: 'C25/30 · S4', why: 'Fluid enough to pump.' },
  { id: 'unsure', label: 'Not sure', sub: "We'll recommend the right mix", mix: null, why: '' },
];

export const MIX_CODES = [
  { code: 'C12/15', use: 'Blinding, fill' },
  { code: 'C20/25', use: 'Light foundations, shed bases' },
  { code: 'C25/30', use: 'Floors, heavier foundations' },
  { code: 'C28/35', use: 'Structural slabs, paths' },
  { code: 'C30/37', use: 'Driveways, garage floors' },
  { code: 'C35/45', use: 'Heavy duty, yards' },
  { code: 'C45/55', use: 'High strength, structural' },
  { code: 'Other', use: 'Tell us your spec' },
];

export const OFFLOADS = [
  // `short` is what planners see in the inbox.
  { id: 'chute', label: 'Straight from the truck', sub: 'Most common · poured from the chute', short: 'Chute' },
  { id: 'barrow', label: 'Wheelbarrow', sub: 'You barrow from the truck', short: 'Wheelbarrow' },
  { id: 'pumpown', label: 'Pump, I arrange it', sub: 'Your own pump on site', short: 'Own pump' },
  { id: 'pumpsl', label: 'Pump, SL arranges it', sub: 'Priced on confirmation', short: 'Pump (SL)' },
];

export const CONSISTENCY = [
  { id: 'S1', label: 'S1 · Stiff', sub: 'Kerbs, slopes' },
  { id: 'S2', label: 'S2 · Plastic', sub: 'Hand-placed slabs' },
  { id: 'S3', label: 'S3 · Standard', sub: 'Most jobs' },
  { id: 'S4', label: 'S4 · Fluid', sub: 'Pumping, dense rebar' },
];

export const STONE_SIZES = [
  { id: 'std', label: '4–32 mm', sub: 'Standard' },
  { id: 'mid', label: '4–16 mm' },
  { id: 'fine', label: '2–8 mm' },
];

export const QUOTE_PROJECT_TYPES = [
  'Foundations', 'Floors and slabs', 'Driveway or yard', 'Piling',
  'Pumped pour', 'Specified mix / tender', 'Other',
];
