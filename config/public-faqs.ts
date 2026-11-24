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

// Official FAQ page entries displayed on /faq.
export const faqPageEntries: PublicFaq[] = [
  // Payments & Booking
  {
    id: 'faq-payments-1',
    question: 'When are our payments due?',
    answer:
      'For packages with a Pre-Event Shoot, 20% of the total contract price, less the reservation fee, must be settled on the day of the shoot. 50% of the remaining balance is due at least 60 days before the event, while the full balance and Security Damage Deposit must be settled at least 14 days before the event.',
    tags: ['payments', 'booking', 'due date', 'balance', 'deposit'],
  },
  {
    id: 'faq-payments-2',
    question: 'Can we make partial or advance payments?',
    answer:
      'Yes. You may make partial or advance payments before your scheduled due dates. These will be deducted from your remaining balance.',
    tags: ['payments', 'booking', 'partial', 'advance'],
  },
  {
    id: 'faq-payments-3',
    question: 'Is our reservation fee refundable?',
    answer:
      'No. The reservation fee used to secure your event date is non-refundable and forms part of your total contract price.',
    tags: ['payments', 'booking', 'reservation fee', 'refund', 'cancellation'],
  },
  {
    id: 'faq-payments-4',
    question: 'What is the ₱5,000 Security Damage Deposit?',
    answer:
      'It is a refundable deposit collected before the event to cover possible damages, overtime, cleaning fees, missing items, or other unpaid charges. If there are no deductions, it will be refunded within 2–48 hours after the event.',
    tags: ['payments', 'booking', 'security deposit', 'damage deposit', 'refund'],
  },
  {
    id: 'faq-payments-5',
    question: 'Can we reschedule our wedding date?',
    answer:
      'Yes, subject to venue availability. Requests must be submitted at least 6 months before your original event date. Approved rescheduling is subject to a ₱20,000 rescheduling fee.',
    tags: ['payments', 'booking', 'reschedule', 'rebooking'],
  },
  {
    id: 'faq-payments-6',
    question: 'What happens if we cancel our wedding?',
    answer:
      'Cancellation charges depend on how close the cancellation is to your event date. Since the applicable amount varies, please refer to your signed contract or coordinate with our team for your specific booking.',
    tags: ['payments', 'booking', 'cancel', 'cancellation'],
  },

  // Planning & Coordination
  {
    id: 'faq-planning-1',
    question: 'Where do we write our wedding details and requests?',
    answer:
      "After your first meeting, we'll provide a Wedding Details Tracker (Google Sheet) where you can add and update all important details and requests.",
    tags: ['planning', 'coordination', 'tracker', 'details'],
  },
  {
    id: 'faq-planning-2',
    question: 'Where do we send our Photo & Video pegs?',
    answer:
      "Once you've selected your P&V team, we'll create a group chat with them where you can send your pegs, shot ideas, and requests. (for Premium or Ultimate Clients)",
    tags: ['planning', 'coordination', 'photo', 'video', 'pegs'],
  },
  {
    id: 'faq-planning-3',
    question: 'Can we send pegs to our HMUA?',
    answer:
      'Yes! Once your HMUA is selected, you may send your preferred hair and makeup pegs for their reference in the GC to be created.',
    tags: ['planning', 'coordination', 'hmua', 'hair', 'makeup', 'pegs'],
  },
  {
    id: 'faq-planning-4',
    question: 'Can we send styling pegs?',
    answer:
      "Yes! We'll match your motif using our available artificial flowers and styling materials. Available themes include Classic White, Pastel, Rustic, Blue, Red, Pink & White, and Lavender & White. Fresh flowers or custom/exact styling may require an additional quotation.",
    tags: ['planning', 'coordination', 'styling', 'motif', 'flowers', 'theme'],
  },
  {
    id: 'faq-planning-5',
    question: "Is Zion's coordination team included in our church ceremony?",
    answer:
      "Yes! We'll assist with the entourage line-up, entrance flow, music cues, and overall ceremony coordination.",
    tags: ['planning', 'coordination', 'church', 'ceremony'],
  },
  {
    id: 'faq-planning-6',
    question: 'When do we need to finalize our wedding details?',
    answer:
      'Your final guest count and floor plan must be confirmed at least 14 days before the wedding.',
    tags: ['planning', 'coordination', 'finalize', 'deadline', 'floor plan'],
  },

  // Food & Catering
  {
    id: 'faq-food-1',
    question: 'Can we add food or dishes from outside?',
    answer:
      'Outside food and additional dishes are not allowed, except for lechon. Please coordinate with our team beforehand.',
    tags: ['food', 'catering', 'outside food', 'lechon'],
  },
  {
    id: 'faq-food-2',
    question: 'Can we add more guests to our package?',
    answer:
      "Yes, subject to availability and venue capacity. Additional guests will be charged based on your package's applicable per-head rate.",
    tags: ['food', 'catering', 'guests', 'headcount', 'capacity'],
  },
  {
    id: 'faq-food-3',
    question: 'When do we need to finalize our guest count?',
    answer: 'Your final guest count must be submitted at least 14 days before the wedding.',
    tags: ['food', 'catering', 'guest count', 'deadline'],
  },
  {
    id: 'faq-food-4',
    question: 'Can we reduce our guest count after final confirmation?',
    answer:
      'Reductions made after the 14-day deadline will not result in a refund, credit, or deduction from the package price.',
    tags: ['food', 'catering', 'guest count', 'reduction', 'refund'],
  },
  {
    id: 'faq-food-5',
    question: 'Are meals for our outside suppliers included?',
    answer:
      'No. Meals for outside suppliers are not included. Crew meals may be requested from Zion for an additional charge.',
    tags: ['food', 'catering', 'crew meals', 'suppliers'],
  },
  {
    id: 'faq-food-6',
    question: 'How old are children who can eat for free at the buffet?',
    answer:
      'Children 5 years old and below are free. Guests 6 years old and above are counted as regular guests. We do not offer separate kiddie meals.',
    tags: ['food', 'catering', 'children', 'kids', 'buffet'],
  },

  // Venue & Setup
  {
    id: 'faq-venue-1',
    question: 'How long can we access the venue on our wedding day?',
    answer:
      'Zion hosts only one event per day, giving you up to 15 hours of venue access for preparations, styling, and your event. Air-conditioning is included for 5 hours during the formal event program.',
    tags: ['venue', 'setup', 'hours', 'access', 'air-conditioning'],
  },
  {
    id: 'faq-venue-2',
    question: 'What happens if it rains during our outdoor wedding?',
    answer:
      'Your event may be transferred to Selah Hall. (for classic this will be add-on). The final venue decision should be made at least 2 hours before the ceremony or program.',
    tags: ['venue', 'setup', 'rain', 'backup', 'selah hall'],
  },
  {
    id: 'faq-venue-3',
    question: 'Is there parking for our guests?',
    answer:
      'Yes. Zion has on-site parking for 45 vehicles with parking attendants available during your event.',
    tags: ['venue', 'setup', 'parking', 'vehicles'],
  },
  {
    id: 'faq-venue-4',
    question: 'Does Zion have a backup generator?',
    answer:
      'Yes. Zion has a backup generator for power interruptions. During an outage, we prioritize essential event operations such as the Reception Hall, sound system, lights, LED wall, and fans. Air-conditioning in rooms and other areas may be reduced to maximize power throughout the event.',
    tags: ['venue', 'setup', 'generator', 'power'],
  },
  {
    id: 'faq-venue-5',
    question: 'Is there a corkage or electricity fee for outside food carts?',
    answer:
      'There is no corkage fee for outside food carts. However, an electricity fee applies depending on the equipment used: ₱1,000 for light-load and ₱2,000 for heavy-load equipment. Please declare the equipment beforehand so our team can assess the applicable fee.',
    tags: ['venue', 'setup', 'corkage', 'electricity fee', 'food carts'],
  },
  {
    id: 'faq-venue-6',
    question: 'Is there a corkage fee for alcoholic beverages?',
    answer:
      'No. You may bring your own alcoholic beverages with no corkage fee. Please coordinate with our team beforehand for proper setup and serving arrangements.',
    tags: ['venue', 'setup', 'corkage', 'alcohol', 'drinks'],
  },

  // Suppliers & Add-Ons
  {
    id: 'faq-suppliers-1',
    question: 'Where can we choose and book our suppliers?',
    answer:
      'You can view and select available suppliers through the Suppliers tab of your Zion Client Portal. All selections are subject to supplier availability.',
    tags: ['suppliers', 'add-ons', 'portal'],
  },
  {
    id: 'faq-suppliers-2',
    question: 'Can we change or remove a supplier after confirming?',
    answer:
      'Once a supplier has been booked and confirmed through the portal via email, their service can no longer be removed from your package.',
    tags: ['suppliers', 'add-ons', 'change', 'remove'],
  },
  {
    id: 'faq-suppliers-3',
    question: 'Can we bring our own suppliers?',
    answer:
      'Yes. Outside suppliers are allowed but must be declared and coordinated with Zion before the event. Electricity fees may apply depending on their equipment.',
    tags: ['suppliers', 'add-ons', 'outside suppliers'],
  },
  {
    id: 'faq-suppliers-4',
    question: 'Can we still add services after booking our wedding package?',
    answer:
      'Yes! You may check and book available upgrades and additional services through the Suppliers tab of this Client Portal.',
    tags: ['suppliers', 'add-ons', 'upgrades', 'services'],
  },
  {
    id: 'faq-suppliers-5',
    question: 'Are meals for outside suppliers included?',
    answer:
      'No. Meals for outside suppliers are not included, but crew meals may be requested from Zion for an additional charge.',
    tags: ['suppliers', 'add-ons', 'crew meals'],
  },

  // Changes & Concerns
  {
    id: 'faq-changes-1',
    question: 'Can we make changes to our wedding details after submitting them?',
    answer:
      'Yes. You may continue updating your Wedding Details Tracker while planning. For major or last-minute changes, please inform your Head Coordinator directly.',
    tags: ['changes', 'concerns', 'wedding details', 'tracker'],
  },
  {
    id: 'faq-changes-2',
    question: 'Can we change our styling or motif?',
    answer:
      "Yes, as long as the request can still be accommodated. Custom styling, fresh flowers, specialty materials, or requests outside Zion's available styling options may require an additional quotation.",
    tags: ['changes', 'concerns', 'styling', 'motif'],
  },
  {
    id: 'faq-changes-3',
    question: 'Can we change our final guest count?',
    answer:
      'Changes may be made before the 14-day deadline. After final confirmation, additional guests are subject to availability, while reductions will no longer result in a refund or deduction.',
    tags: ['changes', 'concerns', 'guest count'],
  },
  {
    id: 'faq-changes-4',
    question: 'What if we need to reschedule our wedding?',
    answer:
      'Please inform us as early as possible. Rescheduling requests must be made at least 6 months before the original date and are subject to availability and a ₱20,000 rescheduling fee.',
    tags: ['changes', 'concerns', 'reschedule'],
  },
  {
    id: 'faq-changes-5',
    question: 'Who should we contact for changes or concerns?',
    answer:
      'For general wedding details and coordination concerns, please message your Head Coordinator or Zion group chat. For anything related to payments, prices, or your Statement of Account (SOA), please contact Sir Tim Soriano directly.',
    tags: ['changes', 'concerns', 'contact', 'coordinator', 'soa'],
  },
];
