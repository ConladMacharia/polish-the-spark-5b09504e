/**
 * English source strings for the React app. Every other language is a
 * translation of this object (see src/lib/i18n/locales/*.json).
 * Placeholders in {braces} must be preserved by translations.
 */
export const EN_STRINGS = {
  // --- Settings / language picker ---
  settings: "Settings",
  language: "Language",
  languageSubtitle: "Choose the language for the whole app, including voice prompts.",
  searchLanguage: "Search language…",
  currentLanguage: "Current",
  reviewedTranslation: "Reviewed translation",
  communityTranslation: "Community translation — help us improve it.",
  kslNote: "Kenyan Sign Language has no written form, so text stays in English.",
  done: "Done",
  languageChanged: "Language set to {lang}",

  // --- Shared ---
  signOut: "Sign out",
  home: "Home",
  close: "Close",
  loading: "Loading…",

  // --- Dual mode bar ---
  caregiverUx: "Caregiver view",
  childUx: "Child's view",

  // --- Caregiver home ---
  greeting: "Welcome, {name}",
  todayPlanReady: "Today's plan is ready",
  planSummary: "3 exercises · about 12 min",
  todaysMission: "TODAY'S MISSION",
  startTodaySession: "Start today's session",
  sessionDescription: "Arm Raise, Leg Kick and Balance Hold — guided step by step.",
  threeExercises: "3 exercises",
  twelveMinutes: "about 12 min",
  gmfcsBadge: "GMFCS II",
  beginSession: "Begin session",
  yourToolkit: "Your toolkit",
  exerciseLibrary: "Live session",
  exerciseLibrarySub: "Do the move",
  trainingFilms: "Training videos",
  trainingFilmsSub: "Learn the move",
  lastSession: "Last session",
  lastSessionValue: "Yesterday · 4/5 · Great form",
  tip: "Tip",
  tipTitle: "Set up beside your child",
  tipBody:
    "Prop the phone so the whole body is visible. Pause if there is pain or unusual tiredness.",
  ageLabel: "age 6",

  // --- Child mode ---
  childWorldTitle: "{name}'s World!",
  childWorldSub: "Ready for today's superhero moves?",
  starsEarned: "25 STARS EARNED THIS WEEK",
  play: "PLAY!",
  gamePopBalloons: "Pop the Balloons!",
  gamePopBalloonsSub: "Raise arms high to reach the sky",
  gameKickStar: "Kick the Star!",
  gameKickStarSub: "Super leg kicks into outer space",
  gameStatue: "Statue Power!",
  gameStatueSub: "Hold steady like a magic statue",

  // --- Exercise library ---
  libraryEyebrow: "Library",
  libraryTitle: "Exercise library",
  librarySubtitle:
    "Full CP reference catalog ({pt} physiotherapy + {ot} occupational therapy exercises).",
  filterAll: "All ({count})",
  filterPhysio: "Physiotherapy ({count})",
  filterOccupational: "Occupational ({count})",
  searchExercises: "Search exercises…",
  allExercises: "All exercises ({count})",
  aiTracked: "AI tracked",
  physiotherapy: "Physiotherapy",
  occupational: "Occupational",
  tapForDetails: "Tap to view details",
  noExercisesMatch: "No exercises match your search.",
  footageMissing: "Footage not yet added",
  footageMissingSub: "This slot is ready — upload or record the demo video for this move.",
  clinicalBenefit: "Clinical benefit:",
  startTherapyGame: "Start therapy game",
} as const;

export type StringKey = keyof typeof EN_STRINGS;
export type StringBundle = Partial<Record<StringKey, string>>;
