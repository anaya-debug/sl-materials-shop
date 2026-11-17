# Writes the search-engine files from one place. Run after changing prices, the FAQ or the domain:
#   python3 scripts/build-seo.py
# It updates, in index.html: canonical link, social-preview tags and the structured data (JSON-LD);
# and writes sitemap.xml, llms.txt and robots.launch.txt.
# The domain lives in site.json ("origin"). When the shop moves (e.g. to https://shop.sl-materials.nl),
# change it there and run this script again.
import html
import json
import re

site = json.load(open('site.json'))
ORIGIN = site['origin'].rstrip('/')

# Prices come from the shop's own config, so the structured data never disagrees with the order tool.
cfg = open('js/config.js', encoding='utf-8').read()
num = lambda key: float(re.search(rf'{key}:\s*([\d.]+)', cfg).group(1))
FROM_PRICE = num('basePerM3')
DELIVERY = num('deliveryUnderBulk')
BULK = float(re.search(r'bulk:\s*\{\s*fromM3:\s*\d+,\s*perM3:\s*([\d.]+)', cfg).group(1))

page = open('index.html', encoding='utf-8').read()

# FAQ: taken from the Dutch questions and answers on the page.
def text(fragment):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', fragment))).strip()

# Values the page fills in with JavaScript (data-slot / data-text), so the FAQ text is complete.
radius = re.search(r'radiusKm:\s*(\d+)', cfg).group(1)
phone = re.search(r"orderPhone:\s*'([^']+)'", cfg).group(1)
sales = re.search(r"salesEmail:\s*'([^']+)'", cfg).group(1)
FILL = {'radius': radius, 'orderPhone': phone, 'salesEmail': sales}

def fill_slots(fragment):
    fragment = re.sub(r'<span data-slot="(\w+)"></span>', lambda m: FILL.get(m.group(1), ''), fragment)
    return re.sub(r'<a [^>]*data-text="(\w+)"[^>]*></a>', lambda m: FILL.get(m.group(1), ''), fragment)

# A start tag whose attribute values may contain '>' (the data-nl / data-en copies do).
TAG = r'(?:\s+[\w-]+(?:="[^"]*")?)*\s*>'
faq = []
for q, a in re.findall(rf'<details><summary{TAG}(.*?)</summary><p{TAG}(.*?)</p></details>', page, re.S):
    a = fill_slots(a)
    faq.append({'@type': 'Question', 'name': text(q), 'acceptedAnswer': {'@type': 'Answer', 'text': text(a)}})

