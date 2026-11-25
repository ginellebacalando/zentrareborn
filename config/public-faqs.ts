import type { PublicFaq } from '@/lib/chatbot/types';

// The chatbot fallback shares these reviewed public answers.
export const publicFaqs: PublicFaq[] = [
  {
    id: 'faq-1',
    question: 'What are your modes of payment?',
    answer: 'We accept Cash, Check, Card, and Bank Transfer payments.',
  },
  {
    id: 'faq-2',
    question: 'What is the capacity of your venue?',
    answer:
      'Our venue comfortably accommodates 50 to 120 guests, with 100 guests being the ideal capacity for the best guest experience.',
  },
  {
    id: 'faq-3',
    question: 'Where are you located?',
    answer:
      'We are located in San Pedro, Laguna, just minutes from the South Luzon Expressway (SLEX), making us easily accessible for guests from Metro Manila and nearby provinces.',
  },
  {
    id: 'faq-4',
    question: 'Is there a backup venue in case of rain?',
    answer:
      'Yes. Our elegant Selah Indoor Hall is located right beside the garden, allowing your celebration to continue beautifully, rain or shine.',
  },
  {
    id: 'faq-5',
    question: 'Can we customize our package?',
    answer:
      "Absolutely. We understand that every wedding is unique, so we're happy to customize selected package inclusions to better fit your vision.",
  },
  {
    id: 'faq-6',
    question: 'Are pets allowed?',
    answer:
      'Yes! pets are welcome to be part of your special day. We simply ask that they wear diapers during the event.',
  },
];

/*
 * Official FAQ page entries displayed on /faq. `answer` is the official wording; `chatAnswer` is
 * the casual wording Zion approved for the chatbot ("zion info", Part 3). Both say the same thing.
 */
