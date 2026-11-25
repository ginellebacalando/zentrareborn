import {
  templateLanguage,
  type ZeniLanguage,
  type ZeniTemplateLanguage,
} from '@/lib/chatbot/language';

/** Zeni's identity and panel wording. The ZENTRA monogram is the avatar; no character is drawn. */
export const chatbotReceptionist = {
  name: 'Zeni',
  title: 'ZENI',
  subtitle: 'Virtual concierge · Zion Events Place',
  launcherLabel: 'Chat with Zeni, the Zion Events Place virtual concierge',
  launcherHint: 'Questions? Ask Zeni',
  placeholder: 'Ask about packages, dates or visits…',
  inputLabel: 'Message Zeni',
  inputHelp: 'Never share passwords, card numbers or ID details.',
  send: 'Send message',
  close: 'Close chat',
  newConversation: 'New conversation',
  howItWorks: 'How Zeni works',
  backToChat: 'Back to chat',
  typing: 'Zeni is typing…',
  opening: 'Opening your conversation…',
  clearing: 'Starting a new conversation…',
  you: 'You',
  sourcesLabel: 'From',
  nextSteps: 'Next steps',
  suggestionsLabel: 'Suggested questions',
  interruptedTitle: 'Your last message was interrupted.',
  interruptedHelp: 'Retry it, or start a new conversation.',
  retry: 'Retry previous message',
  info: {
    points: [
      'Zeni answers from Zion Events Place’s published information: packages, facilities, FAQs and policies. When those pages don’t cover a question, Zeni says so instead of guessing.',
      'Answers can still contain mistakes. Please confirm prices, dates and policies with our staff before you decide.',
      'Zeni never reserves a date, confirms a booking or takes payment. The calendar check shows only confirmed events; staff confirm every booking request.',
      'Prefer a person? Choose “Talk to staff” at any time.',
    ],
    privacyTitle: 'Your privacy',
    privacy: [
      'Please don’t share passwords, card numbers or ID details in the chat.',
      'Some answers are phrased by an AI model (Google Gemini). Before anything is sent to it, Zeni removes names, email addresses, phone numbers, street addresses and booking references; only Zion’s public information, your question and the last few redacted messages are sent.',
      'Details you share stay in this browser’s conversation for up to 24 hours. “New conversation” clears them now; it does not cancel bookings or inquiries you already sent.',
    ],
    remembered: 'What Zeni remembers in this conversation',
  },
} as const;

export type ZeniErrorCode =
  | 'origin'
  | 'format'
  | 'length'
  | 'busy'
  | 'expired'
  | 'changed'
  | 'processing'
  | 'interrupted'
  | 'memory'
  | 'restore'
  | 'unavailable'
  | 'timeout'
  | 'network'
  | 'incomplete'
  | 'clear';