org = {
    '@type': 'Organization',
    '@id': f'{ORIGIN}/#organisation',
    'name': 'SL Materials',
    'alternateName': 'Liberated Concrete',
    'url': 'https://www.sl-materials.nl/',
    'logo': f'{ORIGIN}/img/sl-logo.svg',
    'email': 'info@sl-materials.nl',
    'telephone': '+31 20 280 59 00',
    'address': {'@type': 'PostalAddress', 'streetAddress': 'Kruisbaken 2', 'postalCode': '1505 HS',
                'addressLocality': 'Zaandam', 'addressCountry': 'NL'},
    'sameAs': ['https://www.sl-materials.nl/', 'https://www.linkedin.com/company/urban-mine/'],
    'contactPoint': [{'@type': 'ContactPoint', 'contactType': 'sales', 'telephone': '+31 6 57 76 13 12',
                      'email': 'betonplanning@sl-materials.nl', 'areaServed': 'NL', 'availableLanguage': ['nl', 'en'],
                      'hoursAvailable': {'@type': 'OpeningHoursSpecification',
                                         'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                                         'opens': '07:00', 'closes': '16:00'}}],
}
store = {
    '@type': 'OnlineStore',
    '@id': f'{ORIGIN}/#shop',
    'name': 'SL Materials Shop',
    'url': f'{ORIGIN}/',
    'parentOrganization': {'@id': f'{ORIGIN}/#organisation'},
    'description': 'Gecertificeerde betonmortel online bestellen, rechtstreeks uit de fabriek van SL Materials in Zaandam. Levering in Amsterdam en omgeving vanaf 1 m³.',
    'areaServed': {'@type': 'Place', 'name': 'Amsterdam en omgeving'},
}
product = {
    '@type': 'Product',
    '@id': f'{ORIGIN}/#betonmortel',
    'name': 'Liberated Concrete betonmortel',
    'description': ('Gecertificeerde betonmortel (NEN-EN 206 / NEN 8005) uit de eigen fabriek van SL Materials in Zaandam, '
                    'met tot 80% minder CO₂. Te bestellen per m³ in sterkteklassen C12/15 tot en met C45/55, '
                    'korrelgrootte 4–32 mm of 4–16 mm, consistentie S1 tot S4.'),
    'brand': {'@type': 'Brand', 'name': 'Liberated Concrete'},
    'manufacturer': {'@id': f'{ORIGIN}/#organisation'},
    'image': [f'{ORIGIN}/img/pour.jpg', f'{ORIGIN}/img/plant.jpg'],
    'category': 'Betonmortel',
    'offers': {
        '@type': 'Offer',
        'url': f'{ORIGIN}/#quote-tool',
        'priceCurrency': 'EUR',
        'price': f'{FROM_PRICE:.2f}',
        'priceSpecification': [
            {'@type': 'UnitPriceSpecification', 'price': f'{FROM_PRICE:.2f}', 'priceCurrency': 'EUR',
             'unitCode': 'MTQ', 'valueAddedTaxIncluded': False, 'name': 'Per m³, bestellingen onder 10 m³'},
            {'@type': 'UnitPriceSpecification', 'price': f'{BULK:.2f}', 'priceCurrency': 'EUR',
             'unitCode': 'MTQ', 'valueAddedTaxIncluded': False, 'name': 'Per m³ inclusief levering, vanaf 10 m³'},
        ],
        'availability': 'https://schema.org/InStock',
        'seller': {'@id': f'{ORIGIN}/#organisation'},
        'areaServed': {'@type': 'Place', 'name': 'Amsterdam en omgeving'},
        'shippingDetails': {
            '@type': 'OfferShippingDetails',
            'shippingRate': {'@type': 'MonetaryAmount', 'value': f'{DELIVERY:.2f}', 'currency': 'EUR'},
            'shippingDestination': {'@type': 'DefinedRegion', 'addressCountry': 'NL'},
            'deliveryTime': {'@type': 'ShippingDeliveryTime',
                             'handlingTime': {'@type': 'QuantitativeValue', 'minValue': 0, 'maxValue': 1, 'unitCode': 'DAY'},
                             'transitTime': {'@type': 'QuantitativeValue', 'minValue': 0, 'maxValue': 1, 'unitCode': 'DAY'}},
        },
    },
}
graph = {'@context': 'https://schema.org', '@graph': [org, store, product] + ([{'@type': 'FAQPage', 'mainEntity': faq}] if faq else [])}
ld = '<script type="application/ld+json" id="seo-ld">\n' + json.dumps(graph, ensure_ascii=False, indent=1) + '\n</script>'

head = (
    f'<link rel="canonical" href="{ORIGIN}/" id="seo-canonical">\n'
    f'<meta property="og:type" content="website" id="seo-og-type">\n'
    f'<meta property="og:url" content="{ORIGIN}/" id="seo-og-url">\n'
    f'<meta property="og:title" content="Beton online bestellen | SL Materials" id="seo-og-title">\n'
    f'<meta property="og:description" content="Gecertificeerde betonmortel rechtstreeks uit onze fabriek in Zaandam. Tot 80% minder CO₂, vanaf 1 m³." id="seo-og-desc">\n'
    f'<meta property="og:image" content="{ORIGIN}/img/pour.jpg" id="seo-og-image">\n'
    f'<meta property="og:locale" content="nl_NL" id="seo-og-locale">\n'
)
# Replace the generated block if it is there, otherwise add it before </head>.
block = '<!-- seo:start (written by scripts/build-seo.py) -->\n' + head + ld + '\n<!-- seo:end -->'
if '<!-- seo:start' in page:
    page = re.sub(r'<!-- seo:start.*?<!-- seo:end -->', lambda _: block, page, flags=re.S)
else:
    page = page.replace('</head>', block + '\n</head>', 1)
open('index.html', 'w', encoding='utf-8').write(page)

open('sitemap.xml', 'w').write(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    f'  <url><loc>{ORIGIN}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n'
    '</urlset>\n')

# The robots file to use at launch. Until then robots.txt keeps blocking everything (test site).
open('robots.launch.txt', 'w').write(
    '# Use at launch: copy over robots.txt (and remove the noindex tag in index.html).\n'
    '# Search engines and AI search crawlers may read the public shop.\n'
    'User-agent: *\n'
    'Allow: /\n'
    'Disallow: /planner.html\n'
    'Disallow: /preview/\n'
    'Disallow: /demo/\n'
    '\n'
    '# Named explicitly so firewall or host rules are easy to check against.\n'
    + ''.join(f'User-agent: {b}\nAllow: /\nDisallow: /planner.html\nDisallow: /preview/\n\n' for b in
              ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot', 'Applebot'])
    + f'Sitemap: {ORIGIN}/sitemap.xml\n')

open('llms.txt', 'w', encoding='utf-8').write(f'''# SL Materials Shop

> Online shop of SL Materials for certified ready-mix concrete (Liberated Concrete), made and delivered from SL's own plant in Zaandam, the Netherlands. Up to 80% less CO₂ than reference concrete. Orders from 1 m³, delivered across Amsterdam and the region.

The shop is in Dutch by default; English is available with the EN button.

## Ordering
- [Shop and price calculator]({ORIGIN}/): choose project type or strength class (C12/15 to C45/55), volume, unloading (chute, wheelbarrow, own pump or SL pump), stone size (4–32 or 4–16 mm), consistency and delivery day. A planner confirms by phone; the customer then pays the confirmed amount by iDEAL payment link.
- Prices excl. BTW: €{FROM_PRICE:.2f} per m³ plus €{DELIVERY:.2f} delivery under 10 m³; €{BULK:.2f} per m³ including delivery from 10 m³. SL pump €560 per delivery.
- Order before 12:00 on a working day for delivery the next working day, subject to availability. 30 minutes unloading time included.

## Company
- [SL Materials main site](https://www.sl-materials.nl/): company, process, projects
- [Certificates](https://www.sl-materials.nl/certificeringen): NEN-EN 206 / NEN 8005 and other certifications
- Contact: order line +31 6 57 76 13 12, betonplanning@sl-materials.nl; office +31 20 280 59 00, Kruisbaken 2, 1505 HS Zaandam. Mon–Fri 7:00–16:00.
''')
print(f'SEO files written for {ORIGIN}: {len(faq)} FAQ items, from €{FROM_PRICE}, delivery €{DELIVERY}, bulk €{BULK}')
