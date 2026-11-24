export const chatbotReceptionist = {
  name: 'Zeni',
  avatar: {
    src: '/images/chatbot/zeni-receptionist.webp',
    width: 192,
    height: 192,
  },
  animatedAvatar: {
    src: '/images/chatbot/zeni-receptionist-animated.webp',
    width: 160,
    height: 160,
  },
  idleAvatar: {
    src: '/images/chatbot/zeni-receptionist-idle.webp',
    width: 160,
    height: 160,
  },
  waveAvatar: {
    src: '/images/chatbot/zeni-receptionist-wave.webp',
    width: 160,
    height: 160,
  },
  launcherGreetings: ['Hello!', 'Welcome to Zion Events Place.', 'How may I help you?'],
  reducedMotionGreeting: 'Hello! How may I help you?',
  welcome: 'Good day, and welcome to Zion Events Place.',
  introduction: 'I’m Zeni, your virtual receptionist. It would be my pleasure to assist you.',
  invitation:
    'May I help you with information about our venue, packages, visiting hours, or policies?',
  appreciation:
    'You are most welcome. It is a pleasure to assist you. Please let me know if there is anything else I can help you with.',
} as const;

export const chatbotGreeting = [
  chatbotReceptionist.welcome,
  chatbotReceptionist.introduction,
  chatbotReceptionist.invitation,
].join(' ');

export const chatbotEmojiGroups = [
  {
    label: 'Reactions & Expressions',
    emojis: [
      { symbol: '😊', name: 'Smiling face' },
      { symbol: '😄', name: 'Happy grinning face' },
      { symbol: '😁', name: 'Beaming face' },
      { symbol: '🥰', name: 'Smiling face with hearts' },
      { symbol: '😍', name: 'Heart eyes' },
      { symbol: '🤩', name: 'Star-struck amazed' },
      { symbol: '😮', name: 'Wow surprised face' },
      { symbol: '😲', name: 'Astonished face' },
      { symbol: '🥹', name: 'Touched happy tears' },
      { symbol: '🤗', name: 'Warm hug' },
      { symbol: '🙌', name: 'Celebrating hands' },
      { symbol: '👏', name: 'Clapping hands' },
      { symbol: '👍', name: 'Thumbs up' },
      { symbol: '❤️', name: 'Red heart' },
      { symbol: '💖', name: 'Sparkling heart' },
      { symbol: '🙏', name: 'Thank you' },
    ],
  },
  {
    label: 'Celebrations & Events',
    emojis: [
      { symbol: '🎉', name: 'Party popper' },
      { symbol: '🎊', name: 'Confetti ball' },
      { symbol: '🎈', name: 'Balloon' },
      { symbol: '🎁', name: 'Wrapped gift' },
      { symbol: '🥂', name: 'Clinking glasses' },
      { symbol: '🍾', name: 'Champagne bottle' },
      { symbol: '✨', name: 'Sparkles' },
      { symbol: '🎆', name: 'Fireworks' },
    ],
  },
  {
    label: 'Birthday & Debut',
    emojis: [
      { symbol: '🎂', name: 'Birthday cake' },
      { symbol: '🧁', name: 'Cupcake' },
      { symbol: '🕯️', name: 'Candle' },
      { symbol: '👑', name: 'Crown' },
      { symbol: '🎀', name: 'Ribbon' },
      { symbol: '🎶', name: 'Music notes' },
    ],
  },
  {
    label: 'Wedding & Christening',
    emojis: [
      { symbol: '💒', name: 'Wedding chapel' },
      { symbol: '💍', name: 'Ring' },
      { symbol: '💐', name: 'Bouquet' },
      { symbol: '🕊️', name: 'Dove' },
      { symbol: '👶', name: 'Baby' },
      { symbol: '🍼', name: 'Baby bottle' },
      { symbol: '⛪', name: 'Church' },
      { symbol: '👼', name: 'Baby angel' },
    ],
  },
  {
    label: 'Christmas & Holidays',
    emojis: [
      { symbol: '🎄', name: 'Christmas tree' },
      { symbol: '🎅', name: 'Santa Claus' },
      { symbol: '🤶', name: 'Mrs. Claus' },
      { symbol: '⛄', name: 'Snowman' },
      { symbol: '⭐', name: 'Star' },
      { symbol: '🔔', name: 'Bell' },
    ],
  },
  {
    label: 'Celebration Figures',
    emojis: [
      { symbol: '🥳', name: 'Partying face' },
      { symbol: '👰', name: 'Bride with veil' },
      { symbol: '🤵', name: 'Groom in tuxedo' },
      { symbol: '💃', name: 'Woman dancing' },
      { symbol: '🕺', name: 'Man dancing' },
      { symbol: '👯', name: 'People celebrating' },
      { symbol: '👩‍❤️‍👨', name: 'Couple' },
      { symbol: '👨‍👩‍👧‍👦', name: 'Family' },
    ],
  },
] as const;
