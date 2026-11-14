// Activities per PHQ-9 level, transcribed from the Sweet Dreams board.
//
// Two rules from the board are deliberate and load-bearing:
//   - one activity per type, rotated so the same one is not shown on
//     consecutive days;
//   - no medication content, and food activities never mention weight
//     or calories.
//
// Deliberately NOT included:
//   - "Doctor notification" rows. They are clinician triggers ("contact
//     within 48 h"), not things a person does, so they are not suggestions.
//   - The SAFETY tier (item 9 >= 1). It needs the PHQ-9 item answers and a
//     screen of its own, not three rotating cards.
//
// Several activities offer alternatives separated by " / ". These are the
// per-type options the board asks us to rotate between.

/** Levels, highest threshold first; `min` is inclusive. */
export const LEVELS = [
  { id: 'L4', min: 20, max: 27, label: 'L4' },
  { id: 'L3', min: 15, max: 19, label: 'L3' },
  { id: 'L2', min: 10, max: 14, label: 'L2' },
  { id: 'L1', min: 5, max: 9, label: 'L1' },
  { id: 'L0', min: 0, max: 4, label: 'L0' },
];

const ACTIVITIES = {
  // L4 (moodScore < 2.0): Very hard / depleted day — ultra-gentle basic care, calm & tiny connection
  L4: [
    {
      type: 'Body',
      options: [
        'Drink a glass of water and eat something simple',
        'Take a warm shower or wash your face with warm water',
        'Change into clean, comfortable clothes',
        'Step outside or onto a balcony for 5 minutes of fresh air',
        'Wrap up in a warm blanket and rest your shoulders',
      ],
      dose: '5 min',
    },
    {
      type: 'Calm',
      options: [
        'Take 6 slow, deep breaths with a longer exhale',
        'Listen to one quiet, comforting song with your eyes closed',
        'Rest one hand on your chest and breathe slowly for 3 minutes',
        'Dim the lights and step away from notifications for a few minutes',
      ],
      dose: '3 min',
    },
    {
      type: 'Rhythm',
      options: [
        'Open the curtains as soon as you wake up tomorrow',
        'Set one gentle wake-up alarm and put water by the bed',
        'Sit near natural daylight for 5 minutes in the morning',
        'Step out of bed and sit in a chair for a few quiet minutes',
      ],
      dose: '5 min',
    },
    {
      type: 'Connection',
      options: [
        'Send a simple text or emoji to one person you trust',
        'Let someone close know today felt heavy',
        'Sit quietly in the same room with family, a friend, or a pet',
        'Ask someone you trust for a short check-in tomorrow',
      ],
      dose: '5 min',
    },
    {
      type: 'Care',
      options: [
        'Book or prepare a check-in with your doctor or therapist',
        'Let yourself drop one non-essential chore for tomorrow',
        'Prepare a warm Caffeine-free tea before getting into bed',
        'Write down one thing someone could help you with this week',
      ],
      dose: '10 min',
    },
    {
      type: 'Sleep',
      options: [
        'Put your phone face-down across the room before lights out',
        'Keep the bedroom cool, dark, and quiet tonight',
        'Listen to gentle rain or ambient sound while winding down',
      ],
      dose: '10 min',
    },
  ],

  // L3 (2.0 <= moodScore < 4.0): Heavy / draining day — low-effort comfort, tiny tasks & gentle movement
  L3: [
    {
      type: 'Gentle movement',
      options: [
        'Take a slow 10-minute walk around the block',
        'Do 10 minutes of gentle neck, shoulder, and back stretching',
        'Try a short chair yoga or floor stretching routine',
        'Stroll outside at an easy pace with no destination',
      ],
      dose: '10–15 min',
    },
    {
      type: 'Small pleasure',
      options: [
        'Make a warm drink and sit quietly by the window',
        'Listen to a favourite comforting album or song',
        'Watch a short lighthearted or funny clip',
        'Enjoy a familiar pleasant scent like fresh coffee, tea, or soap',
        'Read a few pages of an easy, comforting book',
      ],
      dose: '10 min',
    },
    {
      type: 'Small task',
      options: [
        'Make the bed and tidy just the nightstand',
        'Wash a few dishes or clear one kitchen counter',
        'Reply to one pending message and leave the rest for later',
        'Lay out comfortable clothes for tomorrow morning',
        'Take out the rubbish or put one load of laundry in',
      ],
      dose: '10 min',
    },
    {
      type: 'Nature',
      options: [
        'Sit on a park bench for 10 minutes and notice the trees',
        'Walk slowly along a quiet, tree-lined street',
        'Water a houseplant or spend 10 minutes looking out at the sky',
        'Step outside in the morning light before checking your phone',
      ],
      dose: '10–15 min',
    },
    {
      type: 'Contact',
      options: [
        'Send a brief voice note or text to a supportive friend',
        'Make a 5-minute phone call to someone warm and familiar',
        'Say hello to a neighbour or barista tomorrow',
        'Share a song or photo with someone you care about',
      ],
      dose: '5 min',
    },
    {
      type: 'Calm',
      options: [
        'Do 10 minutes of progressive muscle relaxation from toes to shoulders',
        'Practice slow box breathing (4s in, 4s hold, 4s out) for 5 minutes',
        'Sit quietly without screens and let your eyes rest',
      ],
      dose: '5–10 min',
    },
    {
      type: 'Diary',
      options: [
        'Jot down one small thing you got through today',
        'Write three words for how you feel and close the notebook',
        'Note one gentle thing to keep easy tomorrow',
      ],
      dose: '3 min',
    },
  ],

  // L2 (4.0 <= moodScore < 6.0): Mixed / up-and-down day — grounding routines & gentle activation
  L2: [
    {
      type: 'Gentle movement',
      options: [
        'Go for a brisk 20-minute walk outdoors',
        'Do a 20-minute mobility or easy yoga flow at home',
        'Take a bike ride around your neighbourhood at a relaxed pace',
        'Put on upbeat music and move around the house for 15 minutes',
      ],
      dose: '20 min',
    },
    {
      type: 'Nature',
      options: [
        'Walk through a nearby park or garden for 20 minutes',
        'Take your morning coffee or tea outdoors in daylight',
        'Find a green spot to sit without headphones for 15 minutes',
        'Walk a scenic route home instead of the fastest one',
      ],
      dose: '20 min',
    },
    {
      type: 'Food',
      options: [
        'Cook one simple, colourful meal from scratch',
        'Add vegetables, legumes, nuts, fish, or whole grains to tomorrow’s meal',
        'Prepare a nourishing breakfast tonight so tomorrow starts smoothly',
        'Sit down at the table for a unhurried meal without screens',
      ],
      dose: '20 min',
    },
    {
      type: 'Small pleasure',
      options: [
        'Spend 20 minutes on a relaxed hobby — sketching, music, or crafts',
        'Visit a quiet café, bakery, or bookshop you enjoy',
        'Listen to an engaging podcast episode while walking or tidying',
        'Take an unhurried evening bath or shower with music',
      ],
      dose: '20 min',
    },
    {
      type: 'Contact',
      options: [
        'Catch up with a friend over a 15-minute phone call',
        'Invite someone for a relaxed coffee or short walk',
        'Check in on a friend or family member you haven’t spoken to lately',
        'Eat lunch with a colleague or friend tomorrow',
      ],
      dose: '15 min',
    },
    {
      type: 'Small task',
      options: [
        'Reset your desk or living space for 15 minutes',
        'Tackle one small errand you have been putting off',
        'Organize tomorrow’s top 2 priorities on paper',
        'Sort through one drawer, bag, or folder for 10 minutes',
      ],
      dose: '15 min',
    },
    {
      type: 'Relax',
      options: [
        'Unplug from screens 30 minutes before sleep tonight',
        'Do 10 minutes of slow stretching before getting into bed',
        'Spend 10 quiet minutes journaling or reading in low light',
      ],
      dose: '15 min',
    },
  ],

  // L1 (6.0 <= moodScore < 8.0): Good / steady day — balanced habits that sustain momentum
  L1: [
    {
      type: 'Structured exercise',
      options: [
        'Go for a 30-minute brisk walk or Nordic walk',
        'Do a 30-minute swim, cycle, or light jog',
        'Complete a 25-minute bodyweight strength session',
        'Follow a 30-minute Pilates or vinyasa yoga session',
      ],
      dose: '30 min',
    },
    {
      type: 'Green exercise',
      options: [
        'Take a 35-minute forest or riverside walk',
        'Do an outdoor stair, hill, or park workout',
        'Cycle along a green trail or park loop',
        'Go for an energizing morning walk in natural light',
      ],
      dose: '35 min',
    },
    {
      type: 'Connection',
      options: [
        'Plan a dinner, coffee, or walk with a friend this week',
        'Have a proper phone or video catch-up with someone close',
        'Join a shared lunch or social break tomorrow',
        'Write a thoughtful message to someone you appreciate',
      ],
      dose: '20 min',
    },
    {
      type: 'Food',
      options: [
        'Try cooking a new wholesome recipe with fresh ingredients',
        'Prepare a colourful Mediterranean-style lunch for tomorrow',
        'Share a homemade meal with family, friends, or housemates',
      ],
      dose: '30 min',
    },
    {
      type: 'Activity planning',
      options: [
        'Plan tomorrow: 1 enjoyable moment + 1 meaningful task',
        'Block 30 minutes of protected personal time in tomorrow’s calendar',
        'Pick one small weekend outing to look forward to',
      ],
      dose: '5 min',
    },
    {
      type: 'Gratitude',
      options: [
        'Write down 3 moments that went well today and why',
        'Send a quick thank-you note to someone who brightened your week',
        'Capture one highlight from today in a notebook or photo',
      ],
      dose: '5 min',
    },
    {
      type: 'Sleep',
      options: [
        'Keep a steady bedtime and wind down with a book tonight',
        'Step into morning daylight within 20 minutes of waking tomorrow',
        'Set a calm evening cutoff for work messages tonight',
      ],
      dose: '15 min',
    },
  ],

  // L0 (moodScore >= 8.0): Energized / bright day — expansive, active, creative & social ideas
  L0: [
    {
      type: 'Fitness',
      options: [
        'Go for an energizing run or interval jog',
        'Take a longer outdoor cycle ride',
        'Join a gym class, climbing session, or team sport',
        'Do a full strength workout or outdoor bar session',
        'Tackle an upbeat hill or stair interval workout',
      ],
      dose: '45 min',
    },
    {
      type: 'Mind-body',
      options: [
        'Take a full yoga, Pilates, tai chi, or qigong session',
        'Practice 20 minutes of mindful movement and mobility',
        'Try an energizing morning flow before starting your day',
      ],
      dose: '30 min',
    },
    {
      type: 'Learning',
      options: [
        'Spend 30 minutes learning a skill, language, or instrument',
        'Make headway on a creative side project you care about',
        'Explore a workshop, lecture, or tutorial on a curious topic',
        'Cook, build, or sketch something new from scratch',
      ],
      dose: '30 min',
    },
    {
      type: 'Community',
      options: [
        'Join a group run, sports club, choir, or community meetup',
        'Organize a group walk, game night, or shared meal with friends',
        'Look into a local volunteering session or neighbourhood activity',
        'Invite a friend along to try an outdoor activity together',
      ],
      dose: '60 min',
    },
    {
      type: 'Nature',
      options: [
        'Plan a weekend hike, coastal walk, or nature trail',
        'Spend an hour exploring a large park, botanical garden, or forest',
        'Watch sunrise or sunset outdoors from a favourite viewpoint',
      ],
      dose: '60 min',
    },
    {
      type: 'Gratitude',
      options: [
        'Write down 3 good things from today to savour the momentum',
        'Send an appreciative message to someone who matters to you',
        'Note what gave you energy today so you can repeat it this week',
      ],
      dose: '5 min',
    },
    {
      type: 'Routine',
      options: [
        'Keep your fixed wake time + morning daylight streak going tomorrow',
        'Prep your gear tonight for tomorrow’s movement or project',
        'Protect your sleep window tonight to carry today’s energy forward',
      ],
      dose: '10 min',
    },
  ],
};