type ZeniCopy = {
  welcome: string;
  greeting: string;
  welcomeBack: (name?: string) => string;
  appreciation: string;
  identity: string;
  smallTalk: string;
  unclear: string;
  askDate: string;
  invalidDate: string;
  invalidTime: string;
  checking: string;
  available: (date: string, window: string, observedAt: string) => string;
  unavailable: (date: string) => string;
  calendarError: (date: string) => string;
  staleResult: string;
  bookingIntro: string;
  bookingWithDetails: (details: string) => string;
  visit: string;
  existingBooking: string;
  handoffName: string;
  handoffEmail: string;
  handoffConsent: string;
  handoffSending: string;
  handoffSent: (reference: string) => string;
  handoffFailed: string;
  handoffPreview: string;
  complaintPrefix: string;
  knowledgeGap: string;
  knowledgeConflict: string;
  depositClarify: string;
  paymentReview: string;
  capacityReview: string;
  answerFollowUp: string;
  privacy: string;
  scope: string;
  abuse: string;
  leave: string;
  decline: string;
  comparison: string;
  objectionPrice: string;
  objectionTrust: string;
  objectionDecision: string;
  objectionTime: string;
  objectionDiscount: string;
  recommendation: (name: string, amount: string, included: number, guests: number) => string;
  noRecommendation: string;
  askGuests: string;
  labels: {
    talkToStaff: string;
    bookThisDate: string;
    openBookingForm: string;
    scheduleVisit: string;
    checkAnotherDate: string;
    sendToStaff: string;
    notNow: string;
    continue: string;
    viewDetails: string;
    viewPackages: string;
    contactPage: string;
    startsAt: string;
  };
  suggestions: {
    welcome: string[];
    afterAnswer: string[];
    afterAvailability: string[];
    afterBooking: string[];
  };
  calendar: {
    title: string;
    previousMonth: string;
    nextMonth: string;
    booked: string;
    open: string;
    outside: string;
    selected: string;
    legendBooked: string;
    legendOpen: string;
    note: string;
    check: (date: string) => string;
  };
  /** Live chat with a staff member, opened when Zeni hands the visitor over. */
  live: {
    connecting: string;
    waiting: string;
    joined: (staff: string) => string;
    returned: (staff: string) => string;
    visitorEnded: string;
    closed: string;
    missed: string;
    idle: string;
    offline: string;
    waitingBanner: (position: number | null) => string;
    activeBanner: (staff: string) => string;
    staffLabel: (staff: string) => string;
    endChat: string;
    leaveMessage: string;
    sendFailed: string;
    inputLabel: string;
    placeholder: string;
  };
  errors: Record<ZeniErrorCode, string>;
};

