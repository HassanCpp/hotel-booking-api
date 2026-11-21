import mongoose, { Types } from 'mongoose';
import { Property } from '../models/Property';
import { HotelAccount } from '../models/HotelAccount';
import { User } from '../models/User';
import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { DocumentIngestionService } from '../services/ai/document-ingestion.service';
import { env } from '../config/env';

interface KnowledgeDocSeed {
  propertySlug?: string; // If undefined, this is Super Admin Global Master document
  title: string;
  filename: string;
  content: string;
}

const KNOWLEDGE_SEEDS: KnowledgeDocSeed[] = [
  // ==========================================
  // 1. SUPER ADMIN GLOBAL MASTER KNOWLEDGE
  // ==========================================
  {
    title: 'Global Platform Terms, Guest Standards & Cancellation Policy',
    filename: 'global-platform-terms-and-cancellation-policy.txt',
    content: `# Global Platform Terms, Guest Standards & Cancellation Policy

## Master Reservation & Verification Framework
All reservations confirmed across the marketplace are subject to unified verification standards and guest conduct rules.
Guests must present government-issued photographic identification upon arrival at any platform property.
For Pakistani nationals, an original valid Computerized National Identity Card (CNIC) or Smart NIC is mandatory.
For international travelers, an original valid Passport with an appropriate Pakistani entrance visa or electronic travel authorization (e-Visa) is required by law.
Unaccompanied minors under 18 years of age cannot register as lead guests without signed parental or guardian authorization accompanied by guardian CNIC copies.

## Universal Security Deposit Standard
All partner properties collect a refundable security deposit or credit card pre-authorization hold upon check-in.
The standard deposit amount is PKR 5,000 for standard rooms, PKR 10,000 for executive suites, and PKR 20,000 (or USD 100 equivalent) for luxury villas and penthouses.
Security deposits are refunded in full upon room inspection at check-out, or pre-authorizations released within 3 to 7 business banking days if no damage or incidental room service charges remain unpaid.

## Unified Cancellation, Modification & No-Show Tiers
The platform operates a transparent 48-Hour Cancellation Guarantee across all standard non-promotional room rates:
- Tier 1 (Free Cancellation): Cancellations submitted more than 48 hours prior to the standard property check-in time (14:00 local time) receive a 100% full refund with zero cancellation penalty.
- Tier 2 (Late Cancellation): Cancellations submitted between 24 and 48 hours prior to check-in incur a cancellation penalty equal to 50% of the first night's room rate.
- Tier 3 (Immediate Window & No-Show): Cancellations submitted less than 24 hours prior to check-in or failure to arrive (No-Show) incur a 100% room rate and tax charge for the first night. Remaining scheduled nights are automatically released back to platform inventory.
- Non-Refundable Rates: Promotional discounted rates explicitly marked 'Non-Refundable' or 'Hot Deal' at the time of reservation cannot be refunded or rescheduled under any circumstances.

## Official Platform Promotional Codes & Booking Vouchers
The marketplace features platform-wide promotional discounts verified at quotation:
- Code 'SUMMER2026': Grants 15% discount on all platform reservations with a minimum stay requirement of 2 consecutive nights. Maximum platform discount cap is PKR 7,500 (or USD 30 equivalent). Valid across all 20 platform properties.
- Code 'WINTERLUXE2026': Grants 20% discount on boutique suites, mountain villas, and luxury penthouses with a minimum stay of 3 consecutive nights. Maximum platform discount cap is PKR 15,000 (or USD 60 equivalent).
- Code 'FIRSTSTAY10': Grants a flat 10% discount on the very first completed reservation for new marketplace member accounts with no minimum night requirement.
- Code 'CORPORATEVIP': Grants 12% corporate partner discount for verified business corporate email domains, including complimentary late check-out up to 14:00 subject to room availability.

## Child, Infant & Extra Bed Platform Standards
- Infants and toddlers aged 0 to 5 years stay completely free of charge when sharing existing parental bedding. Complimentary baby cots and cribs are provided upon advance request at all properties, subject to availability.
- Children aged 6 to 12 years are charged a flat supplemental fee of PKR 2,500 (or USD 15) per child per night for an extra rollaway bed, which includes complimentary daily buffet breakfast.
- Guests aged 13 and above are classified as adult guests and must be booked in suitable multi-occupancy room categories.

## Marketplace House Rules, Quiet Hours & Conduct
- Universal Quiet Hours are strictly enforced from 22:00 (10:00 PM) to 07:00 (7:00 AM) across all guest corridors, room floors, and outdoor villa decks. Loud music, parties, and noisy gatherings are prohibited.
- Non-Smoking Mandate: All indoor guest rooms, suites, and public hallways are strictly non-smoking. Tampering with or disabling optical smoke detectors carries an automatic PKR 25,000 (USD 100) deep-cleaning restoration fee. Dedicated smoking areas are provided on open garden verandas and designated balconies.
- Narcotics & Controlled Substances: The platform maintains zero tolerance for illicit narcotics, illegal drugs, and unregistered weapons. Violations trigger immediate reservation termination, forfeiture of deposit, and law enforcement notification.
- Central Lost & Found Protocol: Unclaimed personal belongings left in guest rooms are securely cataloged in the Platform Central Baggage Log for exactly 90 days. Valuables can be returned via insured courier service at guest expense.`,
  },

  // ==========================================
  // 2. MILLI DORMS (Lahore)
  // ==========================================
  {
    propertySlug: 'milli-dorms',
    title: 'Milli Dorms Co-Living Guest Manual & House Rules',
    filename: 'milli-dorms-guest-manual.txt',
    content: `# Milli Dorms Co-Living Guest Manual & House Rules

## Property Overview & Concept
Milli Dorms is a modern urban co-living community located in DHA Phase 5, Lahore, adjacent to LUMS and Commercial Broadway. Designed for university students, remote tech workers, and digital nomads, Milli Dorms offers ergonomic sleeping pods, high-speed connectivity, and communal collaboration spaces.

## Check-In, Check-Out & Front Desk Hours
- Standard Check-In Time: 14:00 (2:00 PM)
- Standard Check-Out Time: 11:00 (11:00 AM)
- Front Desk & Security Operations: 24/7 reception desk located on the Ground Floor lobby.
- Early Check-In: Guests arriving between 08:00 AM and 14:00 PM can request early check-in for a nominal hourly surcharge of PKR 400 per hour, subject to pod readiness. Check-in prior to 08:00 AM requires booking the previous night.
- Late Check-Out: Late departure up to 15:00 (3:00 PM) is available for PKR 1,000 flat fee. Departures after 15:00 incur a full day rate.

## Wi-Fi & Internet Infrastructure
- Primary SSID Network: MilliDorms_FiberHighSpeed
- Guest Wi-Fi Password: MilliPod2026!
- Internet Speed: Dedicated 300 Mbps symmetrical fiber optic pipe with backup microwave redundant link.
- Study Pod Ethernet: Cat6 hardwired RJ-45 gigabit ports are installed at every study workstation on the 2nd floor co-working lounge.

## Dining, Community Kitchen & Meal Plans
- Rooftop Nomad Cafe: Open daily from 07:30 AM to 23:30 (11:30 PM). Serving artisanal espresso, healthy breakfast bowls, grilled sandwiches, and fresh juices.
- Breakfast Timings: Daily breakfast served from 07:30 AM to 10:30 AM. Continental breakfast combo is priced at PKR 750 for resident dorm guests.
- Shared Community Kitchen: Located on Floor 1. Equipped with 4 induction stoves, Panasonic microwaves, shared refrigerators, and individual locked dry-storage bins. Guests must clean cookware immediately after use.
- Ramadan Dining: Suhoor meal boxes are prepared and served from 03:30 AM to 05:00 AM. Iftar platters are served at the rooftop cafe at Maghrib sunset prayer time.

## Quiet Hours, Pod Etiquette & Security
- Strict Quiet Hours: 23:00 (11:00 PM) to 08:00 (8:00 AM) in all sleeping pod dormitories. Headphones are mandatory for audio devices in dormitory rooms.
- Electronic RFID Smart Locks: RFID keycards grant access to individual dormitory wings and personal under-bed luggage lockers. A lost RFID keycard carries a replacement fee of PKR 500.
- Visitor Policy: Outside day visitors are permitted only in the Ground Floor Lounge and Rooftop Cafe between 09:00 AM and 21:00 (9:00 PM). Non-resident guests are never allowed inside sleeping pod quarters.

## Laundry & Fitness Amenities
- Coin Laundry: Located in the basement level with 4 LG commercial washers and 4 tumble dryers. Wash token costs PKR 300 per load; dryer token costs PKR 300. Detergent pods are available at the reception desk for PKR 100.
- Mini Calisthenics Gym: Open 24/7 on the terrace floor with pull-up bars, dumbbells up to 30kg, kettlebells, and yoga mats.

## Pet Policy
- Milli Dorms maintains a strict No-Pets Policy within all pod dormitory areas to ensure an allergy-free environment for all student and working residents. Service animals require 72-hour advance super admin clearance.`,
  },

  // ==========================================
  // 3. MILLI RESORT (Lahore)
  // ==========================================
  {
    propertySlug: 'milli-resort',
    title: 'Milli Resort Country Club & Wellness Guide',
    filename: 'milli-resort-country-club-guide.txt',
    content: `# Milli Resort Country Club & Wellness Guide

## Property Overview & Architecture
Milli Resort is an exclusive 18-acre country estate situated on Bedian Road, Lahore. Surrounded by mango orchards, landscaped gardens, and equestrian paddocks, Milli Resort caters to luxury family getaways, corporate retreats, and private celebrations.

## Check-In & Check-Out Timings
- Standard Check-In Time: 15:00 (3:00 PM)
- Standard Check-Out Time: 12:00 (12:00 PM Noon)
- Front Concierge: Open 24 hours with dedicated golf-cart buggy escorts to luxury chalets.
- Early Check-In: From 11:00 AM onwards available for PKR 3,500 surcharge, subject to chalet readiness.
- Late Check-Out: Until 16:00 (4:00 PM) available for PKR 5,000 surcharge.

## Wi-Fi Network & Communications
- Wi-Fi SSID: MilliResort_Guest5G
- Access Password: ResortLuxeLahore#26
- Coverage: Seamless mesh coverage across all private chalets, swimming pool pavilions, and central dining lawns.

## Swimming Pool & Hydrotherapy
- Main Olympic Pool: 50-meter outdoor swimming pool with water temperature heated to 28°C during winter months.
- Pool Hours: 07:00 AM to 22:00 (10:00 PM) daily.
- Separate Ladies-Only Pool Hours: 09:00 AM to 12:00 PM daily at the secluded Garden Villa Hydro-Pool.
- Water Depth: Graduated depth from 1.1 meters (shallow end) to 2.4 meters (diving end). Lifejackets for children are provided free of charge.

## Dining Venues & Culinary Schedules
- The Orchard Brasserie: Multi-cuisine fine dining restaurant featuring continental delicacies, live tandoor, and organic farm salads.
- Breakfast Buffet: Served daily from 07:00 AM to 10:30 AM (extended to 11:00 AM on Saturdays and Sundays). Complimentary for all staying resort guests.
- Private Gazebo BBQ: Live grill dinners served in personal garden gazebos from 19:30 to 23:00. Requires 4-hour advance reservation with concierge.
- Ramadan Dining: Grand Iftar Buffet with 40+ authentic dishes served at sunset on the central lawn for PKR 3,850 per person. Suhoor à la carte room service available from 03:00 AM to 04:45 AM.

## Outdoor Activities & Equestrian Stables
- Horse Riding Stables: Thoroughbred horses and Arabian mares available for guided paddock rides from 08:00 AM to 11:00 AM and 16:00 to 18:30. Riding sessions cost PKR 2,000 for 30 minutes.
- Clay Tennis Courts: 2 floodlit clay courts open from 06:30 AM to 22:00. Racquet rental is PKR 800 per hour.

## Pet Policy
- Pet-Friendly Chalets: Small to medium well-behaved dogs and cats (up to 20kg) are welcomed exclusively in Ground-Floor Garden Chalets.
- Pet Nightly Fee: PKR 3,500 per pet per night, which includes a luxury pet bed, food bowls, and cleanup bags. A refundable pet damage deposit of PKR 10,000 is authorized at arrival. Pets must be leashed in public gardens and are not permitted in pool water.

## Airport Transfers & Chauffeur
- Allama Iqbal International Airport (LHE) is 22 minutes away.
- Private Mercedes E-Class Chauffeur Transfer: PKR 7,500 one-way.
- Luxury Toyota Fortuner SUV Transfer: PKR 6,000 one-way. Booking required 12 hours in advance.`,
  },

  // ==========================================
  // 4. HOTEL 1 (Lahore)
  // ==========================================
  {
    propertySlug: 'hotel-1',
    title: 'Hotel 1 Business Suites Operations & Guest Directory',
    filename: 'hotel-1-guest-directory.txt',
    content: `# Hotel 1 Business Suites Operations & Guest Directory

## Overview & Location
Hotel 1 is a contemporary executive business hotel located in the heart of Gulberg III, Lahore, two minutes walking distance from Liberty Market and Main Boulevard. The property provides seamless business services, meeting rooms, and soundproofed accommodation for corporate travelers and international delegations.

## Schedule & Reception
- Check-In Time: 14:00 (2:00 PM)
- Check-Out Time: 12:00 (12:00 PM Noon)
- Front Desk Desk: 24/7 English and Urdu speaking concierge staff.
- Express Check-In & Check-Out: Mobile contactless check-in available through QR codes at the lobby kiosk.

## Internet & Connectivity
- Wi-Fi SSID: Hotel1_Executive
- Network Password: H1BizLiberty2026
- High-Speed Enterprise Fiber: Symmetrical 200 Mbps with enterprise VPN pass-through and secure VLAN isolation.

## Business Center & Meeting Rooms
- Boardroom Alpha: 12-person executive boardroom equipped with 75-inch 4K Samsung interactive presentation display, Logitech Rally video conferencing, and wireless HDMI casting. Rental rate: PKR 4,500 per hour.
- Co-Working Lounge: Free access for in-house guests with complimentary Nespresso coffee and color printing up to 20 pages per day.

## Dining & In-Room Service
- Liberty Bistro: All-day dining on Level 2.
- Breakfast Buffet: Served daily from 06:30 AM to 10:30 AM. Features live egg station, fresh parathas, halwa puri, fresh cut fruit, muesli, and barista coffee.
- 24/7 Room Service: Full hot meals, gourmet burgers, and club sandwiches delivered 24 hours with an average 25-minute fulfillment guarantee.

## Airport Shuttle & Valet Parking
- LHE Airport Sedan Transfer: Chauffeur-driven Toyota Corolla Grande pickup or drop-off for PKR 3,500 one-way.
- Complimentary Valet Parking: 2-level basement parking with 24-hour CCTV surveillance and security guards. Electric vehicle (EV) Type-2 22kW charging station available at PKR 80 per kWh.

## Pet Policy
- Hotel 1 is strictly a Business Pet-Free Property. No pets are allowed on premises, with exceptions granted only for certified service guide dogs with valid documentation.`,
  },

  // ==========================================
  // 5. THE GRAND HERITAGE MALL ROAD (Lahore)
  // ==========================================
  {
    propertySlug: 'grand-heritage-mall-road',
    title: 'The Grand Heritage Mall Road Colonial Hospitality & Heritage Guide',
    filename: 'grand-heritage-colonial-guide.txt',
    content: `# The Grand Heritage Mall Road Colonial Hospitality & Heritage Guide

## History & Heritage
Established in 1928 along historic Mall Road, The Grand Heritage is a landmark colonial hotel standing opposite the Lahore Museum and near the National College of Arts. Preserving high-ceilinged colonial architecture, Burmese teak staircases, and polished brass fixtures, the hotel offers quintessential old-world luxury.

## Arrival & Departure
- Check-In: 14:00 (2:00 PM)
- Check-Out: 12:00 (12:00 PM Noon)
- Valet & Doorman: 24-hour uniformed white-glove doorman and heritage luggage carriage.
- Early Check-In: Available from 09:00 AM for PKR 4,000 fee. Late Check-Out up to 16:00 is PKR 5,000.

## Wi-Fi & Modern Amenities
- Wi-Fi Network SSID: GrandHeritage_Palace
- Password: HeritageMall1928!
- High-speed dual-band Wi-Fi throughout all heritage suites, ballrooms, and courtyards.

## Dining & High Tea Tradition
- The Royal Shalimar Dining Room: Grand fine dining serving classical Mughlai, Kashmiri, and Anglo-Indian recipes. Open for lunch (12:30 - 15:30) and dinner (19:30 - 23:30).
- Mall Road Colonial High Tea: Famous three-tier silver service High Tea served daily in the Victorian Palm Court from 16:00 to 18:30. Price: PKR 2,850 plus tax per person. Includes clotted cream scones, finger sandwiches, and rare single-estate teas.
- Victorian Cigar & Reading Lounge: Gentleman's style library with rare first editions on Punjab history. Open until 01:00 AM.

## Spa, Salon & Wellness
- Heritage Hammam & Ayurvedic Spa: Open daily from 09:00 AM to 21:00. Offers herbal oil massages, steam rooms, and hot stone therapies. 60-minute Royal Signature Massage is PKR 8,500.
- Outdoor Heated Pool: Victorian-style courtyard swimming pool open 07:00 AM to 21:00. Water depth: 1.4m to 2.2m.

## Pet Policy
- Strictly No Pets Allowed due to the preservation of fragile antique hand-woven Persian carpets, Burmese teak parquet flooring, and historic upholstered furnishings.`,
  },

  // ==========================================
  // 6. SERENE OASIS BEACH & SPA (Karachi)
  // ==========================================
  {
    propertySlug: 'serene-oasis-beach-spa',
    title: 'Serene Oasis Beach & Spa Oceanfront Resort Compendium',
    filename: 'serene-oasis-oceanfront-compendium.txt',
    content: `# Serene Oasis Beach & Spa Oceanfront Resort Compendium

## Overview & Location
Perched along the scenic coastline of Clifton and Do Darya in Karachi, Serene Oasis Beach & Spa is a premier 5-star beachfront resort offering unobstructed panoramic vistas of the Arabian Sea, private white-sand beach access, and marine wellness rituals.

## Check-In & Check-Out Timings
- Check-In Time: 15:00 (3:00 PM)
- Check-Out Time: 12:00 (12:00 PM Noon)
- Front Desk: 24/7 multilingual reception with sea-view welcome lounge.
- Early Check-In: From 10:00 AM onwards incurs a PKR 4,500 fee, subject to availability.
- Late Check-Out: Until 15:00 is PKR 4,500; past 15:00 is charged as a full night rate.

## Connectivity & In-Room Tech
- Wi-Fi SSID: SereneOasis_OceanWave
- Access Password: ArabianSeaBreeze#26
- High-Speed Wi-Fi coverage across all ocean suites, beach cabanas, and sun decks.

## Thalassotherapy Spa & Pools
- Saltwater Ocean Infinity Pool: Overlooking the breaking waves of the Arabian Sea. Open daily from 06:30 AM to 22:00. Depth: 1.2m to 1.8m.
- Thalassotherapy Marine Spa: Utilizing mineral-rich sea salts and seaweed extracts. 6 treatment suites with hydro-massage jet tubs. Open 09:00 AM to 21:00 daily.
- Private Beach Cabanas: Fully serviced private sun loungers on the beach with complimentary chilled coconut water and towels.

## Dining by the Sea
- The Wavecrest Seafood Grill: Open-air ocean terrace serving the catch of the day (Karachi king prawns, red snapper, pomfret, and lobster). Dinner: 19:00 to 24:00 (midnight).
- The Azure Horizon Cafe: International breakfast buffet served daily from 06:30 AM to 10:30 AM.
- Sunset Mocktail Lounge: Non-alcoholic tropical coolers, virgin piña coladas, and tapas served from 17:00 to 20:00 during golden hour.

## Water Sports & Coastal Excursions
- Jet Skiing: Guided jet ski sessions available at PKR 4,000 for 20 minutes (weather permitting).
- Deep-Sea Fishing Charter: 4-hour morning game-fishing cruise on the resort twin-engine yacht for up to 6 guests at PKR 45,000.

## Pet Policy
- Pets Permitted in Ground Ocean Terraces: Well-behaved dogs under 15kg allowed in ground floor terrace suites. Nightly pet sanitation fee is PKR 3,000 per pet. A refundable damage deposit of PKR 8,000 is required upon check-in. Pets are not permitted in swimming pools or spa areas.`,
  },

  // ==========================================
  // 7. HUNZA SERAI MOUNTAIN GLAMPING (Hunza)
  // ==========================================
  {
    propertySlug: 'hunza-serai-mountain-glamping',
    title: 'Hunza Serai Mountain Glamping & Lodge Alpine Guest Compendium',
    filename: 'hunza-serai-alpine-compendium.txt',
    content: `# Hunza Serai Mountain Glamping & Lodge Alpine Guest Compendium

## Location & Mountain Vistas
Hunza Serai is perched at an elevation of 2,450 meters in Karimabad, Hunza Valley, Gilgit-Baltistan. Nestled in a 400-year-old terraced apricot orchard, the property features luxury heated geodesic glass domes providing 360-degree vistas of Rakaposhi (7,788m), Ultar Sar, and Ladyfinger Peak.

## Mountain Check-In & Policies
- Check-In Time: 14:00 (2:00 PM)
- Check-Out Time: 11:00 (11:00 AM)
- Front Lodge Desk: 06:00 AM to 23:00. Night emergency manager on-call 24 hours.
- Early Check-In / Late Check-Out: Complimentary within 2 hours of schedule if domes are vacant; otherwise PKR 2,500 surcharge.

## High-Altitude Wi-Fi
- Wi-Fi SSID: HunzaSerai_Starlink5G
- Password: RakaposhiPeak2026
- Internet Infrastructure: Powered by low-earth orbit Starlink high-speed satellite broadband (150+ Mbps download) ensuring reliable connectivity even during alpine weather.

## Heating, Climate Control & Geodesic Domes
- Climate Systems: Every geodesic dome features heavy-duty insulated triple-layer canvas, panoramic heated double-glazed stargazing windows, inverter heat pumps, and a traditional wood-fired cast-iron Bukhari stove.
- Firewood: Complimentary seasoned apricot wood provided daily between 17:00 and 22:00. Additional wood bundles are PKR 500.
- Electric Bed Warmers: Dual-zone electric under-blankets fitted on all king beds.

## Dining & Traditional Wakhi Cuisine
- The Apricot Blossom Restaurant: Serving traditional organic Hunza cuisine including Chapshuro (savory meat pies), Dawdo (traditional alpine soup), Gyaling with apricot oil, and fresh trout from local glacial streams.
- Breakfast: 07:00 AM to 10:00 AM daily. Includes fresh farm eggs, homemade mulberry and apricot jams, Hunza buckwheat bread, and mountain herbal tea.
- Evening Bonfire & Musical Storytelling: Nightly campfire under the stars from 20:00 to 22:00 with traditional Rubab musical performances.

## Trekking & Mountain Guiding
- Certified Mountain Guides: Guided treks to Baltit Fort, Altit Fort, Eagles Nest Duikar, and Passu Cones. Day guide hire: PKR 5,000 per group.
- High-Altitude Oxygen Kits: Portable medical-grade oxygen cylinders and pulse oximeters are available at the front desk 24 hours free of charge for acclimatization.

## Pet Policy
- Pets Allowed in Garden Cabins: Up to 2 medium dogs permitted in designated detached garden cabins for PKR 2,000 per pet per night. Dogs must be kept on leash at all times due to nearby orchard wildlife.`,
  },

  // ==========================================
  // 8. THE MARGALLA RIDGE BOUTIQUE & SPA (Islamabad)
  // ==========================================
  {
    propertySlug: 'margalla-ridge-boutique-spa',
    title: 'The Margalla Ridge Boutique & Spa Diplomatic Enclave Guide',
    filename: 'margalla-ridge-boutique-guide.txt',
    content: `# The Margalla Ridge Boutique & Spa Diplomatic Enclave Guide

## Setting & Diplomatic Standards
Located in the prestigious Sector E-7 in Islamabad at the foothills of the Margalla Hills National Park, The Margalla Ridge Boutique & Spa offers secluded diplomatic-grade luxury, private manicured pine gardens, and state-of-the-art personal security.

## Reception & Security
- Check-In: 14:00 (2:00 PM)
- Check-Out: 12:00 (12:00 PM Noon)
- Diplomatic Security: Armed perimeter security, biometric access gates, and 24/7 CCTV surveillance adhering to international embassy lodging standards.
- Early Check-In: From 09:00 AM for PKR 4,000 surcharge. Late departure until 16:00 for PKR 5,000.

## Internet & Communications
- Wi-Fi SSID: MargallaRidge_Private
- Network Password: DiplomaticHill@2026
- Encrypted High-Speed Wi-Fi: Cisco enterprise mesh network with WPA3 Enterprise encryption and fiber backup.

## Himalayan Salt Spa & Wellness
- Himalayan Pink Salt Inhalation Cave: Built with 20 tons of authentic Khewra pink salt blocks. Open 08:00 AM to 21:00. Renowned for respiratory therapy and stress reduction.
- Sauna & Steam Suites: Swedish dry pine sauna and eucalyptus steam rooms open 07:00 AM to 22:00.
- Infinity Lap Pool: Heated indoor-outdoor swimming pool with panoramic views of Margalla Trail 3. Temperature maintained at 29°C year-round.

## Culinary Excellence
- The Hilltop Bistro: Farm-to-table organic dining. Breakfast served 07:00 AM to 10:30 AM. Features fresh sourdough, cold-pressed vegetable juices, organic honey from local hives, and artisanal cheeses.
- Pine Needle Terrace: Afternoon English tea service and evening barbecues overlooking the Islamabad city lights. Open 16:00 to 23:00.

## Airport Transfers
- Islamabad International Airport (ISB) is 35 minutes away via the Srinagar Highway.
- Chauffeur-driven Audi A6 luxury transfer: PKR 6,500 one-way.
- Mercedes Vito Executive Van (seats up to 6 passengers): PKR 9,500 one-way.

## Pet Policy
- Strictly No Pets permitted on the premises to maintain sterile hypoallergenic standards required by visiting diplomatic and executive delegations.`,
  },

  // ==========================================
  // 9. SHANGRILA PINES HERITAGE VILLA (Murree)
  // ==========================================
  {
    propertySlug: 'shangrila-pines-heritage-villa',
    title: 'Shangrila Pines Heritage Villa Pine Forest Guest Manual',
    filename: 'shangrila-pines-guest-manual.txt',
    content: `# Shangrila Pines Heritage Villa Pine Forest Guest Manual

## History & Alpine Setting
Built in 1894 in the misty pine forests of Bhurban near Murree, Shangrila Pines is a historic British colonial hill-station manor. Overlooking the snow-capped peaks of Kashmir, the villa combines Victorian stonework, cedarwood gables, and open fireplaces.

## Schedules & Reception
- Check-In Time: 15:00 (3:00 PM)
- Check-Out Time: 11:30 (11:30 AM)
- Front Desk & Butler Desk: 24/7 dedicated villa manager and hearth attendants.
- Early Check-In: From 10:00 AM available for PKR 3,000 surcharge. Late Check-Out up to 15:00 for PKR 3,500.

## Wi-Fi & Entertainment
- Wi-Fi SSID: ShangrilaPines_Guest
- Password: MistyMurreePines#26
- Internet: High-speed microwave link with 100 Mbps bandwidth and smart televisions equipped with Netflix and Prime Video in all master suites.

## Cozy Hearth & Fireplace Service
- Stone Fireplaces: Each suite and living salon features an authentic working stone fireplace.
- Pine Log Service: Fireplace lighting service is complimentary every evening from 17:00 to 23:00. Attendants deliver fragrant Himalayan pine wood logs. Additional midnight log baskets are PKR 600.

## Dining & Afternoon Cream Tea
- The Veranda Dining Room: Glass-enclosed veranda dining room overlooking the pine valley.
- Breakfast Buffet: Served daily from 07:30 AM to 10:30 AM. Features Kashmiri chai (pink tea with pistachios and almonds), freshly baked bakarkhani, scrambled country eggs, and pancakes.
- British Cream Tea: Freshly baked buttermilk scones served with homemade strawberry preserve and clotted cream every afternoon from 15:30 to 18:00 for PKR 1,850 per person.

## Jacuzzi & Wellness
- Heated Pine Cedar Hot Tub: Outdoor cedar-wood Jacuzzi hot tub on the cliff edge. Water temperature maintained at 38°C. Open 09:00 AM to 22:00. Requires 1-hour advance heating notice.

## Pet Policy
- Pet-Friendly Villa: Dogs under 20kg are allowed in the ground floor garden suites. Pet fee is PKR 2,500 per night. Refundable damage deposit of PKR 5,000 collected at check-in. Pets must remain leashed in public gardens.`,
  },

  // ==========================================
  // 10. SKARDU CELESTIAL STARGRAZING RESORT (Skardu)
  // ==========================================
  {
    propertySlug: 'skardu-celestial-stargazing-resort',
    title: 'Skardu Celestial Stargazing Resort Astronomical Expedition Manual',
    filename: 'skardu-celestial-expedition-manual.txt',
    content: `# Skardu Celestial Stargazing Resort Astronomical Expedition Manual

## Cosmic Desert Location
Located in the Sarfaranga Cold Desert in Skardu, Gilgit-Baltistan, at an altitude of 2,230 meters, Skardu Celestial Stargazing Resort is an astronomical luxury sanctuary. Nestled between towering sand dunes and snow-capped Karakoram peaks, the property enjoys zero light pollution, offering breathtaking views of the Milky Way galaxy.

## Check-In & Acclimatization
- Check-In Time: 14:00 (2:00 PM)
- Check-Out Time: 11:00 (11:00 AM)
- Reception: Open 24/7 with welcome cups of hot sea-buckthorn herbal tea.
- High-Altitude Support: Complementary pulse oximeter monitoring and medical oxygen concentrators available in every luxury pod.

## Satellite Communications
- Wi-Fi SSID: CelestialSkardu_SatNet
- Wi-Fi Password: MilkyWayStargazer26!
- Starlink satellite internet providing steady 120 Mbps connection across all observation decks and desert domes.

## Astronomical Observatory & Telescope Domes
- The Galileo Observatory Dome: Features a 14-inch Meade LX200 computerized Cassegrain telescope and high-resolution planetary astrophotography cameras.
- Nightly Stargazing Sessions: Guided by resident astrophysicists every clear night from 21:00 to 23:30. Guests observe Saturn's rings, Jupiter's moons, nebulae, and constellations free of charge.
- Stargazing Glass Pods: Private geodesic domes feature motorized motorized blackout curtains and glass ceilings over the master beds.

## Dining Under the Stars
- Nebula Restaurant: Heated indoor glass restaurant serving Balti delicacies including Marzan with apricot oil, slow-roasted yak meat stew, freshly caught Indus River trout, and warm walnut bread.
- Breakfast: 07:00 AM to 10:00 AM.
- Midnight Astronomy Hot Cocoa & Mulled Spices: Served on the observatory deck during night telescope tours.

## Desert Excursions & Safaris
- 4x4 Dune Bashing & Sandboarding: Daily guided Sarfaranga sand dune excursions in modified Toyota Land Cruisers at PKR 6,500 per vehicle per hour.
- Upper Kachura Lake & Shangrila Excursions: 4-hour scenic tour at PKR 9,000 per vehicle.

## Pet Policy
- Due to extreme desert temperatures, surrounding rocky terrain, and specialized astronomical equipment, pets are strictly prohibited at Skardu Celestial.`,
  },

  // ==========================================
  // 11. GWADAR PEARL OCEANFRONT RESORT (Gwadar)
  // ==========================================
  {
    propertySlug: 'gwadar-pearl-oceanfront-resort',
    title: 'Gwadar Pearl Oceanfront Resort Arabian Sea Compendium',
    filename: 'gwadar-pearl-compendium.txt',
    content: `# Gwadar Pearl Oceanfront Resort Arabian Sea Compendium

## Coastal Cliff Setting
Gwadar Pearl Oceanfront Resort is situated atop the dramatic Koh-e-Batil cliff peninsula overlooking the deep turquoise waters of the Arabian Sea and the Gwadar port harbor. The resort blends contemporary maritime architecture with authentic Balochi coastal hospitality.

## Timings & Front Desk
- Check-In Time: 15:00 (3:00 PM)
- Check-Out Time: 12:00 (12:00 PM Noon)
- Concierge: 24-hour reception, maritime excursion desk, and private airport shuttle.
- Early Check-In: From 10:00 AM for PKR 3,500. Late Check-Out until 16:00 for PKR 4,000.

## Connectivity & Wi-Fi
- Wi-Fi SSID: GwadarPearl_SpeedNet
- Password: PearlOceanBreeze2026
- Redundant optical fiber and microwave connection with 150 Mbps bandwidth throughout all suites and outdoor terraces.

## Cliffside Infinity Pool & Wellness
- Marine Infinity Pool: Perched 60 meters above sea level on the edge of Koh-e-Batil cliff, providing sweeping 270-degree ocean views.
- Pool Hours: 06:30 AM to 21:30 daily. Water depth: 1.2m to 2.0m.
- Ocean Breeze Fitness Center: Modern gym equipped with LifeFitness treadmills and weights overlooking the sea. Open 24 hours.

## Dining & Balochi Seafood
- The Lighthouse Seafood Terrace: Serving the freshest Arabian Sea catch including jumbo tiger prawns, grilled lobster, crab, and king mackerel. Open for dinner from 19:00 to 23:30.
- Balochi Sajji Night: Authentic slow-cooked whole lamb and chicken Sajji prepared around open olive wood embers every Friday and Saturday evening from 20:00.
- Sunrise Breakfast Buffet: 06:30 AM to 10:30 AM daily at The Coral Pavilion.

## Coastal Excursions & Boating
- Hammerhead Peninsula Boat Tours: 2-hour dolphin watching and sea-cliff cruise departs daily from Gwadar harbor at 08:30 AM for PKR 5,000 per person.
- Snorkeling at Astola Island: Full-day boat expedition to Astola Island (Island of the Seven Hills) with certified dive masters. Inquire 48 hours in advance; PKR 35,000 for private charter.

## Pet Policy
- No Pets Allowed within guest rooms or public resort grounds.`,
  },

  // ==========================================
  // 12. GULBERG EXECUTIVE LUXURY APARTMENTS (Lahore)
  // ==========================================
  {
    propertySlug: 'gulberg-executive-luxury-apartments',
    title: 'Gulberg Executive Luxury Apartments Resident Handbook',
    filename: 'gulberg-executive-resident-handbook.txt',
    content: `# Gulberg Executive Luxury Apartments Resident Handbook

## Urban Location & Amenities
Gulberg Executive Luxury Apartments is a high-rise serviced residential tower located just off MM Alam Road in Gulberg II, Lahore. Walking distance from premier fashion boutiques, fine dining restaurants, and financial corporate headquarters, the apartments offer self-contained luxury for long-term and executive short-stay guests.

## Check-In & Smart Lock Access
- Check-In Time: 14:00 (2:00 PM)
- Check-Out Time: 12:00 (12:00 PM Noon)
- Front Desk & Keyless Entry: 24/7 lobby concierge. Every apartment is equipped with an August Smart Touchscreen Deadbolt. PIN codes are sent to guest smartphones 2 hours prior to arrival.
- Early Check-In / Late Check-Out: Flat rate PKR 3,000 for up to 3 hours prior to check-in or post check-out.

## High-Speed Gigabit Fiber
- Wi-Fi SSID: GulbergSuites_Fiber1Gb
- Wi-Fi Password: MMAlamLuxury@2026
- Speed: Symmetrical 1 Gigabit (1000 Mbps) ultra-high-speed fiber network with private dedicated router in each apartment unit.

## Kitchen & In-Unit Appliances
- Fully Equipped Italian Chef Kitchen: Equipped with Bosch electric induction cooktop, built-in convection oven, microwave, LG inverter refrigerator, toaster, electric kettle, and complete dinnerware set for 6 guests.
- Laundry: In-unit Bosch 9kg washer and dryer with complimentary laundry detergent pods provided on arrival.

## Rooftop Pool & Gym
- Rooftop Skyline Infinity Pool: Located on Floor 18. Open daily from 07:00 AM to 22:00. Offers views over Lahore's skyline and Gaddafi Stadium.
- State-of-the-Art Health Club: Commercial TechnoGym equipment, squat rack, free weights, and sauna rooms. Open 24/7.

## Housekeeping & Trash Collection
- Servicing: Daily complimentary light housekeeping and garbage disposal. Complete linen and towel change occurs every 3rd day of stay.
- Refuse Chute: Trash chutes located on every residential floor near the service elevator.

## Pet Policy
- Cats and small toy dogs (under 10kg) are permitted with a one-time cleaning fee of PKR 5,000 per stay and a refundable security deposit of PKR 10,000. Maximum 1 pet per apartment.`,
  },

  // ==========================================
  // 13. QISSA KHWANI HERITAGE HAVELI (Peshawar)
  // ==========================================
  {
    propertySlug: 'qissa-khwani-heritage-haveli',
    title: 'Qissa Khwani Heritage Haveli Cultural Resident Handbook',
    filename: 'qissa-khwani-resident-handbook.txt',
    content: `# Qissa Khwani Heritage Haveli Cultural Resident Handbook

## Architectural Heritage
Dating back over two centuries, Qissa Khwani Heritage Haveli is an authentically restored multi-story merchant haveli located in the heart of Peshawar's ancient Bazaar of the Storytellers (Qissa Khwani Bazaar). Featuring intricate Jharoka balconies, hand-carved deodar wooden doors, and an open central courtyard, the property immerses travelers in Silk Road history.

## Reception & Arrival
- Check-In: 14:00 (2:00 PM)
- Check-Out: 11:30 (11:30 AM)
- Arrival Assistance: Due to historic pedestrian bazaar alleys, the Haveli provides private electric luggage carts from the designated parking area at Gor Ghatree.
- 24-Hour Hospitality Desk: Receptionist and local Pashtun cultural storytellers available round the clock.

## Wi-Fi & Modern Comforts
- Wi-Fi SSID: QissaKhwani_Guest
- Password: PeshawarStoryHaveli26
- Mesh Wi-Fi network throughout all historic suites, rooftop tea terrace, and inner courtyard.

## Authentic Pashtun Dining & Tea Culture
- The Storytellers Courtyard: Open-air dining in the central marble courtyard.
- Signature Dishes: Authentic Shinwari lamb karahi cooked in natural animal fat, tender Chapli kebabs pan-fried in bone marrow oil, Kabuli pulao, and freshly baked Tandoori naan.
- Peshawar Green Tea (Kahwa): Complimentary cardamom and saffron Kahwa served continuously from the brass samovar in the courtyard lounge from 07:00 AM to midnight.
- Traditional Breakfast: 07:00 AM to 10:30 AM. Fresh cream (Peshawar Malai), warm tandoori roti, organic honeycomb, and scrambled eggs with fried tomatoes.

## Guided Old City Walking Tours
- Complimentary Morning Heritage Walk: Guided 90-minute walking tour through Qissa Khwani Bazaar, Cunningham Clock Tower, and Sethi Haveli complex every morning at 09:30 AM for all resident guests.

## Pet Policy
- Strictly No Pets Allowed due to the sensitive historical conservation of antique carved woodwork, delicate lime plaster frescoes, and vintage floor rugs.`,
  },

  // ==========================================
  // 14. BURJ VISTA SKY PENTHOUSE & RESIDENCES (Dubai)
  // ==========================================
  {
    propertySlug: 'burj-vista-sky-penthouse',
    title: 'Burj Vista Sky Penthouse & Residences Ultra-Luxury Manual',
    filename: 'burj-vista-luxury-manual.txt',
    content: `# Burj Vista Sky Penthouse & Residences Ultra-Luxury Manual

## Overview & Iconic Views
Towering 64 floors above Downtown Dubai, Burj Vista Sky Penthouse is an ultra-exclusive multi-level residence offering floor-to-ceiling glass panoramic views of the Burj Khalifa, the Dubai Opera, and the dancing Dubai Fountains.

## VIP Arrival & Butler Service
- Check-In Time: 15:00 (3:00 PM)
- Check-Out Time: 12:00 (12:00 PM Noon)
- Dedicated 24/7 Butler: A private certified British Butler Guild butler is assigned exclusively to the Penthouse to oversee luggage unpacking, garment steaming, dining reservations, and cocktail service.
- Private Direct-Access Elevator: Penthouse keycard unlocks a private high-speed elevator opening directly into the penthouse foyer.
- Early Check-In / Late Check-Out: AED 1,000 per extension subject to availability.

## High-Tech Infrastructure
- Wi-Fi SSID: BurjVista_SkyHigh64
- Password: DubaiBurjPenthouse#2026
- 10-Gigabit optical fiber backbone with Crestron smart-home automation controlling Lutron motorized shades, ambient lighting scenes, and multi-room Bang & Olufsen audio.

## Private Sky Plunge Pool & Terrace
- Private Infinity Plunge Pool: Located on the 64th floor open-air sky terrace with temperature control and hydro-jets. Water temperature set to 30°C.
- Dubai Fountain Views: Directly overlooks the fountain water shows which occur every 30 minutes from 18:00 to 23:00.

## Private Dining & Michelin-Star Catering
- Chef's Kitchen: Equipped with Gaggenau appliances, Sub-Zero wine refrigerators, and an eight-seat marble breakfast bar.
- In-Residence Private Chef: Private fine dining five-course dinner prepared by an executive chef in the residence starting at AED 1,200 per person. Inquire 24 hours in advance.
- Continental Sky Breakfast: Delivered daily by your butler between 07:00 AM and 11:00 AM.

## Luxury Chauffeur & Airport Fleet
- Dubai International Airport (DXB) is 15 minutes away.
- Chauffeur-driven Rolls-Royce Phantom VIII: AED 1,200 one-way transfer.
- Mercedes-Maybach S-Class: AED 800 one-way transfer. Booking required 6 hours in advance.

## Pet Policy
- Small designer dogs up to 8kg are permitted in the residence. Nightly pet hospitality fee of AED 350 includes a plush pet bed and custom dog treats. Refundable security deposit: AED 2,500.`,
  },

  // ==========================================
  // 15. AL ULA DESERT ROSE CANYON OASIS (Al Ula)
  // ==========================================
  {
    propertySlug: 'al-ula-desert-rose-canyon-oasis',
    title: 'Al Ula Desert Rose Canyon Oasis Sandstone Sanctuary Compendium',
    filename: 'al-ula-sanctuary-compendium.txt',
    content: `# Al Ula Desert Rose Canyon Oasis Sandstone Sanctuary Compendium

## Desert Setting & Heritage
Carved into the monumental ochre sandstone canyons of the Ashar Valley in Al Ula, Saudi Arabia, Desert Rose Canyon Oasis is a sanctuary of tranquility. Located minutes from the UNESCO World Heritage Site of Hegra (Madain Salih) and the Maraya concert hall, the property blends sustainable desert architecture with ancient Nabataean majesty.

## Check-In & Desert Concierge
- Check-In Time: 16:00 (4:00 PM)
- Check-Out Time: 12:00 (12:00 PM Noon)
- Welcome Ceremony: Guests are greeted with iced date nectar, Saudi cardamom coffee (Gahwa), and fresh organic Sukari dates.
- Early Check-In: From 11:00 AM for SAR 500 surcharge. Late Check-Out until 15:00 for SAR 600.

## Satellite High-Speed Connectivity
- Wi-Fi SSID: DesertRose_AlUla5G
- Password: AsharValleyRose2026!
- Dedicated high-speed satellite Wi-Fi across all desert villas, plunge pools, and stargazing platforms.

## Private Canyon Plunge Pools & Stargazing
- Private Temperature-Regulated Pools: Each sandstone villa features an enclosed private outdoor plunge pool nestled against natural rock formations.
- Bedouin Stargazing Daybed: Rooftop terraces feature oversized daybeds with telescopes for night observation of pristine desert skies.

## Culinary Journey
- The Sandstone Fire Pit Restaurant: Fine dining under the stars. Specializing in slow-roasted Kabsa, tender camel meat cuts, spiced lamb shanks, and citrus-infused salads with local Al Ula citrus fruits.
- Desert Sunrise Breakfast: Served from 06:30 AM to 10:30 AM. Features shakshuka, fresh za'atar flatbreads, goat labneh, and fresh orange juice from local groves.

## Hegra Excursions & Vintage Land Rover Tours
- Private Hegra Guided Tour: Accompanied by official Rawi cultural storytellers in vintage open-top 1980s Land Rovers. 3-hour private expedition: SAR 1,200 for up to 4 guests.
- Elephant Rock (Jabal AlFil) Sunset Experience: Complimentary buggy shuttle departing daily at 17:00.

## Pet Policy
- Due to extreme desert heat, sensitive native desert wildlife (Arabian leopards and oryx), and open rock ledges, pets are strictly not permitted.`,
  },

  // ==========================================
  // 16. BOSPHORUS WATERFRONT OTTOMAN PALACE (Istanbul)
  // ==========================================
  {
    propertySlug: 'bosphorus-waterfront-ottoman-palace',
    title: 'Bosphorus Waterfront Ottoman Palace Imperial Guest Compendium',
    filename: 'bosphorus-palace-compendium.txt',
    content: `# Bosphorus Waterfront Ottoman Palace Imperial Guest Compendium

## Palace Heritage & Setting
Dating back to the late 19th century in Istanbul's Çırağan district, Bosphorus Waterfront Ottoman Palace was once an imperial residence for Ottoman dignitaries. Standing directly on the edge of the Bosphorus Strait, where Europe gazes upon Asia, the palace features original marble quays, gilded ceilings, and crystal chandeliers.

## Arrival & Maritime Private Dock
- Check-In: 15:00 (3:00 PM)
- Check-Out: 12:00 (12:00 PM Noon)
- Imperial Water Taxi Arrival: Guests can arrive directly by water via the palace private yacht pier from Istanbul Airport or Galataport.
- Concierge: 24/7 multilingual palace concierge speaking Turkish, English, Arabic, and French.

## Palace Wi-Fi & Technology
- Wi-Fi SSID: BosphorusPalace_Guest
- Password: OttomanSultanBosphorus#26
- Ultra-fast fiber optic coverage across all palace suites, waterfront marble terraces, and spa gardens.

## Imperial Turkish Hammam & Spa
- Historic Marmara Marble Hammam: Authentic heated marble navel stone (göbek taşı), private scrub and foam chambers, and cedar-wood saunas. Open 08:00 AM to 22:00. Traditional 50-minute Sultan Scrub & Foam Massage: €120.
- Heated Bosphorus Waterfront Pool: Outdoor infinity pool heated to 29°C where guests can swim right at the water's edge watching passing ships.

## Ottoman Royal Dining
- The Sultan's Terrace: Fine dining directly over the Bosphorus waters. Serving classical imperial palace recipes: slow-braised lamb shank with eggplant begendi, stuffed artichokes, and saffron seafood pilaf.
- The Grand Turkish Breakfast: World-renowned Turkish breakfast spread with 25+ varieties of regional cheeses, honey on the comb, clotted kaymak, menemen, freshly baked simit, and endless tulip glasses of Turkish tea. Served daily 07:00 to 11:00 AM.

## Private Yacht Charters
- Palace Luxury Motor Yacht: 75-foot motor yacht available for private 2-hour sunset cruises along the Bosphorus to the Black Sea: €450 including champagne and canapés.

## Pet Policy
- Small dogs and cats under 10kg are welcomed in designated garden terrace suites with an imperial pet bed and porcelain bowls. Nightly fee: €40. Refundable damage deposit: €200.`,
  },

  // ==========================================
  // 17. MAYFAIR ROYAL GEORGIAN RESIDENCE (London)
  // ==========================================
  {
    propertySlug: 'mayfair-royal-georgian-residence',
    title: 'Mayfair Royal Georgian Residence Mayfair Butler Handbook',
    filename: 'mayfair-royal-butler-handbook.txt',
    content: `# Mayfair Royal Georgian Residence Mayfair Butler Handbook

## Heritage Location
Situated in the heart of Mayfair off Berkeley Square, London W1J, Mayfair Royal Georgian Residence is a Grade-II listed 18th-century townhouse. Minutes from Mount Street boutiques, Bond Street art galleries, and Hyde Park, the residence offers discreet British luxury and quintessential townhouse living.

## Check-In & Townhouse Staff
- Check-In Time: 15:00 (3:00 PM)
- Check-Out Time: 11:00 (11:00 AM)
- Private Footman & Butler: Personal butler service included with all master townhouse suites. Garment pressing upon arrival is complimentary for up to 3 items per guest.
- Early Check-In: From 10:00 AM for £120 fee. Late Check-Out until 16:00 for £150 fee.

## Wi-Fi & Entertainment
- Wi-Fi SSID: MayfairRoyal_Private
- Network Password: GeorgianMayfair2026£
- Dedicated high-speed 500 Mbps symmetrical broadband with Apple AirPlay and Bang & Olufsen sound systems in all rooms.

## Mayfair Afternoon Tea Salon
- The Green Drawing Room: Traditional Afternoon Tea served daily between 14:30 and 17:30. Curated by a master tea sommelier featuring rare Fortnum & Mason loose-leaf teas, warm Cornish scones, strawberry preserve, clotted cream, and smoked Scottish salmon finger sandwiches. Price: £65 per person (or £85 with a glass of Laurent-Perrier Champagne).
- The Georgian Library: Featuring rare leather-bound volumes, single-malt scotch selections, and an open gas-log fireplace. Open until 01:00 AM for resident guests.

## In-Suite Michelin Dining
- Partnered with Michelin-starred neighborhood restaurants to deliver room-service dining served courses-at-a-time on bespoke Wedgwood china.

## Chauffeur & London Transit
- Heathrow Airport (LHR) Chauffeur: Bentley Flying Spur private airport transfer: £180 one-way.
- Mayfair House Car: Complimentary 15-minute radius chauffeur drop-offs in the house Jaguar I-PACE (available Monday through Friday, 09:00 to 18:00, subject to queue).

## Pet Policy
- Dog-Friendly Residence: Dogs of all sizes are pampered with a Barbour quilted dog bed, organic artisan treats, and dog-walking service in nearby Green Park. Pet charge: £50 per stay. Refundable security deposit: £250.`,
  },

  // ==========================================
  // 18. LE MARAIS HAUSSMANN LUXURY LOFT (Paris)
  // ==========================================
  {
    propertySlug: 'le-marais-haussmann-luxury-loft',
    title: 'Le Marais Haussmann Luxury Loft Parisian Resident Guide',
    filename: 'le-marais-resident-guide.txt',
    content: `# Le Marais Haussmann Luxury Loft Parisian Resident Guide

## Parisian Setting & Architecture
Located on Rue des Francs-Bourgeois in the fashionable 4th arrondissement of Paris, Le Marais Haussmann Luxury Loft occupies an authentic 19th-century Haussmannian building. Featuring herringbone oak parquet floors, original carved marble fireplaces, 3.5-meter ceilings, and wrought-iron balconies overlooking the cobblestone courtyards, the loft delivers quintessential Parisian elegance.

## Reception & Concierge
- Check-In Time: 15:00 (3:00 PM)
- Check-Out Time: 11:00 (11:00 AM)
- Private Welcome: In-person check-in by our resident concierge who presents the keys, neighborhood guide, and cellar key.
- Early Check-In / Late Check-Out: €100 for up to 3 hours buffer, subject to preceding guest departure.

## High-Speed Fiber Internet
- Wi-Fi SSID: MaraisLoft_FibrePro
- Password: ParisHaussmannLoft@26
- Ultra-high-speed 1 Gbps fiber optic internet with wireless Devialet Phantom speakers and smart Samsung The Frame art televisions.

## French Culinary Amenities & Sommelier Cellar
- Daily Boulangerie Delivery: Complimentary fresh butter croissants, pain au chocolat, and warm baguettes from the neighborhood artisanal bakery delivered to your door every morning at 08:00 AM.
- Private Wine Cellar: The loft includes a private EuroCave wine cellar stocked with curated Grand Cru Bordeaux, Burgundy, and Champagne. A sommelier price list is provided; bottles consumed are billed at departure.
- Gourmet Lacanche Kitchen: Equipped with French culinary cookware, Nespresso Vertuo coffee machine, and Le Creuset cast-iron cocottes.

## Housekeeping & Cleaning
- Daily hotel-style turn-down and tidy-up service between 10:00 AM and 13:00. Complete bed linen refresh every third day.

## Pet Policy
- Small dogs (under 10kg) are permitted with prior notification. Nightly fee: €35. Refundable security deposit: €300. Guests are requested to ensure pets do not run across historic waxed parquet flooring with untrimmed nails.`,
  },

  // ==========================================
  // 19. TRIBECA CAST-IRON DESIGNER PENTHOUSE (New York)
  // ==========================================
  {
    propertySlug: 'tribeca-cast-iron-designer-penthouse',
    title: 'Tribeca Cast-Iron Designer Penthouse Manhattan Handbook',
    filename: 'tribeca-designer-penthouse-handbook.txt',
    content: `# Tribeca Cast-Iron Designer Penthouse Manhattan Handbook

## Historic TriBeCa Architecture
Occupying the top two floors of an iconic 1890s cast-iron architectural building on Franklin Street in TriBeCa, New York City, this designer penthouse spans 4,200 square feet. Featuring exposed brick walls, original heavy pine timber beams, 14-foot ceilings, and a 1,200 square foot private landscaped rooftop terrace, the property exemplifies downtown Manhattan luxury.

## Arrival & Access Control
- Check-In Time: 16:00 (4:00 PM)
- Check-Out Time: 11:00 (11:00 AM)
- Keyed Elevator: Keyed elevator opens directly into the penthouse's private gallery foyer. Biometric fingerprint and secure digital keycode entry.
- 24/7 Virtual Concierge: Doorman service on ground floor from 08:00 to 22:00. 24/7 dedicated lifestyle concierge via text or phone.
- Early Check-In / Late Check-Out: $200 per hour buffer subject to availability.

## Gigabit Connectivity & Audio
- Wi-Fi SSID: TribecaLoft_Gigabit
- Password: NYCFranklinLoft#2026
- Symmetrical 1 Gigabit enterprise Wi-Fi 6 with Sonos architectural speakers integrated across all living zones and outdoor roof garden.

## Private Landscaped Roof Garden
- Rooftop Amenities: Features an outdoor Viking gas grill, teak dining table for 10, stainless steel outdoor fire pit, and private cedar hot tub with views of the Freedom Tower and downtown Manhattan skyline.
- Rooftop Quiet Hours: City noise ordinances strictly enforced after 22:00 (10:00 PM) on the outdoor terrace.

## Professional Chef Kitchen & Gym
- Kitchen: Commercial 6-burner Wolf gas range, dual Sub-Zero refrigerators, Miele double ovens, and dual dishwashers.
- Private Fitness Studio: Equipped with Peloton Bike+, MIRROR interactive fitness screen, Bowflex adjustable dumbbells, and TRX suspension trainer.

## Pet Policy
- Dogs and cats of all breeds are warmly welcome. A one-time deep cleaning fee of $150 per stay is applied. Refundable security deposit: $1,000. Tribeca dog walking services can be arranged via the concierge.`,
  },

  // ==========================================
  // 20. UBUD SACRED VALLEY RAINFOREST VILLA (Bali)
  // ==========================================
  {
    propertySlug: 'ubud-sacred-valley-rainforest-villa',
    title: 'Ubud Sacred Valley Rainforest Villa Balinese Sanctuary Compendium',
    filename: 'ubud-sacred-valley-compendium.txt',
    content: `# Ubud Sacred Valley Rainforest Villa Balinese Sanctuary Compendium

## Natural Rainforest Sanctuary
Immersed in the lush jungle canopy of Ubud, Bali, overlooking the sacred Ayung River and cascading emerald rice terraces, Ubud Sacred Valley Rainforest Villa is a peaceful haven of sustainable luxury. Built with hand-carved teak, bamboo architecture, and volcanic river stone, the villa invites deep wellness and natural rejuvenation.

## Arrival & Balinese Welcome
- Check-In Time: 14:00 (2:00 PM)
- Check-Out Time: 12:00 (12:00 PM Noon)
- Traditional Welcome: Guests are welcomed with fragrant frangipani flower garlands, cold lemongrass towels, and fresh young coconut water.
- Concierge: 24-hour villa butler service and spiritual excursion desk.

## Wi-Fi & Sustainable Amenities
- Wi-Fi SSID: UbudSacredValley_Mesh
- Password: AyungRainforestZen2026
- High-speed fiber optic mesh network providing 100 Mbps coverage throughout the open-air living pavilions and yoga decks.

## Private Infinity Pool & Floating Breakfast
- Natural Stone Infinity Pool: Overhanging the jungle ravine with views of tropical wildlife, kingfishers, and giant bamboo groves.
- Iconic Balinese Floating Breakfast: Enjoy fresh tropical fruits, dragon fruit smoothie bowls, poached eggs, and fresh croissants served on a floating woven tray in your private pool. Served from 07:30 to 10:30 AM (order 12 hours prior).

## Holistic Wellness & Yoga
- Complimentary Morning Yoga: Daily sunrise Vinyasa yoga class held on the open-air bamboo yoga shala at 07:30 AM led by resident Balinese yoga masters.
- Riverside Ayurvedic Spa: Open daily from 09:00 AM to 20:00. Signature 90-minute Balinese Boreh Spice Warm Scrub & Deep Tissue Massage: IDR 650,000.

## Cultural & Nature Excursions
- Guided Campuhan Ridge Walk & Rice Terrace Trek: Daily at 06:30 AM complimentary for guests.
- Holy Water Purification Ceremony: Private guided excursion to Tirta Empul sacred water temple with temple sarongs and offerings: IDR 500,000 per person.

## Pet Policy
- Strictly No Pets Allowed to protect native rainforest fauna, wild long-tailed macaques, and maintain spiritual sanctuary sanctity.`,
  },

  // ==========================================
  // 21. SHINJUKU ZEN MODERN RYOKAN & ONSEN (Tokyo)
  // ==========================================
  {
    propertySlug: 'shinjuku-zen-modern-ryokan',
    title: 'Shinjuku Zen Modern Ryokan & Onsen Traditional Japanese Guest Manual',
    filename: 'shinjuku-zen-ryokan-manual.txt',
    content: `# Shinjuku Zen Modern Ryokan & Onsen Traditional Japanese Guest Manual

## Philosophy & Architecture
Located in a tranquil bamboo-lined residential enclave of Shinjuku, Tokyo, Shinjuku Zen blends centuries-old Japanese Ryokan traditions with minimalist modern architecture. Featuring fragrant tatami reed flooring, shoji sliding paper screens, Japanese cedarwood, and authentic geothermal hot spring onsen baths, the property offers serene omotenashi hospitality.

## Ryokan Check-In & Etiquette
- Check-In Time: 15:00 (3:00 PM)
- Check-Out Time: 10:30 (10:30 AM)
- Traditional Welcome: Guests remove outdoor shoes at the genkan entrance where indoor slippers and traditional cotton yukata robes are provided.
- Shoe-Free Policy: Walking with outdoor shoes or slippers on natural straw tatami mats is strictly prohibited; only bare feet or socks are permitted on tatami.

## Modern Wi-Fi & Technology
- Wi-Fi SSID: ShinjukuZen_Ryokan
- Password: TokyoHinokiOnsen2026!
- Gigabit fiber optic Wi-Fi throughout all ryokan suites, tea rooms, and onsen relaxation gardens.

## Natural Geothermal Onsen & Hinoki Baths
- Natural Hot Spring (Onsen): Geothermal mineral water transported directly from Hakone hot springs, rich in natural minerals beneficial for skin health and fatigue recovery.
- Public Onsen Hours: 06:00 to 10:00 AM and 15:00 to 01:00 AM daily. Gender-separated baths. Guests must wash thoroughly with soap at the seated wash stations before entering the bath waters. Swimwear is not permitted in the onsen. Tattoos must be covered with provided skin patches.
- Private Hinoki Wood Bath: Each suite features an aromatic private Japanese cypress (hinoki) soaking tub filled with fresh hot onsen water.

## Traditional Kaiseki Dining
- Multi-Course Kaiseki Dinner: Served in-room by your personal nakai-san attendant at 18:30 or 19:30. Features 9 seasonal courses showcasing A5 Wagyu beef, Tsukiji Market sashimi, seasonal vegetables, and matcha desserts. Dinner reservation must be made at least 24 hours prior.
- Japanese Traditional Breakfast: Served from 07:00 AM to 09:30 AM. Includes grilled salmon, dashi-rolled tamagoyaki omelet, seasonal pickled vegetables (tsukemono), steamed Koshihikari rice, and fresh clam miso soup.

## Pet Policy
- Strictly No Pets Permitted to safeguard delicate hand-woven natural straw tatami mats, fine shoji paper partitions, and fragrant hinoki woodwork.`,
  },
];

