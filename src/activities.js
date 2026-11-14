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
  L4: [
    { type: 'Care', options: ['Book a doctor appointment'], dose: 'Daily until booked' },
    { type: 'Rhythm', options: ['Get up at the set time and open the curtains'], dose: 'Daily' },
    {
      type: 'Connection',
      options: [
        'Message one person',
        'Tell someone how you feel',
        'Let someone visit you',
        'Sit in a room with family',
      ],
      dose: '1 a day',
    },
    {
      type: 'Body',
      options: [
        '5 min outside',
        'A glass of water and a simple meal',
        'A shower',
        'Change into fresh clothes',
      ],
      dose: '1 a day',
    },
    { type: 'Calm', options: ['Slow breathing', 'Listen to one calming song'], dose: '3 min, as needed' },
  ],

  L3: [
    { type: 'Diary', options: ['Mood 0–10 + one thing I did'], dose: 'Daily, 1 min' },
    {
      type: 'Gentle movement',
      options: ['Short walk', 'Gentle stretching', 'Chair yoga', 'Walk around the block with someone'],
      dose: '10–15 min daily',
    },
    {
      type: 'Nature',
      options: ['Sit in a park', 'Walk under trees', 'Look at trees or sky from a window'],
      dose: '10–20 min',
    },
    {
      type: 'Small task',
      options: [
        'Shower and get dressed',
        'Wash the dishes',
        'Make the bed',
        'Reply to one message',
        'Take out the rubbish',
      ],
      dose: '1 a day',
    },
    {
      type: 'Small pleasure',
      options: [
        'Listen to a favourite song',
        'Warm drink by the window',
        'Watch a short funny video',
        'Smell something pleasant (coffee, soap)',
      ],
      dose: '1 a day',
    },
    {
      type: 'Contact',
      options: ['Text one person', 'Short phone call', 'Say hello to a neighbour'],
      dose: '1 a day',
    },
    { type: 'Relax', // 'Body-scan audio' removed: there is no audio in the app.
      options: ['Progressive muscle relaxation'], dose: '10 min' },
  ],

  L2: [
    // MISSING: "Activity planning — Plan tomorrow: 1 enjoyable + …" (Daily,
    // 5 min). The board row is cut off in the export, so it is left out
    // rather than guessed. Add it verbatim when the full text arrives.
    {
      type: 'Structured exercise',
      // The four "... programme" options were removed: each implied a
      // structured plan the app does not provide.
      options: ['Nordic walking'],
      dose: '30–40 min, 3×/wk',
      note: 'Switch every 4 weeks',
    },
    {
      type: 'Green exercise',
      options: ['Forest walk', 'Park circuit workout', 'Stair or hill walk outdoors'],
      dose: '30–60 min, 1–2×/wk',
    },
    // REMOVED at your request: "Avoidance step — Do the easiest avoided
    // task for 10 min; move one step harder each week". On the board, not
    // in the app: the wording does not stand on its own as a card.
    // REMOVED: "Thinking skill" — worksheet names with no worksheet behind them.
    // REMOVED: "Sleep" — three rules in one sentence, and a six-week protocol
    // rather than a thing to do tonight.
    {
      type: 'Food',
      options: [
        'Add one food: vegetables, legumes, fish, nuts or whole grain',
        'Cook one simple meal from scratch',
      ],
      dose: '1 a day',
    },
  ],

  // MISSING: the whole L1 frame (PHQ-9 5–9) was not in the export. Nothing
  // is invented for it; suggestionsFor() falls back to L2's real activities
  // and says so, rather than writing new clinical content.
  L1: null,

  L0: [
    { type: 'Routine', options: ['Fixed wake time + morning daylight'], dose: 'Daily' },
    {
      type: 'Fitness',
      options: [
        'Jogging',
        'Outdoor bar workout',
        'A longer cycle ride',
        'A team sport',
        'A gym class',
        'Hill or stair intervals',
      ],
      dose: '150 min/wk, strength 2×/wk',
    },
    { type: 'Mind-body', options: ['Tai chi', 'Qigong', 'A full yoga class', 'Pilates'], dose: '1–2×/wk' },
    // REMOVED: "Relapse prevention" — an 8-week course the app cannot offer, gated on
    // a history the app does not know.
    { type: 'Learning', options: ['Learn a new skill', 'Start a project', 'Take a course'], dose: '1–2×/wk' },
    {
      type: 'Community',
      options: ['Volunteering', 'A sports club', 'A group hike', 'A choir'],
      dose: '1×/wk',
    },
    {
      type: 'Nature',
      options: ['Weekend hike', 'Day trip to a national park', 'Long forest walk'],
      dose: '1×/wk',
    },
    { type: 'Gratitude', options: ['3 good things', 'Write a thank-you message'], dose: '5 min, optional' },
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
 * Three suggestions for a score, rotated by the day.
 *
 * Both the types and the option within each type advance each day, so the
 * same card does not come round on consecutive days.
 */
export function suggestionsFor(score, { date = new Date(), count = 3 } = {}) {
  const level = levelForScore(score);
  const own = ACTIVITIES[level.id];
  // No invented content: a level we have no board data for borrows the
  // nearest real list and reports that it did.
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