const en: ZeniCopy = {
  welcome:
    'Hello! I’m Zeni, the virtual concierge of Zion Events Place. I can help with packages, available dates and ocular visits.',
  greeting: 'Hello! How can I help with your celebration today?',
  welcomeBack: (name) =>
    `Welcome back${name ? `, ${name}` : ''}. I kept the details from this short conversation; earlier messages are not shown again. What would you like to do next?`,
  appreciation: 'You’re welcome! Is there anything else I can help you with?',
  identity:
    'I’m Zeni, Zion’s virtual concierge, not a person. I answer from Zion’s published information, and I can connect you with our staff at any time.',
  smallTalk: 'I’m doing well, thank you! How can I help with your event at Zion?',
  unclear:
    'I’d be happy to help. Are you looking for package details, an available date or an ocular visit?',
  askDate: 'Which date are you considering? Tap a date below to check it against our calendar.',
  invalidDate:
    'I need a full date that hasn’t passed yet. Please pick one on the calendar below or type it, for example 2027-02-14.',
  invalidTime:
    'Please give a start and an end time on the same day, for example 2 PM to 7 PM. I won’t assume how long your event runs.',
  checking: 'One moment while I check the calendar.',
  available: (date, window, observedAt) =>
    `As of ${observedAt}, ${date}${window} has no confirmed event on Zion’s calendar. This isn’t a reservation yet: booking sends a request that our staff confirm.`,
  unavailable: (date) =>
    `${date} already has a confirmed event on Zion’s calendar. Please choose another date below, or talk to our staff.`,
  calendarError: (date) =>
    `I can’t reach the calendar right now, so I won’t guess whether ${date} is free. You can still send a booking request, or our staff can check the date for you.`,
  staleResult:
    'That earlier calendar check has expired. Please check the date again before relying on it.',
  bookingIntro:
    'You can request your event through our booking form, and our staff confirm every booking. Would you like to check a date first? Tap one below.',
  bookingWithDetails: (details) =>
    `I’ve added what you shared (${details}) to our booking form. Our staff confirm every booking. Would you like to check a date first? Tap one below.`,
  visit:
    'Ocular visits are by appointment. Choose your preferred date in the visit request and our staff will confirm the time.',
  existingBooking:
    'Changes to an existing booking are handled by our staff, so I’ll pass your request to them.',
  handoffName: 'I can send a message to our staff. What name should I put on it?',
  handoffEmail: 'What email address can our staff reply to?',
  handoffConsent:
    'I’ll send your name, email and a short summary of this chat to our staff inbox. Shall I send it?',
  handoffSending: 'Sending your message to our staff.',
  handoffSent: (reference) =>
    `Done: your message is in our staff inbox as ${reference}. This isn’t a reservation, and staff will reply by email. You can also use the Contact page.`,
  handoffFailed:
    'I couldn’t confirm that your message reached our staff, so I won’t say it was sent. Your details are still here; please try again or use the Contact page.',
  handoffPreview: 'Preview: in a real conversation this would send the message to the staff inbox.',
  complaintPrefix: 'I’m sorry to hear this.',
  knowledgeGap:
    'I don’t have published information about that yet, so I won’t guess. Would you like me to ask our staff?',
  knowledgeConflict:
    'The published information on this doesn’t match, so I’d rather have our staff confirm it. Shall I ask them?',
  depositClarify: 'Do you mean the reservation payment or the separate security deposit?',
  paymentReview:
    'Our published payment information still needs to be confirmed by staff, so I won’t give you an unverified payment instruction. Would you like me to ask them?',
  capacityReview:
    'Capacity depends on the space and setup, and the published figures differ, so I won’t pick a number for you. Would you like our staff to confirm it?',
  answerFollowUp: 'Is there anything else you’d like to know?',
  privacy:
    'For your privacy, please don’t share passwords, card numbers or ID details here. I can still help with your event or connect you with our staff.',
  scope:
    'That’s outside what I can help with as Zion’s concierge. Would you like to know about our venue, packages or available dates?',
  abuse:
    'I’m here to help with your event, and we can continue respectfully. What would you like to know about Zion?',
  leave:
    'I’ll leave the conversation here for now. Our staff can help if you’d like to continue respectfully.',
  decline: 'Of course, there’s no need to decide now. I’m here whenever you’re ready.',
  comparison:
    'I can explain Zion’s own features and policies, but I won’t make claims about other venues. What matters most to you?',
  objectionPrice:
    'I understand the cost needs to fit your plans. What matters most to you in a package?',
  objectionTrust:
    'That’s a fair question. You’re welcome to visit the venue first; would an ocular visit help?',
  objectionDecision:
    'Of course, it makes sense to decide together. Would a summary of the published packages help?',
  objectionTime: 'Take all the time you need. Is there one detail I can clarify for you?',
  objectionDiscount:
    'I can share only published offers and won’t promise an unlisted discount. Would you like me to ask our staff about your options?',
  recommendation: (name, amount, included, guests) =>
    `${name} is published at ${amount} and includes ${included} guests, which covers the ${guests} guests you mentioned. Would you like to open the booking form with this package?`,
  noRecommendation:
    'I don’t have a published package I can match to those details, so I won’t suggest a price. Would you like our staff to help?',
  askGuests: 'How many guests are you planning for?',
  labels: {
    talkToStaff: 'Talk to staff',
    bookThisDate: 'Book this date',
    openBookingForm: 'Open the booking form',
    scheduleVisit: 'Schedule an ocular visit',
    checkAnotherDate: 'Check another date',
    sendToStaff: 'Send to staff',
    notNow: 'Not now',
    continue: 'Continue',
    viewDetails: 'View details',
    viewPackages: 'View packages',
    contactPage: 'Contact page',
    startsAt: 'Starts at',
  },
  suggestions: {
    welcome: ['Check a date', 'Wedding packages', 'Schedule a visit'],
    afterAnswer: ['Check a date', 'Schedule a visit', 'Talk to staff'],
    afterAvailability: ['Wedding packages', 'Where are you located?', 'Talk to staff'],
    afterBooking: ['Wedding packages', 'Schedule a visit', 'Talk to staff'],
  },
  calendar: {
    title: 'Available dates',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    booked: 'already has a confirmed event',
    open: 'no confirmed event yet; tap to check',
    outside: 'outside the next two months',
    selected: 'last checked',
    legendBooked: 'Booked',
    legendOpen: 'Open to check',
    note: 'Dates only. A date without a confirmed event is not reserved until our staff confirm a booking.',
    check: (date) => `Check ${date}`,
  },
  live: {
    connecting:
      'I’m bringing in a member of our team. A real person from Zion Events Place will reply right here in this chat.',
    waiting: 'Waiting for a staff member to join. You can type your question while you wait.',
    joined: (staff) => `${staff} from Zion Events Place joined the chat.`,
    returned: (staff) =>
      `${staff} handed you back to Zeni. Thank you for chatting with us! Ask Zeni anything else you need.`,
    visitorEnded: 'You ended the chat with our staff. Zeni is here if you need anything else.',
    closed: 'Our staff closed this chat. Zeni is here if you need anything else.',
    missed:
      'Sorry, no one from our team could join just now. Leave your name and email and we will reply as soon as we can.',
    idle: 'This chat went quiet, so Zeni is back. Ask for our staff again anytime.',
    offline:
      'Our team isn’t available for live chat right now, but I can send them your message so they can reply by email.',
    waitingBanner: (position) =>
      position && position > 1
        ? `Waiting for our staff · ${position - 1} ahead of you`
        : 'Waiting for our staff to join…',
    activeBanner: (staff) => `You’re chatting with ${staff} from Zion Events Place`,
    staffLabel: (staff) => `${staff} · Zion staff`,
    endChat: 'End chat',
    leaveMessage: 'Leave a message for our team',
    sendFailed: 'Your message didn’t send. Please try again.',
    inputLabel: 'Message our staff',
    placeholder: 'Type your message…',
  },
  errors: {
    origin: 'Please use Zeni on the Zion Events Place website.',
    format: 'Please send your message as text.',
    length: 'Please keep your message between 1 and 600 characters.',
    busy: 'Zeni is busy right now. Please try again in a minute or contact our staff.',
    expired: 'This conversation has expired. Start a new conversation to continue.',
    changed:
      'This conversation changed in another tab. Your message is kept below; please send it again.',
    processing: 'Your previous message is still being processed. Please try again shortly.',
    interrupted: 'Your previous message was interrupted. Retry it, or start a new conversation.',
    memory: 'This conversation is full. Please start a new conversation to continue.',
    restore: 'Your saved conversation couldn’t be restored. Please start a new conversation.',
    unavailable:
      'Zeni is temporarily unavailable. Your message is kept below; please retry or contact our staff.',
    timeout:
      'Zeni took too long to reply. Your message is kept below; please send it again or contact our staff.',
    network: 'Unable to connect. Check your connection and try again.',
    incomplete: 'Zeni sent an incomplete reply. Please try again.',
    clear: 'Your saved details couldn’t be cleared. Please try again.',
  },
};