export const faqPageEntries: PublicFaq[] = [
  // Payments & Booking
  {
    id: 'faq-payments-1',
    topic: 'payments',
    question: 'When are our payments due?',
    answer:
      'For packages with a Pre-Event Shoot, 20% of the total contract price, less the reservation fee, must be settled on the day of the shoot. 50% of the remaining balance is due at least 60 days before the event, while the full balance and Security Damage Deposit must be settled at least 14 days before the event.',
    chatAnswer:
      'If your package includes a Pre-Event Shoot, 20% of the total contract price (minus your reservation fee) is due on the day of your shoot. After that, 50% of the remaining balance is due at least 60 days before your event, and the full remaining balance plus the ₱5,000 Security Damage Deposit must be paid at least 14 days before your event.',
    tags: [
      'payments',
      'booking',
      'due date',
      'balance',
      'deposit',
      'payment schedule',
      'when to pay',
      'pre-event shoot',
      'downpayment',
    ],
  },
  {
    id: 'faq-payments-2',
    topic: 'payments',
    question: 'Can we make partial or advance payments?',
    answer:
      'Yes. You may make partial or advance payments before your scheduled due dates. These will be deducted from your remaining balance.',
    chatAnswer:
      'Yes, definitely! You can make partial or advance payments anytime before your scheduled due dates, and we’ll deduct them straight from your remaining balance.',
    tags: ['payments', 'booking', 'partial', 'advance', 'installment', 'hulugan'],
  },
  {
    id: 'faq-payments-3',
    topic: 'payments',
    question: 'Is our reservation fee refundable?',
    answer:
      'No. The reservation fee used to secure your event date is non-refundable and forms part of your total contract price.',
    chatAnswer:
      'No, the reservation fee is non-refundable since it locks in your event date, but it is already deducted from your total contract price.',
    tags: ['payments', 'booking', 'reservation fee', 'refund', 'refundable', 'cancellation'],
  },
  {
    id: 'faq-payments-4',
    topic: 'payments',
    question: 'What is the ₱5,000 Security Damage Deposit?',
    answer:
      'It is a refundable deposit collected before the event to cover possible damages, overtime, cleaning fees, missing items, or other unpaid charges. If there are no deductions, it will be refunded within 2–48 hours after the event.',
    chatAnswer:
      'The ₱5,000 Security Damage Deposit is a refundable deposit collected at least 14 days before your event. It covers any possible venue damage, overtime, cleaning fees, missing items, or unpaid charges. As long as there are no deductions, you’ll get it back in full within 2 to 48 hours after your event.',
    tags: ['payments', 'booking', 'security deposit', 'damage deposit', 'refund'],
  },
  {
    id: 'faq-payments-5',
    topic: 'payments',
    question: 'Can we reschedule our wedding date?',
    answer:
      'Yes, subject to venue availability. Requests must be submitted at least 6 months before your original event date. Approved rescheduling is subject to a ₱20,000 rescheduling fee.',
    chatAnswer:
      'Yes, you can reschedule as long as your new date is available. Just make sure to submit your request at least 6 months before your original event date. Approved rescheduling comes with a ₱20,000 rescheduling fee.',
    tags: ['payments', 'booking', 'reschedule', 'rebooking', 'move date', 'change date'],
  },
  {
    id: 'faq-payments-6',
    topic: 'payments',
    question: 'What happens if we cancel our wedding?',
    answer:
      'Cancellation charges depend on how close the cancellation is to your event date. Since the applicable amount varies, please refer to your signed contract or coordinate with our team for your specific booking.',
    chatAnswer:
      'Cancellation charges depend on how close the cancellation is to your wedding date. Since the exact amount varies per booking, please check your signed contract or message Sir Tim Soriano and our team directly so we can assist you.',
    tags: ['payments', 'booking', 'cancel', 'cancellation'],
  },

  // Planning & Coordination
  {
    id: 'faq-planning-1',
    topic: 'planning',
    question: 'Where do we write our wedding details and requests?',
    answer:
      "After your first meeting, we'll provide a Wedding Details Tracker (Google Sheet) where you can add and update all important details and requests.",
    chatAnswer:
      'Right after your first meeting with us, we’ll give you a Wedding Details Tracker (Google Sheet). You can put and update all your wedding details and special requests there.',
    tags: ['planning', 'coordination', 'tracker', 'details', 'requests'],
  },
  {
    id: 'faq-planning-2',
    topic: 'planning',
    question: 'Where do we send our Photo & Video pegs?',
    answer:
      "Once you've selected your P&V team, we'll create a group chat with them where you can send your pegs, shot ideas, and requests. (for Premium or Ultimate Clients)",
    chatAnswer:
      'For Premium or Ultimate Package clients, once you’ve chosen your Photo & Video team, we’ll set up a group chat with them so you can easily send your pegs, shot ideas, and requests.',
    tags: ['planning', 'coordination', 'photo', 'video', 'pegs', 'photographer'],
  },
  {
    id: 'faq-planning-3',
    topic: 'planning',
    question: 'Can we send pegs to our HMUA?',
    answer:
      'Yes! Once your HMUA is selected, you may send your preferred hair and makeup pegs for their reference in the GC to be created.',
    chatAnswer:
      'Yes! Once you’ve selected your Hair and Makeup Artist (HMUA), we’ll create a group chat where you can send your preferred hair and makeup pegs for their reference.',
    tags: ['planning', 'coordination', 'hmua', 'hair', 'makeup', 'pegs'],
  },
  {
    id: 'faq-planning-4',
    topic: 'planning',
    question: 'Can we send styling pegs?',
    answer:
      "Yes! We'll match your motif using our available artificial flowers and styling materials. Available themes include Classic White, Pastel, Rustic, Blue, Red, Pink & White, and Lavender & White. Fresh flowers or custom/exact styling may require an additional quotation.",
    chatAnswer:
      'Yes, you can send your styling pegs! We’ll match your motif using our available artificial flowers and styling materials. You can choose from our available themes: Classic White, Pastel, Rustic, Blue, Red, Pink & White, and Lavender & White. If you want fresh flowers or custom/exact styling outside our standard materials, that may require an extra quotation.',
    tags: [
      'planning',
      'coordination',
      'styling',
      'motif',
      'motifs',
      'flowers',
      'theme',
      'themes',
      'colors',
      'decor',
      'decoration',
    ],
  },
  {
    id: 'faq-planning-5',
    topic: 'planning',
    question: "Is Zion's coordination team included in our church ceremony?",
    answer:
      "Yes! We'll assist with the entourage line-up, entrance flow, music cues, and overall ceremony coordination.",
    chatAnswer:
      'Yes! Our coordination team is included for your church ceremony too. We’ll take care of the entourage line-up, entrance flow, music cues, and overall ceremony coordination.',
    tags: ['planning', 'coordination', 'church', 'ceremony', 'coordinator'],
  },
  {
    id: 'faq-planning-6',
    topic: 'planning',
    question: 'When do we need to finalize our wedding details?',
    answer:
      'Your final guest count and floor plan must be confirmed at least 14 days before the wedding.',
    chatAnswer:
      'You need to confirm your final guest count and floor plan at least 14 days before your wedding.',
    tags: ['planning', 'coordination', 'finalize', 'deadline', 'floor plan'],
  },

  // Food & Catering
  {
    id: 'faq-food-1',
    topic: 'food',
    question: 'Can we add food or dishes from outside?',
    answer:
      'Outside food and additional dishes are not allowed, except for lechon. Please coordinate with our team beforehand.',
    chatAnswer:
      'We don’t allow outside food or extra dishes, except for lechon. If you’re bringing lechon, just let our team know ahead of time so we can coordinate it properly.',
    tags: [
      'food',
      'catering',
      'outside food',
      'lechon',
      'bring food',
      'own food',
      'dishes',
      'pagkain',
      'handa',
    ],
  },
  {
    id: 'faq-food-2',
    topic: 'food',
    question: 'Can we add more guests to our package?',
    answer:
      "Yes, subject to availability and venue capacity. Additional guests will be charged based on your package's applicable per-head rate.",
    chatAnswer:
      'Yes, as long as the venue capacity allows it. Additional guests will simply be charged based on your package’s per-head rate.',
    tags: [
      'food',
      'catering',
      'guests',
      'headcount',
      'capacity',
      'additional guests',
      'extra guests',
      'per head',
    ],
  },
  {
    id: 'faq-food-3',
    topic: 'food',
    question: 'When do we need to finalize our guest count?',
    answer: 'Your final guest count must be submitted at least 14 days before the wedding.',
    chatAnswer: 'Please submit your final guest count at least 14 days before your wedding date.',
    tags: ['food', 'catering', 'guest count', 'deadline'],
  },
  {
    id: 'faq-food-4',
    topic: 'food',
    question: 'Can we reduce our guest count after final confirmation?',
    answer:
      'Reductions made after the 14-day deadline will not result in a refund, credit, or deduction from the package price.',
    chatAnswer:
      'Once you pass the 14-day deadline, lowering your guest count won’t qualify for a refund, credit, or deduction from your package price.',
    tags: ['food', 'catering', 'guest count', 'reduction', 'refund', 'fewer guests'],
  },
  {
    id: 'faq-food-5',
    topic: 'food',
    question: 'Are meals for our outside suppliers included?',
    answer:
      'No. Meals for outside suppliers are not included. Crew meals may be requested from Zion for an additional charge.',
    chatAnswer:
      'No, meals for outside suppliers aren’t included in the package, but you can request crew meals from Zion for an additional charge.',
    tags: ['food', 'catering', 'crew meals', 'suppliers'],
  },
  {
    id: 'faq-food-6',
    topic: 'food',
    question: 'How old are children who can eat for free at the buffet?',
    answer:
      'Children 5 years old and below are free. Guests 6 years old and above are counted as regular guests. We do not offer separate kiddie meals.',
    chatAnswer:
      'Kids 5 years old and below eat for free at the buffet! Guests who are 6 years old and above are counted as regular adult guests. Also, please note that we don’t offer separate kiddie meals.',
    tags: ['food', 'catering', 'children', 'kids', 'buffet', 'kids free', 'kiddie meals', 'bata'],
  },

  // Venue & Setup
  {
    id: 'faq-venue-1',
    topic: 'venue',
    question: 'How long can we access the venue on our wedding day?',
    answer:
      'Zion hosts only one event per day, giving you up to 15 hours of venue access for preparations, styling, and your event. Air-conditioning is included for 5 hours during the formal event program.',
    chatAnswer:
      'Since Zion only hosts one event per day, you get the place to yourselves for up to 15 hours to cover preparations, styling, and the actual event. Air-conditioning in the hall is included for 5 hours during your formal event program.',
    tags: [
      'venue',
      'setup',
      'hours',
      'access',
      'air-conditioning',
      'aircon',
      'how many hours',
      'one event per day',
    ],
  },
  {
    id: 'faq-venue-2',
    topic: 'venue',
    question: 'What happens if it rains during our outdoor wedding?',
    answer:
      'Your event may be transferred to Selah Hall. (for classic this will be add-on). The final venue decision should be made at least 2 hours before the ceremony or program.',
    chatAnswer:
      'If it rains, we can move your outdoor wedding indoors to Selah Hall (note: for Classic Package clients, using Selah Hall is an add-on). You’ll just need to make the final call to move indoors at least 2 hours before the ceremony or program starts.',
    tags: ['venue', 'setup', 'rain', 'raining', 'backup', 'selah hall', 'indoor', 'ulan'],
  },
  {
    id: 'faq-venue-3',
    topic: 'venue',
    question: 'Is there parking for our guests?',
    answer:
      'Yes. Zion has on-site parking for 45 vehicles with parking attendants available during your event.',
    chatAnswer:
      'Yes, we have on-site parking that fits up to 45 vehicles, plus parking attendants on duty during your event to assist your guests.',
    tags: ['venue', 'setup', 'parking', 'vehicles', 'cars', 'paradahan'],
  },
  {
    id: 'faq-venue-4',
    topic: 'venue',
    question: 'Does Zion have a backup generator?',
    answer:
      'Yes. Zion has a backup generator for power interruptions. During an outage, we prioritize essential event operations such as the Reception Hall, sound system, lights, LED wall, and fans. Air-conditioning in rooms and other areas may be reduced to maximize power throughout the event.',
    chatAnswer:
      'Yes, we have a backup generator ready in case of a power interruption. If a brownout happens, we prioritize power for the main event needs: the Reception Hall, sound system, lights, LED wall, and fans. Air-conditioning in the prep rooms and other areas may be turned down so we can maximize power for your reception.',
    tags: ['venue', 'setup', 'generator', 'power', 'brownout', 'blackout', 'power outage'],
  },
  {
    id: 'faq-venue-5',
    topic: 'venue',
    question: 'Is there a corkage or electricity fee for outside food carts?',
    answer:
      'There is no corkage fee for outside food carts. However, an electricity fee applies depending on the equipment used: ₱1,000 for light-load and ₱2,000 for heavy-load equipment. Please declare the equipment beforehand so our team can assess the applicable fee.',
    chatAnswer:
      'There is no corkage fee for outside food carts! We only charge an electricity fee based on the equipment they plug in: ₱1,000 for light-load equipment or ₱2,000 for heavy-load equipment. Just let our team know what equipment they’re bringing ahead of time so we can check the exact fee.',
    tags: ['venue', 'setup', 'corkage', 'electricity fee', 'food carts', 'food cart'],
  },
  {
    id: 'faq-venue-6',
    topic: 'venue',
    question: 'Is there a corkage fee for alcoholic beverages?',
    answer:
      'No. You may bring your own alcoholic beverages with no corkage fee. Please coordinate with our team beforehand for proper setup and serving arrangements.',
    chatAnswer:
      'None at all! You can bring your own alcoholic drinks with zero corkage fee. Just coordinate with our team ahead of time so we can arrange the proper setup and serving for your event.',
    tags: ['venue', 'setup', 'corkage', 'alcohol', 'drinks', 'wine', 'beer', 'liquor'],
  },

  // Suppliers & Add-Ons
  {
    id: 'faq-suppliers-1',
    topic: 'suppliers',
    question: 'Where can we choose and book our suppliers?',
    answer:
      'You can view and select available suppliers through the Suppliers tab of your Zion Client Portal. All selections are subject to supplier availability.',
    chatAnswer:
      'You can check out and book available suppliers right in the Suppliers tab of your Zion Client Portal. Just keep in mind that all bookings are subject to the supplier’s availability on your date.',
    tags: ['suppliers', 'add-ons', 'portal', 'book suppliers'],
  },
  {
    id: 'faq-suppliers-2',
    topic: 'suppliers',
    question: 'Can we change or remove a supplier after confirming?',
    answer:
      'Once a supplier has been booked and confirmed through the portal via email, their service can no longer be removed from your package.',
    chatAnswer:
      'Once a supplier is booked and confirmed through the portal via email, you won’t be able to remove or cancel their service from your package anymore.',
    tags: ['suppliers', 'add-ons', 'change', 'remove'],
  },
  {
    id: 'faq-suppliers-3',
    topic: 'suppliers',
    question: 'Can we bring our own suppliers?',
    answer:
      'Yes. Outside suppliers are allowed but must be declared and coordinated with Zion before the event. Electricity fees may apply depending on their equipment.',
    chatAnswer:
      'Yes, you’re welcome to bring outside suppliers! Just make sure to declare and coordinate them with our team before the event. Depending on the equipment they bring, electricity fees may apply.',
    tags: ['suppliers', 'add-ons', 'outside suppliers', 'own supplier'],
  },
  {
    id: 'faq-suppliers-4',
    topic: 'suppliers',
    question: 'Can we still add services after booking our wedding package?',
    answer:
      'Yes! You may check and book available upgrades and additional services through the Suppliers tab of this Client Portal.',
    chatAnswer:
      'Yes! Even after you’ve booked your package, you can still browse and add upgrades or extra services anytime through the Suppliers tab in your Client Portal.',
    tags: ['suppliers', 'add-ons', 'upgrades', 'services', 'add services'],
  },
  {
    id: 'faq-suppliers-5',
    topic: 'suppliers',
    question: 'Are meals for outside suppliers included?',
    answer:
      'No. Meals for outside suppliers are not included, but crew meals may be requested from Zion for an additional charge.',
    chatAnswer:
      'Meals for outside suppliers aren’t included in your package, but you can order crew meals directly from Zion for an extra fee.',
    tags: ['suppliers', 'add-ons', 'crew meals'],
  },

  // Changes & Concerns
  {
    id: 'faq-changes-1',
    topic: 'changes',
    question: 'Can we make changes to our wedding details after submitting them?',
    answer:
      'Yes. You may continue updating your Wedding Details Tracker while planning. For major or last-minute changes, please inform your Head Coordinator directly.',
    chatAnswer:
      'Yes, you can keep updating your Wedding Details Tracker while we’re in the planning stage. If you have any major or last-minute changes, please message your Head Coordinator directly right away.',
    tags: ['changes', 'concerns', 'wedding details', 'tracker', 'update details'],
  },
  {
    id: 'faq-changes-2',
    topic: 'changes',
    question: 'Can we change our styling or motif?',
    answer:
      "Yes, as long as the request can still be accommodated. Custom styling, fresh flowers, specialty materials, or requests outside Zion's available styling options may require an additional quotation.",
    chatAnswer:
      'Yes, as long as there’s still enough time to accommodate the change! Choosing from our standard motifs is free, while custom styling, fresh flowers, or specialty materials outside our standard options may need an additional quotation.',
    tags: ['changes', 'concerns', 'styling', 'motif', 'change motif'],
  },
  {
    id: 'faq-changes-3',
    topic: 'changes',
    question: 'Can we change our final guest count?',
    answer:
      'Changes may be made before the 14-day deadline. After final confirmation, additional guests are subject to availability, while reductions will no longer result in a refund or deduction.',
    chatAnswer:
      'You can freely adjust your guest count before the 14-day deadline. After that 14-day mark, adding more guests depends on availability, and reducing your guest count won’t give you a refund or price deduction.',
    tags: ['changes', 'concerns', 'guest count', 'change guests'],
  },
  {
    id: 'faq-changes-4',
    topic: 'changes',
    question: 'What if we need to reschedule our wedding?',
    answer:
      'Please inform us as early as possible. Rescheduling requests must be made at least 6 months before the original date and are subject to availability and a ₱20,000 rescheduling fee.',
    chatAnswer:
      'Please let us know as early as possible! Rescheduling requests must be submitted at least 6 months before your original wedding date, depend on venue availability, and have a ₱20,000 rescheduling fee.',
    tags: ['changes', 'concerns', 'reschedule', 'rescheduling fee', 'move date'],
  },
  {
    id: 'faq-changes-5',
    topic: 'changes',
    question: 'Who should we contact for changes or concerns?',
    answer:
      'For general wedding details and coordination concerns, please message your Head Coordinator or Zion group chat. For anything related to payments, prices, or your Statement of Account (SOA), please contact Sir Tim Soriano directly.',
    chatAnswer:
      'For wedding details, planning, and coordination questions, message your Head Coordinator or your Zion group chat. For anything about payments, pricing, or your Statement of Account (SOA), reach out to Sir Tim Soriano or the Zion FB Page directly.',
    tags: ['changes', 'concerns', 'contact', 'coordinator', 'soa', 'sir tim'],
  },
];