/**
 * Minutes a session takes, read off the board's Dose column.
 *
 * A range takes its lower bound ("30–40 min" -> 30). A weekly total is not a
 * session length, so "150 min/wk" gives nothing rather than a 150-minute
 * card. Doses with no duration at all ("1 a day") give nothing too, and the
 * card simply offers to schedule without claiming a length.
 */
export function minutesFromDose(dose = '') {
  const m = /(\d+)\s*(?:[–-]\s*\d+\s*)?min(?!\s*\/)/.exec(dose);
  return m ? Number(m[1]) : undefined;
}

/** The level a PHQ-9 total falls in. Clamped, so any number resolves. */
export function levelForScore(score) {
  const n = Math.max(0, Math.min(27, Number(score) || 0));
  return LEVELS.find((l) => n >= l.min) ?? LEVELS[LEVELS.length - 1];
}

/** Whole numbers of days since the epoch — the rotation clock. */
function dayIndex(date = new Date()) {
  return Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86400000
  );
}

/**
 * Daily-rotated suggestions for a PHQ-9 tier score.
 *
 * Both the types and the option within each type advance each day, so the
 * same card does not come round on consecutive days.
 */
export function suggestionsFor(score, { date = new Date(), count = 3 } = {}) {
  const level = levelForScore(score);
  const own = ACTIVITIES[level.id];
  const list = own ?? ACTIVITIES.L2;
  const borrowed = !own;
  if (!list?.length) return { level, borrowed, items: [] };

  const day = dayIndex(date);
  const take = Math.min(count, list.length);
  const items = Array.from({ length: take }, (_, i) => {
    const row = list[(day * take + i) % list.length];
    const option = row.options[(day + i) % row.options.length];
    return {
      id: `${level.id}-${row.type}-${option}`,
      type: row.type,
      title: option,
      dose: row.dose,
      minutes: minutesFromDose(row.dose),
      note: row.note,
    };
  });

  return { level, borrowed, items };
}