const taglish: ZeniCopy = {
  welcome:
    'Hello po! Ako si Zeni, ang virtual concierge ng Zion Events Place. Matutulungan ko po kayo sa packages, available dates at ocular visits.',
  greeting: 'Hello po! Paano ko po kayo matutulungan sa inyong celebration?',
  welcomeBack: (name) =>
    `Welcome back po${name ? `, ${name}` : ''}! Naitabi ko ang mga detalye ng maikling usapan natin; hindi na po ipapakita ang mga naunang mensahe. Ano po ang gusto ninyong gawin?`,
  appreciation: 'Walang anuman po! May iba pa po ba akong maitutulong?',
  identity:
    'Ako po si Zeni, ang virtual concierge ng Zion, hindi po ako tao. Sumasagot ako mula sa published information ng Zion, at puwede ko po kayong i-connect sa aming staff anumang oras.',
  smallTalk: 'Mabuti naman po, salamat! Paano ko po kayo matutulungan sa inyong event sa Zion?',
  unclear:
    'Masaya po akong tumulong. Package details, available date, o ocular visit po ba ang hanap ninyo?',
  askDate:
    'Anong date po ang gusto ninyo? Pumili po kayo sa ibaba para ma-check ko sa calendar namin.',
  invalidDate:
    'Kailangan ko po ng buong date na hindi pa lumilipas. Pumili po kayo sa calendar sa ibaba o i-type ito, halimbawa 2027-02-14.',
  invalidTime:
    'Pakibigay po ang start at end time sa parehong araw, halimbawa 2 PM hanggang 7 PM. Hindi ko po huhulaan kung gaano katagal ang event.',
  checking: 'Sandali lang po, iche-check ko ang calendar.',
  available: (date, window, observedAt) =>
    `As of ${observedAt}, wala pang confirmed na event sa ${date}${window} sa calendar ng Zion. Hindi pa po ito reservation: ang booking ay request na kokumpirmahin ng aming staff.`,
  unavailable: (date) =>
    `May confirmed na event na po sa ${date}. Pumili po kayo ng ibang date sa ibaba, o kausapin ang aming staff.`,
  calendarError: (date) =>
    `Hindi ko po ma-check ang calendar ngayon, kaya hindi ko masasabi kung bakante ang ${date}. Puwede pa rin po kayong mag-send ng booking request, o ipa-check ito sa aming staff.`,
  staleResult:
    'Expired na po ang naunang calendar check. Paki-check po ulit ang date bago ito asahan.',
  bookingIntro:
    'Puwede po kayong mag-request ng booking sa aming booking form, at staff po ang nagkukumpirma ng bawat booking. Gusto n’yo po bang mag-check muna ng date? Pumili po sa ibaba.',
  bookingWithDetails: (details) =>
    `Nailagay ko na po sa booking form ang mga binigay ninyo (${details}). Staff po ang nagkukumpirma ng bawat booking. Gusto n’yo po bang mag-check muna ng date? Pumili po sa ibaba.`,
  visit:
    'By appointment po ang ocular visits. Ilagay lang po ang gusto ninyong date sa visit request at kokumpirmahin ng staff ang oras.',
  existingBooking:
    'Ang aming staff po ang nag-aasikaso ng pagbabago sa existing booking, kaya ipapasa ko po ito sa kanila.',
  handoffName:
    'Puwede ko pong ipadala ang mensahe ninyo sa aming staff. Anong pangalan po ang ilalagay ko?',
  handoffEmail: 'Anong email address po ang puwedeng sagutin ng aming staff?',
  handoffConsent:
    'Ipapadala ko po ang inyong pangalan, email at maikling summary ng chat na ito sa staff inbox. I-send ko na po ba?',
  handoffSending: 'Ipinapadala ko na po ang mensahe ninyo sa aming staff.',
  handoffSent: (reference) =>
    `Naipadala na po: nasa staff inbox na ang mensahe ninyo bilang ${reference}. Hindi pa po ito reservation, at sasagot ang staff sa email. Puwede rin po ninyong gamitin ang Contact page.`,
  handoffFailed:
    'Hindi ko po ma-confirm na natanggap ng staff ang mensahe, kaya hindi ko masasabing naipadala ito. Nandito pa rin po ang mga detalye; pakisubukan ulit o gamitin ang Contact page.',
  handoffPreview: 'Preview: sa totoong usapan, ipapadala nito ang mensahe sa staff inbox.',
  complaintPrefix: 'Pasensya na po sa naranasan ninyo.',
  knowledgeGap:
    'Wala pa po akong published information tungkol diyan, kaya hindi ko po huhulaan. Gusto n’yo po bang itanong ko sa aming staff?',
  knowledgeConflict:
    'Hindi po magkatugma ang published information tungkol dito, kaya mas mabuting staff ang mag-confirm. Itatanong ko po ba sa kanila?',
  depositClarify:
    'Ang reservation payment po ba o ang hiwalay na security deposit ang tinutukoy ninyo?',
  paymentReview:
    'Kailangan pa pong i-confirm ng staff ang published payment information, kaya hindi ako magbibigay ng hindi pa verified na payment instruction. Itatanong ko po ba sa kanila?',
  capacityReview:
    'Nakadepende po ang capacity sa space at setup, at magkaiba ang published figures, kaya hindi ako pipili ng numero. Gusto n’yo po bang ipa-confirm sa staff?',
  answerFollowUp: 'May iba pa po ba kayong gustong malaman?',
  privacy:
    'Para sa inyong privacy, huwag po magbahagi ng password, card number o ID details dito. Matutulungan ko pa rin po kayo sa inyong event, o i-connect sa aming staff.',
  scope:
    'Wala po iyan sa matutulungan ko bilang concierge ng Zion. Gusto n’yo po bang malaman ang tungkol sa venue, packages o available dates?',
  abuse:
    'Nandito po ako para tumulong sa inyong event, at puwede po tayong magpatuloy nang may respeto. Ano po ang gusto ninyong malaman tungkol sa Zion?',
  leave:
    'Dito ko na po muna ititigil ang usapan. Matutulungan po kayo ng aming staff kung gusto ninyong magpatuloy nang may respeto.',
  decline: 'Sige po, hindi kailangang magdesisyon ngayon. Nandito lang po ako kapag handa na kayo.',
  comparison:
    'Maipapaliwanag ko po ang features at policies ng Zion, pero hindi po ako magsasalita tungkol sa ibang venue. Ano po ang pinakamahalaga sa inyo?',
  objectionPrice:
    'Naiintindihan ko po na kailangang pasok sa plano ang gastos. Ano po ang pinakamahalaga sa inyo sa isang package?',
  objectionTrust:
    'Makatwirang tanong po iyan. Puwede po muna kayong bumisita sa venue; makakatulong po ba ang ocular visit?',
  objectionDecision:
    'Sige po, mabuting pag-usapan muna ninyo. Makakatulong po ba ang summary ng published packages?',
  objectionTime:
    'Walang problema po, maglaan kayo ng oras. May detalye po ba akong maipapaliwanag?',
  objectionDiscount:
    'Published offers lang po ang maibabahagi ko, at hindi po ako mangangako ng discount na wala sa listahan. Itatanong ko po ba sa staff ang inyong options?',
  recommendation: (name, amount, included, guests) =>
    `Ang ${name} po ay published sa ${amount} at kasama ang ${included} guests, kaya pasok po ang ${guests} guests na binanggit ninyo. Gusto n’yo po bang buksan ang booking form gamit ang package na ito?`,
  noRecommendation:
    'Wala po akong published package na tugma sa mga detalyeng iyan, kaya hindi ako magmumungkahi ng presyo. Gusto n’yo po bang tumulong ang aming staff?',
  askGuests: 'Ilan po ang inaasahan ninyong guests?',
  labels: {
    talkToStaff: 'Kausapin ang staff',
    bookThisDate: 'I-book ang date na ito',
    openBookingForm: 'Buksan ang booking form',
    scheduleVisit: 'Mag-schedule ng ocular visit',
    checkAnotherDate: 'Mag-check ng ibang date',
    sendToStaff: 'I-send sa staff',
    notNow: 'Huwag muna',
    continue: 'Ituloy',
    viewDetails: 'Tingnan ang detalye',
    viewPackages: 'Tingnan ang packages',
    contactPage: 'Contact page',
    startsAt: 'Simula sa',
  },
  suggestions: {
    welcome: ['Mag-check ng date', 'Wedding packages', 'Mag-schedule ng ocular visit'],
    afterAnswer: ['Mag-check ng date', 'Mag-schedule ng ocular visit', 'Kausapin ang staff'],
    afterAvailability: ['Wedding packages', 'Saan kayo located?', 'Kausapin ang staff'],
    afterBooking: ['Wedding packages', 'Mag-schedule ng ocular visit', 'Kausapin ang staff'],
  },
  calendar: {
    title: 'Available dates',
    previousMonth: 'Nakaraang buwan',
    nextMonth: 'Susunod na buwan',
    booked: 'may confirmed na event na',
    open: 'wala pang confirmed na event; i-tap para ma-check',
    outside: 'lampas sa susunod na dalawang buwan',
    selected: 'huling na-check',
    legendBooked: 'Booked',
    legendOpen: 'Puwedeng i-check',
    note: 'Dates lang po ito. Hindi pa reserved ang date na walang confirmed na event hangga’t hindi kinukumpirma ng staff ang booking.',
    check: (date) => `I-check ang ${date}`,
  },
  live: {
    connecting:
      'Tatawagin ko po ang isa sa aming team. Isang totoong tao mula sa Zion Events Place ang sasagot dito mismo sa chat.',
    waiting:
      'Hinihintay po ang staff na sumali. Puwede na po ninyong i-type ang tanong ninyo habang naghihintay.',
    joined: (staff) => `Sumali na po si ${staff} mula sa Zion Events Place.`,
    returned: (staff) =>
      `Ibinalik na po kayo ni ${staff} kay Zeni. Salamat po sa pakikipag-chat! Puwede pa po kayong magtanong kay Zeni.`,
    visitorEnded:
      'Tinapos na po ninyo ang chat sa staff. Nandito pa rin po si Zeni kung may kailangan pa kayo.',
    closed:
      'Isinara na po ng aming staff ang chat. Nandito pa rin po si Zeni kung may kailangan pa kayo.',
    missed:
      'Pasensya na po, walang staff na nakasali ngayon. Iwan po ang inyong pangalan at email at sasagot kami agad.',
    idle: 'Tumahimik na po ang chat kaya bumalik na si Zeni. Puwede po ulit tumawag ng staff anumang oras.',
    offline:
      'Wala pong available na staff para sa live chat ngayon, pero puwede ko pong ipadala sa kanila ang mensahe ninyo para makasagot sila sa email.',
    waitingBanner: (position) =>
      position && position > 1
        ? `Hinihintay ang staff · ${position - 1} ang nauna sa inyo`
        : 'Hinihintay po ang staff na sumali…',
    activeBanner: (staff) => `Kausap ninyo si ${staff} mula sa Zion Events Place`,
    staffLabel: (staff) => `${staff} · Zion staff`,
    endChat: 'Tapusin ang chat',
    leaveMessage: 'Mag-iwan ng mensahe sa team',
    sendFailed: 'Hindi po naipadala ang mensahe. Pakisubukan ulit.',
    inputLabel: 'Mensahe sa staff',
    placeholder: 'I-type ang mensahe…',
  },
  errors: {
    origin: 'Pakigamit po si Zeni sa website ng Zion Events Place.',
    format: 'Paki-send po ang mensahe bilang text.',
    length: 'Pakipanatili po ang mensahe sa pagitan ng 1 at 600 characters.',
    busy: 'Busy po si Zeni ngayon. Pakisubukan ulit pagkalipas ng isang minuto o kausapin ang aming staff.',
    expired: 'Expired na po ang conversation na ito. Magsimula po ng bagong conversation.',
    changed:
      'Nagbago po ang conversation sa ibang tab. Nandito pa ang mensahe ninyo; paki-send po ulit.',
    processing: 'Pinoproseso pa po ang naunang mensahe ninyo. Pakisubukan ulit maya-maya.',
    interrupted:
      'Naputol po ang naunang mensahe ninyo. I-retry ito, o magsimula ng bagong conversation.',
    memory: 'Puno na po ang conversation na ito. Magsimula po ng bagong conversation.',
    restore:
      'Hindi po ma-restore ang naka-save na conversation. Magsimula po ng bagong conversation.',
    unavailable:
      'Pansamantalang hindi available si Zeni. Nandito pa ang mensahe ninyo; pakisubukan ulit o kausapin ang aming staff.',
    timeout:
      'Natagalan po ang sagot ni Zeni. Nandito pa ang mensahe ninyo; paki-send po ulit o kausapin ang aming staff.',
    network: 'Hindi po maka-connect. Paki-check ang connection at subukan ulit.',
    incomplete: 'Kulang po ang sagot na natanggap. Pakisubukan ulit.',
    clear: 'Hindi po ma-clear ang naka-save na detalye. Pakisubukan ulit.',
  },
};

export const zeniCopy: Record<ZeniTemplateLanguage, ZeniCopy> = { en, taglish };

export function zeniCopyFor(language: ZeniLanguage | undefined) {
  return zeniCopy[templateLanguage(language ?? 'en')];
}