/*
 * Zeni-only follow-up questions ("zion info", Parts 4 and 5): the same rules asked the way clients
 * usually ask them, plus the contact directory. Not shown on /faq, which already lists the rules.
 */
export const zeniExtraFaqs: PublicFaq[] = [
  {
    id: 'zeni-extra-same-day',
    topic: 'venue',
    question: 'Will there be another wedding or event at Zion on the same day as ours?',
    answer:
      'No. Zion hosts only one event per day, so the venue is exclusively yours for up to 15 hours (including your preparation, styling, and program time).',
    tags: ['same day', 'another event', 'exclusive', 'one event per day', 'other wedding'],
  },
  {
    id: 'zeni-extra-reservation-fee',
    topic: 'payments',
    question: 'If we pay our reservation fee, is that an extra fee on top of the package price?',
    answer:
      'No, it’s not an extra fee. Your reservation fee is part of your total contract price and will be deducted from your balance (though it is non-refundable once paid).',
    tags: ['reservation fee', 'extra fee', 'package price', 'on top', 'deducted'],
  },
  {
    id: 'zeni-extra-no-shoot',
    topic: 'payments',
    question: 'What if we don’t have a Pre-Event Shoot? When are our payments due?',
    answer:
      'The 20% shoot-day payment only applies to packages with a Pre-Event Shoot. Your main milestones are 50% of the remaining balance at least 60 days before the event, and the full balance plus the ₱5,000 Security Damage Deposit at least 14 days before the event. You can also make partial or advance payments anytime before those dates. For your exact payment breakdown or SOA, you can message Sir Tim Soriano.',
    tags: ['no pre-event shoot', 'payment schedule', 'payments due', 'milestones', 'how to pay'],
  },
  {
    id: 'zeni-extra-deposit-back',
    topic: 'payments',
    question: 'How soon do we get our ₱5,000 Security Damage Deposit back after the wedding?',
    answer:
      'If there are no deductions (such as damages, overtime, cleaning fees, missing items, or unpaid charges), your ₱5,000 deposit will be refunded within 2 to 48 hours after your event.',
    tags: ['deposit back', 'refund deposit', 'security deposit', 'get deposit'],
  },
  {
    id: 'zeni-extra-overtime',
    topic: 'payments',
    question: 'What happens if our event goes overtime or something gets damaged?',
    answer:
      'Any overtime charges, venue damages, cleaning fees, missing items, or unpaid balances will be deducted from your ₱5,000 Security Damage Deposit.',
    tags: ['overtime', 'damage', 'damaged', 'broken', 'extra hours'],
  },
  {
    id: 'zeni-extra-carts',
    topic: 'suppliers',
    question:
      'Can we bring a coffee cart, grazing table, mobile bar, or photobooth from an outside supplier?',
    answer:
      'Yes! Outside suppliers and food carts are allowed, and we don’t charge any corkage fee for food carts or alcoholic drinks. You just need to declare and coordinate them with Zion beforehand. Also, an electricity fee applies depending on their equipment (₱1,000 for light-load and ₱2,000 for heavy-load).',
    tags: ['coffee cart', 'grazing table', 'mobile bar', 'photobooth', 'photo booth', 'food cart'],
  },
  {
    id: 'zeni-extra-home-cooked',
    topic: 'food',
    question:
      'Can my mom or family bring home-cooked dishes, desserts, or pastries to add to the buffet?',
    answer:
      'Sorry, outside food and extra dishes aren’t allowed at the buffet; the only exception is lechon (which you should coordinate with our team beforehand). However, outside food carts are allowed with no corkage fee, just the applicable electricity fee (₱1,000 light-load or ₱2,000 heavy-load).',
    tags: ['home-cooked', 'home cooked', 'desserts', 'pastries', 'family food', 'bring dishes'],
  },
  {
    id: 'zeni-extra-kiddie-meals',
    topic: 'food',
    question: 'Do you provide kiddie meals for the kids attending our wedding?',
    answer:
      'We don’t offer separate kiddie meals. Instead, children 5 years old and below eat for free at the regular buffet, while kids 6 years old and above are counted as regular guests.',
    tags: ['kiddie meals', 'kids meal', 'children meals', 'kids'],
  },
  {
    id: 'zeni-extra-backouts',
    topic: 'food',
    question:
      'What if some confirmed guests back out a week before the wedding? Can we deduct them from our bill or swap their plates for crew meals?',
    answer:
      'Since the final guest count is locked in 14 days before the wedding, any reductions made after the 14-day deadline won’t result in a refund, credit, or deduction from your package price.',
    tags: ['back out', 'no show', 'deduct guests', 'swap plates', 'cancelled guests'],
  },
  {
    id: 'zeni-extra-fresh-flowers',
    topic: 'planning',
    question: 'Are fresh flowers included in the venue styling?',
    answer:
      'Our package styling uses high-quality artificial flowers and styling materials in your choice of motif (Classic White, Pastel, Rustic, Blue, Red, Pink & White, or Lavender & White). If you want fresh flowers or custom styling outside our available materials, we can arrange an additional quotation for you.',
    tags: ['fresh flowers', 'real flowers', 'artificial flowers', 'flowers'],
  },
  {
    id: 'zeni-extra-motifs',
    topic: 'planning',
    question: 'What motifs or themes are available?',
    answer:
      'Our available themes are Classic White, Pastel, Rustic, Blue, Red, Pink & White, and Lavender & White. Send us your styling pegs and we’ll match your motif using our artificial flowers and styling materials. Fresh flowers or custom/exact styling may need an additional quotation.',
    tags: ['motif', 'motifs', 'theme', 'themes', 'colors', 'color motif', 'available motifs'],
  },
  {
    id: 'zeni-extra-classic-rain',
    topic: 'venue',
    question: 'We booked the Classic Package for an outdoor garden wedding. What if it rains?',
    answer:
      'If it rains, your wedding can be moved indoors to Selah Hall. For Classic Package clients, moving to Selah Hall is an add-on. Also, remember that the final decision to transfer indoors must be made at least 2 hours before your ceremony or program starts.',
    tags: ['classic package', 'garden wedding', 'rain', 'selah hall', 'add-on'],
  },
  {
    id: 'zeni-extra-brownout-ac',
    topic: 'venue',
    question: 'Why did the air-conditioning in the prep room get turned down during a brownout?',
    answer:
      'When running on our backup generator during a power outage, we prioritize power for the main Reception Hall, sound system, lights, LED wall, and fans so your program continues smoothly. AC in the rooms and other areas may be reduced to make sure the generator can sustain the entire event.',
    tags: ['air-conditioning', 'aircon', 'prep room', 'brownout', 'generator'],
  },
  {
    id: 'zeni-extra-pv-chat',
    topic: 'planning',
    question: 'We booked a Classic Package. Why don’t we have a photo and video group chat yet?',
    answer:
      'The dedicated Photo & Video group chat is created for Premium or Ultimate Package clients once they select their P&V team. If you want to upgrade or add services, you can check the Suppliers tab in your Zion Client Portal or ask your Head Coordinator!',
    tags: ['group chat', 'photo video', 'p&v', 'classic package', 'gc'],
  },
  {
    id: 'zeni-extra-contacts',
    topic: 'changes',
    question: 'Who handles payments, planning and supplier bookings?',
    answer:
      'Planning, your Wedding Details Tracker, timeline, floor plan, styling pegs, church coordination, outside suppliers or last-minute changes: your Head Coordinator or your Zion group chat. Payments, package pricing, your Statement of Account (SOA), rescheduling fees, cancellation computation or billing receipts: Sir Tim Soriano or the Zion Facebook page. Booking suppliers, upgrades and extra services: the Suppliers tab of your Zion Client Portal.',
    tags: [
      'who to contact',
      'billing',
      'receipts',
      'soa',
      'sir tim',
      'head coordinator',
      'contact',
    ],
  },
];