/**
 * Immediate 0..10 mood score computed from the drawn Day Line geometry
 * (0 = bottom "- Bad", 10 = top "+ Good"), weighting overall trajectory (75%)
 * and where the evening settled at Night (25%).
 */
export function lineMoodScore(line) {
  const pts = line?.points;
  if (!pts?.length) return null;
  const meanY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const endY = pts[pts.length - 1].y;
  const blended = (1 - meanY) * 7.5 + (1 - endY) * 2.5;
  return Math.round(Math.min(10, Math.max(0, blended)) * 10) / 10;
}

/**
 * Combine all available 0..10 evening scores (Day Line score, word content score,
 * and spoken prosody score) into one 0..10 evening mood score.
 */
export function eveningMoodScore(entry) {
  if (!entry) return null;
  const parts = [];
  const drawScore =
    typeof entry.dayScore?.score === 'number' && Number.isFinite(entry.dayScore.score)
      ? entry.dayScore.score
      : lineMoodScore(entry.line);
  if (typeof drawScore === 'number') parts.push(drawScore);
  if (typeof entry.contentState?.score === 'number' && Number.isFinite(entry.contentState.score)) {
    parts.push(entry.contentState.score);
  }
  if (typeof entry.voiceState?.score === 'number' && Number.isFinite(entry.voiceState.score)) {
    parts.push(entry.voiceState.score);
  }
  if (!parts.length) return null;
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  return Math.round(Math.min(10, Math.max(0, avg)) * 10) / 10;
}