async function seedComprehensiveKnowledge() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB successfully.\n');

  // 1. Locate Super Admin
  const superAdmin = await User.findOne({ role: 'SUPER_ADMIN' }).lean();
  if (!superAdmin) {
    throw new Error('Super Admin user not found! Please ensure database is seeded with superadmin.');
  }
  console.log(`Super Admin found: ${superAdmin.email} (ID: ${superAdmin._id})\n`);

  // 2. Fetch all properties to map by slug
  const allProperties = await Property.find({}).lean();
  const propertyBySlug = new Map<string, any>();
  for (const p of allProperties) {
    propertyBySlug.set(p.slug, p);
  }
  console.log(`Loaded ${allProperties.length} properties from database.\n`);

  // 3. Process each seed
  let successCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < KNOWLEDGE_SEEDS.length; i++) {
    const seed = KNOWLEDGE_SEEDS[i];
    console.log(`------------------------------------------------------------------`);
    console.log(`[${i + 1}/${KNOWLEDGE_SEEDS.length}] Processing: "${seed.title}"`);

    let targetProperty: any = null;
    let hotelAccountId: Types.ObjectId | null = null;
    let propertyId: Types.ObjectId | null = null;

    if (seed.propertySlug) {
      targetProperty = propertyBySlug.get(seed.propertySlug);
      if (!targetProperty) {
        console.warn(`WARNING: Property with slug "${seed.propertySlug}" not found! Skipping.`);
        skippedCount++;
        continue;
      }
      propertyId = targetProperty._id;
      hotelAccountId = targetProperty.hotelAccountId || null;
      console.log(`Target: Property "${targetProperty.name}" (${targetProperty.slug})`);
    } else {
      console.log(`Target: PLATFORM-WIDE SUPER ADMIN GLOBAL MASTER`);
    }

    // Check if an existing document with this exact title already exists for this scope
    const existing = await KnowledgeDocument.findOne({
      title: seed.title,
      propertyId: propertyId || null,
    });

    if (existing) {
      console.log(`Existing document found (ID: ${existing._id}, Status: ${existing.status}). Deleting old document & vectors first to re-index clean...`);
      try {
        await DocumentIngestionService.deleteDocument(existing._id.toString());
        console.log(`Old document deleted successfully.`);
      } catch (delErr) {
        console.warn(`Could not cleanly delete old doc ${existing._id}:`, delErr);
      }
    }

    // Prepare buffer
    const buffer = Buffer.from(seed.content, 'utf-8');

    console.log(`Ingesting document: ${seed.filename} (${buffer.length} bytes)...`);
    const startTime = Date.now();

    try {
      const doc = await DocumentIngestionService.ingest({
        file: {
          buffer,
          originalname: seed.filename,
          mimetype: 'text/plain',
          size: buffer.length,
        },
        title: seed.title,
        hotelAccountId,
        propertyId,
        uploadedBy: {
          userId: superAdmin._id as Types.ObjectId,
          userRole: 'SUPER_ADMIN',
          userEmail: superAdmin.email,
        },
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`SUCCESS! Doc ID: ${doc._id} | Status: ${doc.status} (${elapsed}s)`);
      console.log(`Stats: ${doc.stats.totalTokens} tokens, ${doc.stats.largeChunkCount} large, ${doc.stats.mediumChunkCount} med, ${doc.stats.smallChunkCount} small chunks, ${doc.stats.vectorCount} vectors in Pinecone.`);
      successCount++;
    } catch (ingestErr: any) {
      console.error(`ERROR ingesting "${seed.title}":`, ingestErr.message || ingestErr);
    }
  }

  console.log(`\n==================================================================`);
  console.log(`COMPREHENSIVE SEEDING COMPLETED`);
  console.log(`Total Documents Ingested: ${successCount} / ${KNOWLEDGE_SEEDS.length}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`==================================================================\n`);

  await mongoose.disconnect();
  console.log('MongoDB disconnected.');
}

seedComprehensiveKnowledge().catch((err) => {
  console.error('Fatal error during comprehensive knowledge seeding:', err);
  process.exit(1);
});