/**
 * Map a 0..10 evening mood score (10 = bright/great day, 0 = very heavy/hard day)
 * across all 5 activity tiers (L0..L4) so suggestions fit the user's energy.
 */
export function phqEquivalentFromMoodScore(moodScore) {
  if (typeof moodScore !== 'number' || !Number.isFinite(moodScore)) return 12;
  if (moodScore >= 8.0) return 2; // L0: energized / bright day
  if (moodScore >= 6.0) return 7; // L1: good / steady day
  if (moodScore >= 4.0) return 12; // L2: mixed / up-and-down day
  if (moodScore >= 2.0) return 17; // L3: heavy / draining day
  return 22; // L4: very hard / depleted day
}

/** Warm one-line explanation matching the chosen activity tier. */
export function moodTierSummary(levelId) {
  if (levelId === 'L0') return 'Today felt bright — energizing ideas to build on your momentum.';
  if (levelId === 'L1') return 'Today went steadily — balanced habits to keep your rhythm strong.';
  if (levelId === 'L3') return 'Today felt heavy — gentle, low-effort steps to care for yourself.';
  if (levelId === 'L4') return 'Today was really hard — keep things very small, restful, and kind.';
  return 'A mixed day — calm, grounding ideas for tomorrow.';
}

/**
 * Pick 3 daily-rotated activities tailored to this specific evening's score
 * (falling back to `fallbackPhq9` only when no entry score is available).
 */
export function suggestionsForEntry(entry, { fallbackPhq9 = 12, date = new Date(), count = 3 } = {}) {
  const moodScore = eveningMoodScore(entry);
  const effectiveScore = moodScore !== null ? phqEquivalentFromMoodScore(moodScore) : fallbackPhq9;
  const res = suggestionsFor(effectiveScore, { date, count });
  return { ...res, moodScore };
}
