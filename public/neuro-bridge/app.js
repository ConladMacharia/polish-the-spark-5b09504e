(function () {
  "use strict";

  // ============================================================
  // Kenyan languages (42+). en/sw/ki have full UI translations;
  // others fall back to Swahili or English UI, with a friendly
  // native-name label on the picker.
  // ============================================================
  var languages = [
    { code: "en",     name: "English",              native: "English",         fallback: "en" },
    { code: "sw",     name: "Swahili",              native: "Kiswahili",       fallback: "sw" },
    { code: "ki",     name: "Gikuyu",               native: "Gĩkũyũ",          fallback: "ki" },
    { code: "luy",    name: "Luhya",                native: "Oluluhya",        fallback: "sw" },
    { code: "luo",    name: "Luo",                  native: "Dholuo",          fallback: "sw" },
    { code: "kam",    name: "Kamba",                native: "Kĩkamba",         fallback: "sw" },
    { code: "kln",    name: "Kalenjin",             native: "Kalenjin",        fallback: "sw" },
    { code: "kis",    name: "Kisii",                native: "Ekegusii",        fallback: "sw" },
    { code: "mer",    name: "Meru",                 native: "Kĩmĩrũ",          fallback: "sw" },
    { code: "emb",    name: "Embu",                 native: "Kĩembu",          fallback: "sw" },
    { code: "mij",    name: "Mijikenda",            native: "Kimijikenda",     fallback: "sw" },
    { code: "dig",    name: "Digo",                 native: "Chidigo",         fallback: "sw" },
    { code: "dug",    name: "Duruma",               native: "Chiduruma",       fallback: "sw" },
    { code: "nyf",    name: "Giryama",              native: "Kigiryama",       fallback: "sw" },
    { code: "swk",    name: "Bajuni",               native: "Kibajuni",        fallback: "sw" },
    { code: "pkm",    name: "Pokomo",               native: "Kipokomo",        fallback: "sw" },
    { code: "dav",    name: "Taita",                native: "Kidawida",        fallback: "sw" },
    { code: "seg",    name: "Segeju",               native: "Kisegeju",        fallback: "sw" },
    { code: "tur",    name: "Turkana",              native: "Ng’aturkana",     fallback: "sw" },
    { code: "mas",    name: "Maasai",               native: "Maa",             fallback: "sw" },
    { code: "saq",    name: "Samburu",              native: "Sampur",          fallback: "sw" },
    { code: "pko",    name: "Pokot",                native: "Pökoot",          fallback: "sw" },
    { code: "teo",    name: "Teso",                 native: "Ateso",           fallback: "sw" },
    { code: "kuj",    name: "Kuria",                native: "Igikuria",        fallback: "sw" },
    { code: "sqm",    name: "Suba",                 native: "Olusuba",         fallback: "sw" },
    { code: "som",    name: "Somali",               native: "Soomaali",        fallback: "en" },
    { code: "gax",    name: "Borana",               native: "Boraana",         fallback: "sw" },
    { code: "rel",    name: "Rendille",             native: "Rendille",        fallback: "sw" },
    { code: "gbz",    name: "Gabbra",               native: "Gabra",           fallback: "sw" },
    { code: "orc",    name: "Orma",                 native: "Orma",            fallback: "sw" },
    { code: "sgc",    name: "Kipsigis",             native: "Kipsigis",        fallback: "sw" },
    { code: "niq",    name: "Nandi",                native: "Nandi",           fallback: "sw" },
    { code: "enb",    name: "Marakwet",             native: "Markweeta",       fallback: "sw" },
    { code: "tug",    name: "Tugen",                native: "Tugen",           fallback: "sw" },
    { code: "spy",    name: "Sabaot",               native: "Sabaot",          fallback: "sw" },
    { code: "ter",    name: "Terik",                native: "Terik",           fallback: "sw" },
    { code: "oki",    name: "Ogiek",                native: "Ogiek",           fallback: "sw" },
    { code: "sgw",    name: "Sengwer",              native: "Sengwer",         fallback: "sw" },
    { code: "elm",    name: "El Molo",              native: "El Molo",         fallback: "sw" },
    { code: "yaa",    name: "Yaaku",                native: "Yaakunte",        fallback: "sw" },
    { code: "dah",    name: "Dahalo",               native: "Dahalo",          fallback: "sw" },
    { code: "bon",    name: "Boni / Aweer",         native: "Aweer",           fallback: "sw" },
    { code: "nub",    name: "Nubi",                 native: "Ki-Nubi",         fallback: "sw" },
    { code: "swa-sign", name: "Kenyan Sign Language", native: "KSL",           fallback: "en" },
  ];

  var storedLang = localStorage.getItem("neuroBridgeLanguage") || "en";
  var currentLang = languages.some(function (l) { return l.code === storedLang; }) ? storedLang : "en";

  // ============================================================
  // Exercise catalog — Physiotherapy (PT) and Occupational Therapy (OT).
  // Each entry maps a gamified activity to one of three AI tracking
  // engines: "arm" (upper limb), "leg" (lower limb), or "balance" (trunk).
  // ============================================================
  var catalog = [
    // ---------- Physiotherapy ----------
    { id: "arm",         cat: "pt", track: "arm",     icon: "🎈", promptKey: "armPrompt",     titleKey: "armTitle",     nameKey: "armRaise",       subKey: "armGameSub" },
    { id: "reach",       cat: "pt", track: "arm",     icon: "🍎", promptKey: "reachPrompt",   titleKey: "reachTitle",   nameKey: "reachName",      subKey: "reachSub" },
    { id: "shoulder",    cat: "pt", track: "arm",     icon: "🌀", promptKey: "shoulderPrompt",titleKey: "shoulderTitle",nameKey: "shoulderName",   subKey: "shoulderSub" },
    { id: "leg",         cat: "pt", track: "leg",     icon: "⭐", promptKey: "legPrompt",     titleKey: "legTitle",     nameKey: "legKick",        subKey: "legGameSub" },
    { id: "march",       cat: "pt", track: "leg",     icon: "🥁", promptKey: "marchPrompt",   titleKey: "marchTitle",   nameKey: "marchName",      subKey: "marchSub" },
    { id: "squat",       cat: "pt", track: "leg",     icon: "🏋️", promptKey: "squatPrompt",   titleKey: "squatTitle",   nameKey: "squatName",      subKey: "squatSub" },
    { id: "sitstand",    cat: "pt", track: "leg",     icon: "🪑", promptKey: "sitstandPrompt",titleKey: "sitstandTitle",nameKey: "sitstandName",   subKey: "sitstandSub" },
    { id: "bridge",      cat: "pt", track: "leg",     icon: "🌉", promptKey: "bridgePrompt",  titleKey: "bridgeTitle",  nameKey: "bridgeName",     subKey: "bridgeSub" },
    { id: "ankle",       cat: "pt", track: "leg",     icon: "🦶", promptKey: "anklePrompt",   titleKey: "ankleTitle",   nameKey: "ankleName",      subKey: "ankleSub" },
    { id: "balance",     cat: "pt", track: "balance", icon: "💎", promptKey: "balancePrompt", titleKey: "balanceTitle", nameKey: "balanceHold",    subKey: "balanceGameSub" },
    { id: "gait",        cat: "pt", track: "leg",     icon: "🚶", promptKey: "gaitPrompt",    titleKey: "gaitTitle",    nameKey: "gait",           subKey: "gaitSub" },
    { id: "trunk",       cat: "pt", track: "arm",     icon: "🌪️", promptKey: "trunkPrompt",   titleKey: "trunkTitle",   nameKey: "trunkName",      subKey: "trunkSub" },
    { id: "head",        cat: "pt", track: "balance", icon: "👀", promptKey: "headPrompt",    titleKey: "headTitle",    nameKey: "headName",       subKey: "headSub" },
    { id: "stretch",     cat: "pt", track: "balance", icon: "🧘", promptKey: "stretchPrompt", titleKey: "stretchTitle", nameKey: "stretchName",    subKey: "stretchSub" },
    { id: "crawl",       cat: "pt", track: "leg",     icon: "🐾", promptKey: "crawlPrompt",   titleKey: "crawlTitle",   nameKey: "crawlName",      subKey: "crawlSub" },

    // ---------- Occupational Therapy ----------
    { id: "pinch",       cat: "ot", track: "arm",     icon: "🤏", promptKey: "pinchPrompt",   titleKey: "pinchTitle",   nameKey: "pinchName",      subKey: "pinchSub" },
    { id: "catch",       cat: "ot", track: "arm",     icon: "🧤", promptKey: "catchPrompt",   titleKey: "catchTitle",   nameKey: "catchName",      subKey: "catchSub" },
    { id: "clap",        cat: "ot", track: "arm",     icon: "👏", promptKey: "clapPrompt",    titleKey: "clapTitle",    nameKey: "clapName",       subKey: "clapSub" },
    { id: "grip",        cat: "ot", track: "arm",     icon: "✊", promptKey: "gripPrompt",    titleKey: "gripTitle",    nameKey: "gripName",       subKey: "gripSub" },
    { id: "midline",     cat: "ot", track: "arm",     icon: "🔀", promptKey: "midlinePrompt", titleKey: "midlineTitle", nameKey: "midlineName",    subKey: "midlineSub" },
    { id: "draw",        cat: "ot", track: "arm",     icon: "✏️", promptKey: "drawPrompt",    titleKey: "drawTitle",    nameKey: "drawName",       subKey: "drawSub" },
    { id: "dress",       cat: "ot", track: "arm",     icon: "🧥", promptKey: "dressPrompt",   titleKey: "dressTitle",   nameKey: "dressName",      subKey: "dressSub" },
    { id: "feed",        cat: "ot", track: "arm",     icon: "🥄", promptKey: "feedPrompt",    titleKey: "feedTitle",    nameKey: "feedName",       subKey: "feedSub" },
    { id: "track",       cat: "ot", track: "balance", icon: "🎯", promptKey: "trackPrompt",   titleKey: "trackTitle",   nameKey: "trackName",      subKey: "trackSub" },
    { id: "simon",       cat: "ot", track: "arm",     icon: "🧠", promptKey: "simonPrompt",   titleKey: "simonTitle",   nameKey: "simonName",       subKey: "simonSub" },
    { id: "sensory",     cat: "ot", track: "arm",     icon: "🌈", promptKey: "sensoryPrompt", titleKey: "sensoryTitle", nameKey: "sensoryName",    subKey: "sensorySub" },
    { id: "bilateral",   cat: "ot", track: "arm",     icon: "🤝", promptKey: "bilatPrompt",   titleKey: "bilatTitle",   nameKey: "bilatName",      subKey: "bilatSub" },
  ];

  function catalogEntry(id) {
    for (var i = 0; i < catalog.length; i++) if (catalog[i].id === id) return catalog[i];
    return catalog[0];
  }

  var targetScore = 8;
  var currentExercise = "arm";
  var stream = null;
  var score = 0;
  var sessionStart = 0;
  var active = false;
  var demoMode = false;
  var previousFrame = null;
  var lastPose = null;
  var poseReady = false;
  var poseModel = null;
  var poseBusy = false;
  var animationId = 0;
  var demoTimer = 0;
  var lastSuccessAt = 0;
  var steadyStartedAt = 0;
  var targetSide = "left";
  var categoryFilter = "all"; // "all" | "pt" | "ot"
  // ---- Adaptive therapy engine state ----
  var repQualities = [];       // per-rep correctness 0-100
  var lastQuality = 0;         // most recent rep quality (for halo)
  var difficulty = 1;          // 1..5, adjusted dynamically
  var angleThreshold = {       // required angle in degrees to count a rep
    arm: 140,                  // shoulder flexion (higher = arm more raised)
    leg: 35,                   // hip flexion (higher = leg lifted more)
    balance: 1400,             // ms of stability required
    gait: 25,                  // knee flexion swing
  };
  var attempts = 0;            // frames evaluated since last rep (for DDA)

  var videoLibrary = {
    arm: "",
    leg: "https://video.wixstatic.com/video/8b93a1_efe5df88e0874702a476887b714ce922/1080p/mp4/file.mp4",
    balance: "",
    gait: "https://www.youtube.com/embed/o71yp4jZHH8",
  };

  // ============================================================
  // Translations. en/sw/ki are complete; other Kenyan languages
  // resolve via `fallback` in the language table above.
  // ============================================================
  var tx = {
    en: {
      chooseLanguage: "Choose a language to begin.",
      searchLanguage: "Search language…",
      langFallbackNote: "UI in English while translations for {lang} are being prepared.",
      homeTitle: "Therapy Home",
      startTherapy: "Start Therapy",
      startTherapySub: "Choose a therapy game",
      library: "Library",
      librarySub: "Reference videos and guides",
      progress: "Progress",
      progressSub: "View saved sessions",
      reminders: "Reminders",
      remindersSub: "Today’s plan",
      therapyGames: "Therapy games",
      chooseExercise: "Choose Exercise",
      catAll: "All",
      catPT: "Physiotherapy",
      catOT: "Occupational",
      cameraSetup: "Camera Setup",
      caregiverGuide: "Caregiver guide",
      safetyNote: "Stop if there is pain, dizziness, or unusual fatigue.",
      cameraHint: "Camera starts when you press Begin.",
      useDemo: "Use demo mode",
      begin: "Begin",
      voicePrompt: "Voice prompt",
      recalibrate: "Recalibrate",
      sessionComplete: "Session complete",
      rewards: "rewards",
      seconds: "seconds",
      seeProgress: "See progress",
      home: "Home",
      contentLibrary: "Content library",
      referenceVideos: "Reference Videos",
      videoPlaceholder: "Your reference video will appear here.",
      armLibraryCopy: "Guide for safe hand raising and shoulder-height reaching.",
      legLibraryCopy: "PT instruction: stand on the weaker leg, hold a rail, then kick with the other leg. Caregiver supports from behind if needed.",
      balanceLibraryCopy: "Reference for safe supported balance practice.",
      gaitLibraryCopy: "Reference for assisted walking and step training.",
      localProgress: "Local progress",
      recentSessions: "Recent Sessions",
      today: "Today",
      dailyPlan: "Daily therapy plan",
      dailyPlanCopy: "Complete one upper-limb, one lower-limb, and one balance session with caregiver support.",
      success: "Good job",
      complete: "Great work today.",
      waiting: "Waiting for movement",
      detected: "Movement detected",
      bodyMoving: "Large body movement ignored",
      reps: "rewards",
      gait: "Gait",

      // Exercise names & game copy
      armRaise: "Arm Raise", armGameSub: "Pop balloons by raising the hand.", armTitle: "Pop the balloons", armPrompt: "Raise your hand", armSetup: "Keep the upper body visible. The child raises the hand into the balloon zone.",
      reachName: "Reach & Grasp", reachSub: "Reach for the fruit on the tree.", reachTitle: "Reach the fruit", reachPrompt: "Reach up and grab", reachSetup: "Place a soft toy at shoulder height. The child reaches toward it.",
      shoulderName: "Shoulder Circles", shoulderSub: "Draw big circles in the air.", shoulderTitle: "Draw sky circles", shoulderPrompt: "Roll your shoulders", shoulderSetup: "Sit or stand tall. Roll the shoulders forward, up, back, and down.",
      legKick: "Leg Kick", legGameSub: "Kick toward the glowing side star.", legTitle: "Kick the stars", legPrompt: "Kick the glowing star", legSetup: "Stand on the weaker leg holding a rail. Kick the stars with the other leg.",
      marchName: "Marching", marchSub: "March to the drum beat.", marchTitle: "March to the beat", marchPrompt: "Lift your knees high", marchSetup: "Hold a chair for support. Lift each knee to hip height in time with the beat.",
      squatName: "Mini Squat", squatSub: "Squat to pick the apple.", squatTitle: "Pick the apple", squatPrompt: "Bend your knees", squatSetup: "Feet shoulder-width apart, hold a rail, bend the knees slightly then rise.",
      sitstandName: "Sit-to-Stand", sitstandSub: "Stand up to reach the sun.", sitstandTitle: "Reach the sun", sitstandPrompt: "Stand up tall", sitstandSetup: "Sit on a firm chair, feet flat. Stand up slowly, then sit back down.",
      bridgeName: "Bridge", bridgeSub: "Lift the bridge for the boat.", bridgeTitle: "Lift the bridge", bridgePrompt: "Lift your hips", bridgeSetup: "Lie on the back, knees bent. Slowly lift the hips to make a bridge.",
      ankleName: "Ankle Pumps", ankleSub: "Push the pedal up and down.", ankleTitle: "Pump the pedal", anklePrompt: "Point and flex your foot", ankleSetup: "Sit with legs out. Push the toes forward then pull them back.",
      balanceHold: "Balance Hold", balanceGameSub: "Stay steady to collect balance rings.", balanceTitle: "Hold balance", balancePrompt: "Stay steady", balanceSetup: "Full body visible. Child stays steady with caregiver nearby.",
      gaitSub: "Step forward with the beat.", gaitTitle: "Step by step", gaitPrompt: "Take a step forward", gaitSetup: "Clear a safe path. Take slow steps forward with support.",
      trunkName: "Trunk Twist", trunkSub: "Twist to catch the flying bird.", trunkTitle: "Catch the bird", trunkPrompt: "Twist your body", trunkSetup: "Sit tall. Twist the upper body left and right slowly.",
      headName: "Head Control", headSub: "Follow the moving star with your eyes.", headTitle: "Follow the star", headPrompt: "Look at the star", headSetup: "Support the child in sitting. Move a bright object slowly for them to track.",
      stretchName: "Gentle Stretch", stretchSub: "Hold the stretch like a tree.", stretchTitle: "Grow like a tree", stretchPrompt: "Hold the stretch", stretchSetup: "Slow assisted stretch of tight muscles. Hold each stretch 15–20 seconds.",
      crawlName: "Crawling", crawlSub: "Crawl to the finish line.", crawlTitle: "Crawl race", crawlPrompt: "Crawl on hands and knees", crawlSetup: "Clear a padded space. Encourage crawling toward a favourite toy.",
      pinchName: "Pinch & Pick", pinchSub: "Pinch small beads into the cup.", pinchTitle: "Fill the cup", pinchPrompt: "Pinch with fingers", pinchSetup: "Place beads/pom-poms on a tray. Child pinches with thumb and finger.",
      catchName: "Catch the Ball", catchSub: "Catch the falling ball.", catchTitle: "Catch the ball", catchPrompt: "Catch it!", catchSetup: "Toss a soft ball gently at chest height. Child catches with both hands.",
      clapName: "Clap Targets", clapSub: "Clap when the target glows.", clapTitle: "Clap the glow", clapPrompt: "Clap now", clapSetup: "Face the camera. Clap in front of the chest each time a target glows.",
      gripName: "Squeeze the Sponge", gripSub: "Squeeze to fill the meter.", gripTitle: "Fill the meter", gripPrompt: "Squeeze tightly", gripSetup: "Use a soft sponge or stress ball. Squeeze, hold 3 seconds, release.",
      midlineName: "Cross the Midline", midlineSub: "Reach across the body.", midlineTitle: "Cross over", midlinePrompt: "Reach across your body", midlineSetup: "Place targets on the opposite side of the body. Child reaches across midline.",
      drawName: "Draw the Shape", drawSub: "Trace the shape in the air.", drawTitle: "Sky drawing", drawPrompt: "Trace the shape", drawSetup: "Use a crayon on paper, or trace shapes in the air with a finger.",
      dressName: "Buttons & Zips", dressSub: "Practice buttons and zips.", dressTitle: "Get dressed", dressPrompt: "Button and zip", dressSetup: "Use a practice board with large buttons and zips.",
      feedName: "Spoon Balance", feedSub: "Carry the bead on the spoon.", feedTitle: "Steady spoon", feedPrompt: "Keep the spoon steady", feedSetup: "Place a small bead on a spoon. Child carries it without dropping.",
      trackName: "Eye Tracking", trackSub: "Follow the dot with your eyes.", trackTitle: "Follow the dot", trackPrompt: "Watch the dot", trackSetup: "Keep the head still. Follow a slow-moving object with the eyes only.",
      simonName: "Simon Says", simonSub: "Copy the move when Simon says.", simonTitle: "Simon says", simonPrompt: "Do what Simon says", simonSetup: "Caregiver calls out moves. Child copies only when Simon says.",
      sensoryName: "Texture Hunt", sensorySub: "Touch soft, hard, and bumpy.", sensoryTitle: "Feel the textures", sensoryPrompt: "Touch the texture", sensorySetup: "Prepare 3 textures (soft, rough, bumpy). Child touches each one.",
      bilatName: "Two-Hand Clap", bilatSub: "Use both hands together.", bilatTitle: "Both hands together", bilatPrompt: "Both hands together", bilatSetup: "Encourage using both hands together — clap, hold, or roll a ball.",
    },
    sw: {
      chooseLanguage: "Chagua lugha kuanza.",
      searchLanguage: "Tafuta lugha…",
      langFallbackNote: "Kiolesura kiko Kiswahili wakati tafsiri ya {lang} inaandaliwa.",
      homeTitle: "Nyumbani ya Tiba",
      startTherapy: "Anza Tiba",
      startTherapySub: "Chagua mchezo wa tiba",
      library: "Maktaba",
      librarySub: "Video na miongozo ya rejea",
      progress: "Maendeleo",
      progressSub: "Tazama vipindi vilivyohifadhiwa",
      reminders: "Vikumbusho",
      remindersSub: "Mpango wa leo",
      therapyGames: "Michezo ya tiba",
      chooseExercise: "Chagua Zoezi",
      catAll: "Yote", catPT: "Tiba viungo", catOT: "Ujuzi wa kila siku",
      cameraSetup: "Maandalizi ya Kamera",
      caregiverGuide: "Mwongozo wa mlezi",
      safetyNote: "Simamisha kama kuna maumivu, kizunguzungu, au uchovu usio wa kawaida.",
      cameraHint: "Kamera itaanza ukibonyeza Anza.",
      useDemo: "Tumia demo", begin: "Anza", voicePrompt: "Sauti ya maelekezo", recalibrate: "Panga upya",
      sessionComplete: "Kipindi kimekamilika", rewards: "zawadi", seconds: "sekunde", seeProgress: "Tazama maendeleo", home: "Nyumbani",
      contentLibrary: "Maktaba ya maudhui", referenceVideos: "Video za Rejea", videoPlaceholder: "Video yako ya rejea itaonekana hapa.",
      armLibraryCopy: "Mwongozo wa kuinua mkono kwa usalama hadi usawa wa bega.",
      legLibraryCopy: "Simama kwa mguu dhaifu na shika reli, kisha piga teke kwa mguu mwingine. Mlezi asaidie kwa nyuma ikihitajika.",
      balanceLibraryCopy: "Video ya mazoezi salama ya kushikilia mizani.",
      gaitLibraryCopy: "Rejea ya mafunzo ya kutembea kwa msaada.",
      localProgress: "Maendeleo ya kifaa hiki", recentSessions: "Vipindi vya Karibuni", today: "Leo",
      dailyPlan: "Mpango wa tiba wa kila siku",
      dailyPlanCopy: "Kamilisha zoezi moja la mkono, moja la mguu, na moja la mizani kwa msaada wa mlezi.",
      success: "Hongera", complete: "Kazi nzuri leo.", waiting: "Inasubiri mwendo", detected: "Mwendo umetambuliwa", bodyMoving: "Mwendo mkubwa umepuuzwa", reps: "zawadi",
      gait: "Mwendo wa Miguu",

      armRaise: "Kuinua Mkono", armGameSub: "Pasua baluni kwa kuinua mkono.", armTitle: "Pasua baluni", armPrompt: "Inua mkono", armSetup: "Sehemu ya juu ya mwili ionekane. Mtoto ainua mkono hadi eneo la baluni.",
      reachName: "Fikia na Kushika", reachSub: "Fikia matunda juu ya mti.", reachTitle: "Fikia tunda", reachPrompt: "Fikia juu ushike", reachSetup: "Weka toy laini kwenye usawa wa bega. Mtoto afikie kwa mkono.",
      shoulderName: "Mizunguko ya Bega", shoulderSub: "Chora duara angani.", shoulderTitle: "Chora duara", shoulderPrompt: "Zungusha mabega", shoulderSetup: "Kaa au simama vizuri. Zungusha mabega mbele, juu, nyuma, chini.",
      legKick: "Kupiga Teke", legGameSub: "Piga teke upande nyota inapoangaza.", legTitle: "Piga nyota", legPrompt: "Piga teke kuelekea nyota", legSetup: "Simama kwa mguu dhaifu ukishika reli. Piga nyota kwa mguu mwingine.",
      marchName: "Kutembea Kimoja", marchSub: "Tembea kwa mdundo.", marchTitle: "Tembea kwa mdundo", marchPrompt: "Inua magoti juu", marchSetup: "Shika kiti kwa msaada. Inua kila goti hadi kiuno kwa mdundo.",
      squatName: "Mini Squat", squatSub: "Inama uchukue tunda.", squatTitle: "Chukua tunda", squatPrompt: "Kunja magoti", squatSetup: "Miguu upana wa mabega, shika reli, kunja magoti kidogo kisha simama.",
      sitstandName: "Kaa-Simama", sitstandSub: "Simama kufikia jua.", sitstandTitle: "Fikia jua", sitstandPrompt: "Simama vizuri", sitstandSetup: "Kaa kwenye kiti kigumu, miguu chini. Simama polepole kisha kaa tena.",
      bridgeName: "Daraja", bridgeSub: "Inua daraja kwa mashua.", bridgeTitle: "Inua daraja", bridgePrompt: "Inua kiuno", bridgeSetup: "Lala mgongoni, magoti yamekunjwa. Inua kiuno taratibu.",
      ankleName: "Kusukuma Vifundo", ankleSub: "Sukuma pedali juu chini.", ankleTitle: "Sukuma pedali", anklePrompt: "Nyoosha na kunja mguu", ankleSetup: "Kaa miguu nyoofu. Sukuma vidole mbele kisha rudisha nyuma.",
      balanceHold: "Kushika Mizani", balanceGameSub: "Kaa imara kukusanya pete za mizani.", balanceTitle: "Shika mizani", balancePrompt: "Kaa imara", balanceSetup: "Mwili mzima uonekane. Mtoto akae imara akiwa salama.",
      gaitSub: "Piga hatua mbele kwa mdundo.", gaitTitle: "Hatua kwa hatua", gaitPrompt: "Piga hatua mbele", gaitSetup: "Weka njia salama. Piga hatua polepole ukiwa na msaada.",
      trunkName: "Mzungusho wa Kifua", trunkSub: "Zungusha kukamata ndege.", trunkTitle: "Kamata ndege", trunkPrompt: "Zungusha mwili", trunkSetup: "Kaa wima. Zungusha mwili wa juu kushoto na kulia polepole.",
      headName: "Udhibiti wa Kichwa", headSub: "Fuata nyota kwa macho.", headTitle: "Fuata nyota", headPrompt: "Tazama nyota", headSetup: "Mtoto akikaa akisaidiwa, sogeza kitu angavu polepole afuate kwa macho.",
      stretchName: "Kunyoosha Taratibu", stretchSub: "Shika mkao kama mti.", stretchTitle: "Kua kama mti", stretchPrompt: "Shika mkao", stretchSetup: "Kunyoosha polepole misuli iliyokaza. Shika kila kunyoosha sekunde 15–20.",
      crawlName: "Kutambaa", crawlSub: "Tambaa hadi mstari wa mwisho.", crawlTitle: "Mbio za kutambaa", crawlPrompt: "Tambaa kwa mikono na magoti", crawlSetup: "Weka sehemu laini. Himiza kutambaa kuelekea toy.",
      pinchName: "Bana na Chukua", pinchSub: "Bana shanga kuweka kikombeni.", pinchTitle: "Jaza kikombe", pinchPrompt: "Bana kwa vidole", pinchSetup: "Weka shanga kwenye trei. Mtoto abane kwa dole gumba na kidole.",
      catchName: "Kamata Mpira", catchSub: "Kamata mpira ukianguka.", catchTitle: "Kamata mpira", catchPrompt: "Kamata!", catchSetup: "Tupa mpira laini polepole kifuani. Mtoto akamate kwa mikono miwili.",
      clapName: "Piga Makofi Malengo", clapSub: "Piga makofi lengo linapoangaza.", clapTitle: "Piga makofi", clapPrompt: "Piga makofi sasa", clapSetup: "Elekea kamera. Piga makofi mbele ya kifua kila lengo linapoangaza.",
      gripName: "Kubana Sifongo", gripSub: "Bana kujaza kipimo.", gripTitle: "Jaza kipimo", gripPrompt: "Bana kwa nguvu", gripSetup: "Tumia sifongo laini. Bana, shika sekunde 3, achia.",
      midlineName: "Vuka Katikati", midlineSub: "Fikia upande wa pili.", midlineTitle: "Vuka", midlinePrompt: "Fikia upande wa pili", midlineSetup: "Weka malengo upande wa pili. Mtoto afikie akivuka katikati.",
      drawName: "Chora Umbo", drawSub: "Fuatilia umbo angani.", drawTitle: "Chora angani", drawPrompt: "Fuatilia umbo", drawSetup: "Tumia krayoni au chora angani kwa kidole.",
      dressName: "Vifungo na Zipu", dressSub: "Zoezea vifungo na zipu.", dressTitle: "Vaa nguo", dressPrompt: "Funga na fungua", dressSetup: "Tumia ubao wa mazoezi wenye vifungo vikubwa na zipu.",
      feedName: "Kijiko Imara", feedSub: "Beba shanga kwa kijiko.", feedTitle: "Kijiko imara", feedPrompt: "Kijiko kikae imara", feedSetup: "Weka shanga ndogo kwenye kijiko. Mtoto akibebe bila kuangusha.",
      trackName: "Kufuatilia kwa Macho", trackSub: "Fuata dodo kwa macho.", trackTitle: "Fuata dodo", trackPrompt: "Angalia dodo", trackSetup: "Kichwa kiwe kimya. Fuata kitu kinachosogea polepole kwa macho tu.",
      simonName: "Simon Anasema", simonSub: "Rudia Simon anaposema.", simonTitle: "Simon anasema", simonPrompt: "Fanya Simon anachosema", simonSetup: "Mlezi asema vitendo. Mtoto arudie tu Simon anaposema.",
      sensoryName: "Uchunguzi wa Miundo", sensorySub: "Gusa laini, gumu, na yenye matuta.", sensoryTitle: "Hisi miundo", sensoryPrompt: "Gusa mundo", sensorySetup: "Andaa miundo 3 (laini, gumu, matuta). Mtoto aguse kila moja.",
      bilatName: "Makofi ya Mikono Miwili", bilatSub: "Tumia mikono miwili pamoja.", bilatTitle: "Mikono miwili pamoja", bilatPrompt: "Mikono miwili pamoja", bilatSetup: "Himiza kutumia mikono miwili pamoja — kupiga makofi, kushika au kuviringisha mpira.",
    },
    ki: {
      chooseLanguage: "Thuura rũthiomi rwa kwambĩrĩria.",
      searchLanguage: "Caria rũthiomi…",
      langFallbackNote: "Kĩoneki gĩkĩrĩ na Gĩkũyũ o rĩrĩa tũrahaarĩria tarati ya {lang}.",
      homeTitle: "Mũciĩ wa Ũhonia",
      startTherapy: "Ambĩrĩria Ũhonia", startTherapySub: "Thuura thaka ya ũhonia",
      library: "Ngathĩti", librarySub: "Vidio na mĩtaratara ya kũrora",
      progress: "Ũthiĩ na Mbere", progressSub: "Rora ihinda iria ciahonoketio",
      reminders: "Ciugo cia Kũririkania", remindersSub: "Mũbango wa ũmũthĩ",
      therapyGames: "Thaka cia ũhonia", chooseExercise: "Thuura Mũthethania",
      catAll: "Ciothe", catPT: "Ũhonia wa mwĩrĩ", catOT: "Wĩra wa o mũthenya",
      cameraSetup: "Kũhaarĩria Kamera", caregiverGuide: "Mũtaaro wa mũmũmenyereri",
      safetyNote: "Tigithĩria angĩkorwo nĩ kũrĩ ruo, kĩrigicano, kana mũnoga mũnene.",
      cameraHint: "Kamera ĩkwambĩrĩria wahĩnyĩra Ambĩrĩria.",
      useDemo: "Hũthĩra mũthemba wa kuonania", begin: "Ambĩrĩria", voicePrompt: "Mũgambo wa mũtaaro", recalibrate: "Haarĩria Rĩngĩ",
      sessionComplete: "Ihinda nĩ rĩathira", rewards: "irathimo", seconds: "thekondi", seeProgress: "Rora ũthiĩ na mbere", home: "Mũciĩ",
      contentLibrary: "Ngathĩti ya maũndũ", referenceVideos: "Vidio cia Kũrora", videoPlaceholder: "Vidio yaku ya kũrora nĩyo ĩkuonekana haha.",
      armLibraryCopy: "Mũtaaro wa kũambararia guoko nginya ũhoro wa kĩande.",
      legLibraryCopy: "Rũgama na kũgũrũ kũrĩa kũhũthĩ, ũnyiitĩrĩre mũrarara, ũcoke ũringe njata na kũgũrũ kũngĩ.",
      balanceLibraryCopy: "Mũtaaro wa kũrũgama wega ũrĩ na ũteithio.",
      gaitLibraryCopy: "Vidio ya kũrora ya kwĩruta gũthiĩ na hatua.",
      localProgress: "Ũthiĩ na mbere wa ũyũ mũtambo", recentSessions: "Ihinda cia Mathaa", today: "Ũmũthĩ",
      dailyPlan: "Mũbango wa ũhonia wa o mũthenya",
      dailyPlanCopy: "Thondeka ũthethania ũmwe wa guoko, ũmwe wa kũgũrũ, na ũmwe wa kũrũgama wega.",
      success: "Wĩka wega", complete: "Wĩka wega mũno ũmũthĩ.", waiting: "Njetereire mwĩtĩkanio", detected: "Mwĩtĩkanio nĩ wonwo", bodyMoving: "Kũinaina kũnene gũtigĩtwo", reps: "irathimo",
      gait: "Mwĩtĩkanio wa Magũrũ",

      armRaise: "Kũambararia Guoko", armGameSub: "Tũraga mĩbũmbũ na kũambararia guoko.", armTitle: "Tũra mĩbũmbũ", armPrompt: "Ambararia guoko", armSetup: "Tigĩrĩra mwĩrĩ wa igũrũ wonekane. Mwana aambararie guoko nginya handũ ha mĩbũmbũ.",
      reachName: "Kũhũrũrũka na Kũnyiita", reachSub: "Hũrũrũka ũnyiite matunda mũtĩ-inĩ.", reachTitle: "Nyiita itunda", reachPrompt: "Nyita igũrũ", reachSetup: "Iga toy ya kĩande. Mwana aigue akũnyita.",
      shoulderName: "Mĩthiũrũrĩko ya Kĩande", shoulderSub: "Andĩka mĩthiũrũrĩko igũrũ.", shoulderTitle: "Andĩka igũrũ", shoulderPrompt: "Thiũrũrũkia makĩande", shoulderSetup: "Ikara kana rũgama wega. Thiũrũrũkia makĩande mbere, igũrũ, thutha, thĩ.",
      legKick: "Kũringa na Kũgũrũ", legGameSub: "Ringa na kũgũrũ kũrĩa njata ĩraara.", legTitle: "Ringa njata", legPrompt: "Ringa njata na kũgũrũ", legSetup: "Rũgama na kũgũrũ kũhũthĩ, ũnyiite mũrarara, ũringe njata na kũgũrũ kũngĩ.",
      marchName: "Kũrĩrĩmbũka", marchSub: "Rĩrĩmbũka na mũgambo.", marchTitle: "Rĩrĩmbũka", marchPrompt: "Ambararia maru igũrũ", marchSetup: "Nyiitĩrĩra gĩti. Ambararia iru rĩmwe rĩmwe nginya kĩanda.",
      squatName: "Kũinamĩria Kwanini", squatSub: "Inamĩrĩria unyiite itunda.", squatTitle: "Nyita itunda", squatPrompt: "Kunja maru", squatSetup: "Magũrũ ũrĩa ma kĩande, ũnyiite mũrarara, kunja maru kanini ũcoke ũrũgame.",
      sitstandName: "Ikara-Rũgama", sitstandSub: "Rũgama ũnyiite riũa.", sitstandTitle: "Nyiita riũa", sitstandPrompt: "Rũgama wega", sitstandSetup: "Ikara gĩtĩ-inĩ, magũrũ thĩ. Rũgama kahora ũcoke ũikare.",
      bridgeName: "Rĩrarara", bridgeSub: "Ambararia rĩrarara.", bridgeTitle: "Ambararia rĩrarara", bridgePrompt: "Ambararia njohe", bridgeSetup: "Kama mũgongo, maru mekunge. Ambararia njohe kahora.",
      ankleName: "Kũinaria Nyũgũto", ankleSub: "Kinyĩrĩria pedali igũrũ thĩ.", ankleTitle: "Kinyĩria pedali", anklePrompt: "Tambũrũkia na kũnja kũgũrũ", ankleSetup: "Ikara magũrũ matambũrũkĩte. Kinyĩrĩria ciara mbere ũcoke ũirihie.",
      balanceHold: "Kũrũgama Wega", balanceGameSub: "Ikara ũrũgamĩte wega ũcokanĩrĩrie mĩcĩrĩnga.", balanceTitle: "Rũgama wega", balancePrompt: "Ikara ũrũgamĩte", balanceSetup: "Mwĩrĩ wothe wonekane. Mwana akare arũgamĩte wega arĩ na ũteithio.",
      gaitSub: "Hatha mbere na mũgambo.", gaitTitle: "Hatha kũmũ hatha", gaitPrompt: "Hatha mbere", gaitSetup: "Iga njĩra njega. Hatha kahora na ũteithio.",
      trunkName: "Kũthiũrũka Nda", trunkSub: "Thiũrũka ũnyiite nyoni.", trunkTitle: "Nyiita nyoni", trunkPrompt: "Thiũrũka mwĩrĩ", trunkSetup: "Ikara wega. Thiũrũkia mwĩrĩ wa igũrũ mwena wa ũmotho na wa ũrĩo kahora.",
      headName: "Kũnyiitĩrĩra Mũtwe", headSub: "Rũmĩrĩra njata na maitho.", headTitle: "Rũmĩrĩra njata", headPrompt: "Cũthĩrĩria njata", headSetup: "Mwana aikarĩte akĩteithagio, hunja kĩndũ kĩrahenia kahora arũmĩrĩrie na maitho.",
      stretchName: "Kũtambũrũkia", stretchSub: "Ikara ũtambũrũkĩte ta mũtĩ.", stretchTitle: "Kũra ta mũtĩ", stretchPrompt: "Nyiita mũtambũrũko", stretchSetup: "Tambũrũkia kahora nyama ciohereire. Nyiita o mũtambũrũko thekondi 15–20.",
      crawlName: "Kũhũtha", crawlSub: "Hũtha nginya mũtaro-inĩ.", crawlTitle: "Ihenya cia kũhũtha", crawlPrompt: "Hũtha na moko na maru", crawlSetup: "Iga handũ ha kũhũtha ha ũhoro. Ĩrĩra mwana ahũthe nginya toy yake.",
      pinchName: "Nyiitĩrĩria Njeni", pinchSub: "Nyita njeni ũigĩrĩrĩre gĩkombe-inĩ.", pinchTitle: "Ĩyũria gĩkombe", pinchPrompt: "Nyiitĩrĩria na ciara", pinchSetup: "Iga njeni thĩinĩ wa trei. Mwana anyiite na kĩara na gĩkĩrũ.",
      catchName: "Nyiita Mũpĩra", catchSub: "Nyita mũpĩra ũkĩgũa.", catchTitle: "Nyiita mũpĩra", catchPrompt: "Nyiita!", catchSetup: "Ikĩrĩria mũpĩra mũhũthũ kahora nginya kĩfua-inĩ. Mwana anyiite na moko meerĩ.",
      clapName: "Hũra Ihũũra", clapSub: "Hũra hĩndĩ ĩrĩa handũ hakĩhenia.", clapTitle: "Hũra hakĩhenia", clapPrompt: "Hũra rĩu", clapSetup: "Rora kamera. Hũra ihũũra mbere ya kĩfua o hĩndĩ handũ hakahenia.",
      gripName: "Kũhũtha Sponji", gripSub: "Hũtha kũĩyũria mwĩgereri.", gripTitle: "Ĩyũria mwĩgereri", gripPrompt: "Hũtha na hinya", gripSetup: "Hũthĩra sponji ĩhũthũ. Hũtha, tũma thekondi 3, ũrekie.",
      midlineName: "Ringa Gatagatĩ", midlineSub: "Kinyĩrĩria mwena ũngĩ.", midlineTitle: "Ringa gatagatĩ", midlinePrompt: "Kinyĩria mwena ũngĩ", midlineSetup: "Iga malengo mwena ũngĩ wa mwĩrĩ. Mwana akinyĩrĩrie akiringaga gatagatĩ.",
      drawName: "Andĩka Mũthemba", drawSub: "Rũmĩrĩra mũthemba igũrũ.", drawTitle: "Kũandĩka igũrũ", drawPrompt: "Rũmĩrĩra mũthemba", drawSetup: "Hũthĩra kraioni thĩ ya karatathi kana andĩka rĩera-inĩ na kĩara.",
      dressName: "Mabatani na Zipu", dressSub: "Ĩrutĩra mabatani na zipu.", dressTitle: "Ĩhumbĩra", dressPrompt: "Oha na wohore", dressSetup: "Hũthĩra bao ya kwĩruta ĩrĩ na mabatani manene na zipu.",
      feedName: "Gĩko Kĩrũmu", feedSub: "Kua njeni na gĩko.", feedTitle: "Gĩko kĩrũmu", feedPrompt: "Nyiita gĩko kĩrũmu", feedSetup: "Iga njeni nini gĩko-inĩ. Mwana akue atarĩ kũgũithia.",
      trackName: "Gũthũngũrũria na Maitho", trackSub: "Rũmĩrĩra dodo na maitho.", trackTitle: "Rũmĩrĩra dodo", trackPrompt: "Rora dodo", trackSetup: "Mũtwe ũtige gũthiĩ. Rũmĩrĩria kĩndũ kĩrahũnja kahora na maitho tu.",
      simonName: "Simon Aroga", simonSub: "Rũmĩrĩra Simon oga.", simonTitle: "Simon aroga", simonPrompt: "Ĩka Simon aroga", simonSetup: "Mũmũmenyereri oge ciĩko. Mwana arũmĩrĩrie tu Simon aroga.",
      sensoryName: "Gũthethania Mĩthemba", sensorySub: "Hutia kĩhũthũ, kĩũmu na gĩkĩrĩ na matuta.", sensoryTitle: "Hutia mĩthemba", sensoryPrompt: "Hutia mũthemba", sensorySetup: "Haarĩria mĩthemba 3 (mĩhũthũ, mĩũmu, ĩrĩ na matuta). Mwana ahutie o ũmwe.",
      bilatName: "Ihũũra cia Moko Meerĩ", bilatSub: "Hũthĩra moko meerĩ hamwe.", bilatTitle: "Moko meerĩ hamwe", bilatPrompt: "Moko meerĩ hamwe", bilatSetup: "Ĩrĩra mwana ahũthĩre moko meerĩ hamwe — kũhũra ihũũra, kũnyiita kana kũviringithia mũpĩra.",
    },
  };

  // Auth handoff from React shell via URL hash: #patient=..&token=..&url=..&apikey=..&nav=..
  var authCtx = (function () {
    try {
      var h = window.location.hash.replace(/^#/, "");
      if (!h) return null;
      var p = new URLSearchParams(h);
      var ctx = {
        patientId: p.get("patient"),
        caregiverId: p.get("caregiver"),
        token: p.get("token"),
        url: p.get("url"),
        apikey: p.get("apikey"),
        nav: p.get("nav"),
      };
      if (ctx.token) sessionStorage.setItem("nbAuth", JSON.stringify(ctx));
      // Scrub hash so tokens don't linger in URL bar
      history.replaceState(null, "", window.location.pathname + window.location.search);
      return ctx;
    } catch (_) { return null; }
  })() || (function () {
    try { return JSON.parse(sessionStorage.getItem("nbAuth") || "null"); } catch (_) { return null; }
  })();

  function exerciseEnum(id) {
    if (id === "gait") return "gait";
    if (["balance", "head", "stretch"].indexOf(id) !== -1) return "balance_hold";
    if (["leg", "march", "squat", "sitstand", "bridge", "ankle", "crawl"].indexOf(id) !== -1) return "leg_kick";
    if (["arm", "reach", "shoulder", "trunk"].indexOf(id) !== -1) return "arm_raise";
    return "occupational";
  }

  function saveSessionRemote(payload) {
    if (!authCtx || !authCtx.token || !authCtx.url || !authCtx.patientId) return;
    try {
      fetch(authCtx.url + "/rest/v1/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": authCtx.apikey,
          "Authorization": "Bearer " + authCtx.token,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {});
    } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    renderLanguageGrid();
    renderExerciseGrid();
    applyTranslations();
    renderVideoSlots();
    if (authCtx && authCtx.nav) {
      setTimeout(function () { showScreen(authCtx.nav); }, 0);
    }
    document.addEventListener("click", function (event) {
      var go = event.target.closest("[data-go]");
      if (go) showScreen(go.dataset.go);
      var ex = event.target.closest("[data-exercise]");
      if (ex) selectExercise(ex.dataset.exercise);
      var lang = event.target.closest("[data-lang]");
      if (lang) {
        currentLang = lang.dataset.lang;
        localStorage.setItem("neuroBridgeLanguage", currentLang);
        applyTranslations();
        renderVideoSlots();
        renderExerciseGrid();
        showScreen("homeScreen");
      }
      var cat = event.target.closest("[data-cat]");
      if (cat) {
        categoryFilter = cat.dataset.cat;
        document.querySelectorAll("[data-cat]").forEach(function (c) {
          c.classList.toggle("active", c.dataset.cat === categoryFilter);
        });
        renderExerciseGrid();
      }
    });
    var searchInput = byId("languageSearch");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        renderLanguageGrid(searchInput.value);
      });
    }
    byId("beginSessionButton").addEventListener("click", function () { demoMode = false; beginSession(); });
    byId("demoModeButton").addEventListener("click", function () { demoMode = true; beginSession(); });
    byId("exitSessionButton").addEventListener("click", function () { endSession(false); showScreen("homeScreen"); });
    byId("speakButton").addEventListener("click", function () { speak(promptForExercise()); });
    byId("recalibrateButton").addEventListener("click", resetTracking);
    drawProgress();
  }

  function renderLanguageGrid(filter) {
    var grid = byId("languageGrid");
    if (!grid) return;
    var f = (filter || "").trim().toLowerCase();
    var list = languages.filter(function (l) {
      if (!f) return true;
      return (l.name + " " + l.native + " " + l.code).toLowerCase().indexOf(f) !== -1;
    });
    grid.innerHTML = list.map(function (l) {
      var isPrimary = l.code === "en" || l.code === "sw" || l.code === "ki";
      return '<button class="language-card ' + (isPrimary ? "primary-lang" : "") + '" data-lang="' + l.code + '">' +
        '<strong>' + l.native + '</strong>' +
        '<span>' + l.name + '</span>' +
        (isPrimary ? '<em class="lang-badge">Full translation</em>' : '') +
      '</button>';
    }).join("");
  }

  function renderExerciseGrid() {
    var grid = byId("exerciseGrid");
    if (!grid) return;
    var list = catalog.filter(function (e) {
      return categoryFilter === "all" || e.cat === categoryFilter;
    });
    grid.innerHTML = list.map(function (e) {
      return '<button class="exercise-card" data-exercise="' + e.id + '">' +
        '<span class="exercise-emoji">' + e.icon + '</span>' +
        '<strong>' + t(e.nameKey) + '</strong>' +
        '<small>' + t(e.subKey) + '</small>' +
        '<em class="ex-tag">' + (e.cat === "pt" ? t("catPT") : t("catOT")) + '</em>' +
      '</button>';
    }).join("");
  }

  function selectExercise(type) {
    currentExercise = type;
    var entry = catalogEntry(type);
    byId("setupExerciseLabel").textContent = t(entry.nameKey);
    byId("setupInstruction").textContent = t(entry.id + "Setup") || t(entry.track + "Setup") || "";
    showScreen("setupScreen");
    startCamera();
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(function (screen) {
      screen.classList.toggle("active", screen.id === id);
    });
    if (id === "progressScreen") drawProgress();
  }

  function applyTranslations() {
    var lang = getLanguage(currentLang);
    document.documentElement.lang = currentLang;
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      node.textContent = t(node.dataset.i18n);
    });
    var note = byId("langFallbackNote");
    if (note) {
      if (lang.fallback !== lang.code) {
        note.textContent = t("langFallbackNote").replace("{lang}", lang.native + " (" + lang.name + ")");
        note.classList.add("show");
      } else {
        note.classList.remove("show");
      }
    }
  }

  function renderVideoSlots() {
    Object.keys(videoLibrary).forEach(function (key) {
      var slot = byId(key + "VideoSlot");
      if (!slot) return;
      var src = videoLibrary[key];
      if (!src) {
        slot.setAttribute("data-i18n", "videoPlaceholder");
        slot.textContent = t("videoPlaceholder");
        return;
      }
      slot.removeAttribute("data-i18n");
      if (/youtube\.com\/embed|player\.vimeo/i.test(src)) {
        slot.innerHTML = '<iframe title="' + key + ' reference video" src="' + src + '" loading="lazy" allowfullscreen></iframe>';
      } else if (/\.mp4($|\?)/i.test(src)) {
        slot.innerHTML = '<video controls playsinline src="' + src + '"></video>';
      } else if (/youtube|youtu\.be|vimeo|https?:\/\//i.test(src)) {
        slot.innerHTML = '<a class="video-link" href="' + src + '" target="_blank" rel="noreferrer">Open video</a>';
      } else {
        slot.innerHTML = '<video controls playsinline src="' + src + '"></video>';
      }
    });
  }

  function beginSession() {
    startCamera().then(function () {
      var entry = catalogEntry(currentExercise);
      score = 0;
      active = true;
      sessionStart = Date.now();
      byId("scoreCount").textContent = score;
      byId("targetCount").textContent = targetScore;
      byId("sessionTypeLabel").textContent = t(entry.nameKey);
      byId("sessionTitle").textContent = t(entry.titleKey);
      byId("promptBubble").textContent = promptForExercise();
      byId("motionReadout").textContent = t("waiting");
      resetTracking();
      renderTarget();
      showScreen("sessionScreen");
      speak(promptForExercise());
      if (demoMode || !stream) runDemoMode();
      else animationId = requestAnimationFrame(trackMotion);
    });
  }

  function startCamera() {
    if (stream) return Promise.resolve(true);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      byId("cameraStatus").textContent = "Camera unavailable. Demo mode is ready.";
      return Promise.resolve(false);
    }
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }).then(function (s) {
      stream = s;
      byId("setupVideo").srcObject = stream;
      byId("sessionVideo").srcObject = stream;
      byId("cameraStatus").textContent = "Camera ready. Pose detection warming up…";
      initPoseModel();
      warmupPose();
      return true;
    }).catch(function () {
      byId("cameraStatus").textContent = "Camera permission unavailable. Use demo mode.";
      return false;
    });
  }

  function warmupPose() {
    var video = byId("setupVideo");
    var tick = function () {
      if (!stream) return;
      if (poseModel && !poseBusy && video.readyState >= 2) {
        poseBusy = true;
        poseModel.send({ image: video }).catch(function () { poseBusy = false; });
      }
      if (poseReady) byId("cameraStatus").textContent = "Pose detection active. Ready to begin.";
      setTimeout(tick, 120);
    };
    tick();
  }

  function initPoseModel() {
    if (poseModel || !window.Pose) return;
    poseModel = new Pose({
      locateFile: function (file) { return "https://cdn.jsdelivr.net/npm/@mediapipe/pose/" + file; },
    });
    poseModel.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    poseModel.onResults(function (results) {
      if (results.poseLandmarks) { lastPose = results.poseLandmarks; poseReady = true; }
      poseBusy = false;
    });
  }

  function resetTracking() {
    previousFrame = null;
    lastPose = null;
    poseReady = false;
    steadyStartedAt = 0;
    lastSuccessAt = Date.now();
    repQualities = [];
    lastQuality = 0;
    difficulty = 1;
    attempts = 0;
  }

  function renderTarget() {
    var layer = byId("targetLayer");
    var entry = catalogEntry(currentExercise);
    layer.className = entry.track + "-targets";
    var halo = lastQuality >= 80 ? "halo-good" : lastQuality >= 50 ? "halo-mid" : lastQuality > 0 ? "halo-low" : "";
    if (entry.track === "arm") layer.innerHTML = '<div class="target-zone top-zone">' + entry.icon + ' ' + t(entry.titleKey) + '</div><div class="balloon reward-object ' + halo + '">' + entry.icon + '</div>';
    else if (entry.track === "leg") {
      targetSide = Math.random() > 0.5 ? "right" : "left";
      layer.innerHTML = '<div class="star-target ' + targetSide + ' ' + halo + '">' + entry.icon + '</div>';
    } else {
      layer.innerHTML = '<div class="balance-ring reward-object ' + halo + '">' + entry.icon + '</div>';
    }
  }

  function trackMotion() {
    if (!active) return;
    var entry = catalogEntry(currentExercise);
    var video = byId("sessionVideo");
    var canvas = byId("trackingCanvas");
    if (!video || video.readyState < 2) { animationId = requestAnimationFrame(trackMotion); return; }
    var w = 180, h = 135;
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    var current = ctx.getImageData(0, 0, w, h).data;
    if (poseModel && !poseBusy) {
      poseBusy = true;
      poseModel.send({ image: video }).catch(function () { poseBusy = false; });
    }
    if (!previousFrame) { previousFrame = current.slice(0); animationId = requestAnimationFrame(trackMotion); return; }

    var evaln = evaluateRep(entry.track);
    var pixelDetected = false;
    if (entry.track === "arm" && !poseReady) pixelDetected = detectExerciseMotion(current, previousFrame, w, h, entry.track);

    var readout = poseReady
      ? (evaln.cue || (evaln.passed ? t("detected") : t("waiting")))
      : "Loading pose model…";
    var qPct = Math.round(evaln.quality);
    byId("motionReadout").textContent = readout + (poseReady ? "  ·  " + qPct + "%" : "");

    if ((evaln.passed || pixelDetected) && Date.now() - lastSuccessAt > 1300) {
      registerSuccess(evaln.passed ? evaln.quality : 60);
    }
    previousFrame = current.slice(0);
    attempts++;
    animationId = requestAnimationFrame(trackMotion);
  }

  function detectExerciseMotion(current, previous, w, h, track) {
    if (track === "arm") return regionScore(current, previous, w, 0.08, 0.92, 0.06, 0.38) > 4.8 && regionScore(current, previous, w, 0.25, 0.75, 0.45, 0.92) < 3.2;
    return false;
  }

  // ---- Joint-angle helpers ----
  function angleAt(a, b, c) {
    if (!a || !b || !c) return 0;
    var abx = a.x - b.x, aby = a.y - b.y;
    var cbx = c.x - b.x, cby = c.y - b.y;
    var dot = abx * cbx + aby * cby;
    var mag = Math.sqrt(abx * abx + aby * aby) * Math.sqrt(cbx * cbx + cby * cby);
    if (mag === 0) return 0;
    var cos = Math.max(-1, Math.min(1, dot / mag));
    return Math.acos(cos) * 180 / Math.PI;
  }

  // Returns { passed, quality (0-100), cue }
  function evaluateRep(track) {
    if (!poseReady || !lastPose) return { passed: false, quality: 0, cue: "" };
    var lShoulder = landmark(11), rShoulder = landmark(12);
    var lElbow = landmark(13), rElbow = landmark(14);
    var lWrist = landmark(15), rWrist = landmark(16);
    var lHip = landmark(23), rHip = landmark(24);
    var lKnee = landmark(25), rKnee = landmark(26);
    var lAnkle = landmark(27), rAnkle = landmark(28);

    if (track === "arm") {
      // Shoulder flexion = angle at shoulder between hip and wrist. Higher is better.
      var leftAng = visible(lShoulder, lWrist) && lHip ? angleAt(lHip, lShoulder, lWrist) : 0;
      var rightAng = visible(rShoulder, rWrist) && rHip ? angleAt(rHip, rShoulder, rWrist) : 0;
      var best = Math.max(leftAng, rightAng);
      var thr = angleThreshold.arm;
      var quality = Math.max(0, Math.min(100, ((best - 60) / (170 - 60)) * 100));
      var cue = "";
      if (best < thr - 30) cue = t("waiting") + " — raise arm higher";
      else if (best < thr) cue = "Almost there — reach up";
      // Elbow straightness bonus
      var elbowAng = leftAng > rightAng
        ? angleAt(lShoulder, lElbow, lWrist)
        : angleAt(rShoulder, rElbow, rWrist);
      if (elbowAng && elbowAng < 140) { quality *= 0.85; cue = cue || "Keep elbow straighter"; }
      return { passed: best >= thr, quality: quality, cue: cue };
    }

    if (track === "leg" || track === "gait") {
      // Hip flexion at kicking leg; support hip stable.
      var kickAnkle = targetSide === "left" ? lAnkle : rAnkle;
      var kickKnee = targetSide === "left" ? lKnee : rKnee;
      var kickHip = targetSide === "left" ? lHip : rHip;
      var oppShoulder = targetSide === "left" ? lShoulder : rShoulder;
      if (!visible(kickAnkle, kickKnee) || !kickHip) return { passed: false, quality: 0, cue: "Step into camera view" };
      var hipAng = angleAt(oppShoulder, kickHip, kickKnee); // torso-to-thigh
      var kneeAng = angleAt(kickHip, kickKnee, kickAnkle);
      var thrL = track === "gait" ? angleThreshold.gait : angleThreshold.leg;
      // Convert: standing hip angle ~170°, lifted leg lowers it. Use flexion = 180 - hipAng.
      var flex = 180 - hipAng;
      var quality2 = Math.max(0, Math.min(100, (flex / 60) * 100));
      var torsoStable = visible(lHip, rHip) ? Math.abs(lHip.y - rHip.y) < 0.10 : true;
      var cue2 = "";
      if (!torsoStable) { quality2 *= 0.7; cue2 = "Keep hips level"; }
      if (kneeAng < 140 && track !== "gait") { quality2 *= 0.9; cue2 = cue2 || "Extend the knee"; }
      if (flex < thrL - 15) cue2 = cue2 || "Lift the leg higher";
      return { passed: flex >= thrL && torsoStable, quality: quality2, cue: cue2 };
    }

    if (track === "balance") {
      var level = visible(lShoulder, rShoulder) && visible(lHip, rHip);
      if (!level) return { passed: false, quality: 0, cue: "Face the camera" };
      var shoulderTilt = Math.abs(lShoulder.y - rShoulder.y);
      var hipTilt = Math.abs(lHip.y - rHip.y);
      var midDrift = Math.abs(((lShoulder.x + rShoulder.x) / 2) - ((lHip.x + rHip.x) / 2));
      var stable = shoulderTilt < 0.10 && hipTilt < 0.10 && midDrift < 0.16;
      if (!stable) { steadyStartedAt = 0; return { passed: false, quality: Math.max(0, 100 - (shoulderTilt + hipTilt + midDrift) * 300), cue: "Center your weight" }; }
      if (!steadyStartedAt) steadyStartedAt = Date.now();
      var held = Date.now() - steadyStartedAt;
      var qB = Math.max(0, Math.min(100, (held / angleThreshold.balance) * 100));
      return { passed: held > angleThreshold.balance, quality: qB, cue: held < angleThreshold.balance ? "Hold steady…" : "" };
    }
    return { passed: false, quality: 0, cue: "" };
  }

  function landmark(i) { return lastPose && lastPose[i]; }
  function visible(a, b) { return a && b && (a.visibility === undefined || a.visibility > 0.35) && (b.visibility === undefined || b.visibility > 0.35); }

  function regionScore(current, previous, w, x1, x2, y1, y2) {
    var h = current.length / 4 / w;
    var changed = 0, total = 0;
    for (var y = Math.floor(h * y1); y < Math.floor(h * y2); y += 3) {
      for (var x = Math.floor(w * x1); x < Math.floor(w * x2); x += 3) {
        var i = (y * w + x) * 4;
        var diff = Math.abs(current[i] - previous[i]) + Math.abs(current[i + 1] - previous[i + 1]) + Math.abs(current[i + 2] - previous[i + 2]);
        if (diff > 62) changed++;
        total++;
      }
    }
    return (changed / Math.max(total, 1)) * 100;
  }

  function registerSuccess(quality) {
    lastSuccessAt = Date.now();
    steadyStartedAt = 0;
    var q = Math.max(0, Math.min(100, Math.round(quality || 60)));
    repQualities.push(q);
    lastQuality = q;
    score++;
    byId("scoreCount").textContent = score;
    burstTarget();
    adjustDifficulty();
    speak(score >= targetScore ? t("complete") : t("success"));
    if (score >= targetScore) setTimeout(function () { endSession(true); }, 700);
    else setTimeout(renderTarget, 450);
  }

  // Dynamic Difficulty Adjustment: every 3 reps, tune threshold to keep
  // caregiver in a productive challenge zone (avg 60-80% quality).
  function adjustDifficulty() {
    if (repQualities.length < 3 || repQualities.length % 3 !== 0) return;
    var recent = repQualities.slice(-3);
    var avg = (recent[0] + recent[1] + recent[2]) / 3;
    var track = catalogEntry(currentExercise).track;
    var step = track === "balance" ? 150 : 4;
    var key = track === "gait" ? "gait" : track;
    if (avg >= 85 && difficulty < 5) {
      angleThreshold[key] += step;
      difficulty++;
      byId("motionReadout").textContent = "Great form — leveling up (L" + difficulty + ")";
    } else if (avg < 45 && difficulty > 1) {
      angleThreshold[key] = Math.max(step, angleThreshold[key] - step);
      difficulty--;
      byId("motionReadout").textContent = "Easing up a bit (L" + difficulty + ")";
    }
  }

  function burstTarget() {
    var obj = document.querySelector("#targetLayer .reward-object, #targetLayer .star-target");
    if (obj) obj.classList.add("burst");
  }

  function runDemoMode() {
    clearInterval(demoTimer);
    demoTimer = setInterval(function () {
      if (!active) return clearInterval(demoTimer);
      registerSuccess(70 + Math.random() * 25);
    }, 1300);
  }

  function endSession(save) {
    active = false;
    clearInterval(demoTimer);
    cancelAnimationFrame(animationId);
    if (!save) return;
    var duration = Math.max(1, Math.round((Date.now() - sessionStart) / 1000));
    var sessions = getSessions();
    var completed = score >= targetScore;
    var earnedBadges = computeBadges(score, targetScore, duration, completed);
    var entry = catalogEntry(currentExercise);
    sessions.push({ date: new Date().toISOString(), exercise: t(entry.nameKey), score: score, target: targetScore, duration: duration, completed: completed, badges: earnedBadges });
    localStorage.setItem("neuroBridgeSessions", JSON.stringify(sessions.slice(-12)));
    var startedAt = new Date(sessionStart || Date.now() - duration * 1000).toISOString();
    saveSessionRemote({
      patient_id: authCtx && authCtx.patientId,
      caregiver_id: authCtx && authCtx.caregiverId,
      exercise: exerciseEnum(currentExercise),
      exercise_slug: currentExercise,
      reps_target: targetScore,
      reps_completed: score,
      completion_pct: Math.min(100, Math.round((score / Math.max(1, targetScore)) * 100)),
      avg_correctness: Math.min(100, Math.round((score / Math.max(1, targetScore)) * 100)),
      duration_seconds: duration,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      language: currentLang,
    });
    byId("resultSummary").textContent = completed ? t("complete") : "Session ended early. Every try counts!";
    byId("resultScore").textContent = score;
    byId("resultTime").textContent = duration;
    renderRewards(earnedBadges, completed);
    showScreen("resultScreen");
    if (completed) speak(t("success") + "! " + t("complete"));
  }

  function computeBadges(score, target, duration, completed) {
    var badges = [];
    if (completed) badges.push({ icon: "🏆", label: "Goal reached" });
    if (score >= Math.ceil(target / 2)) badges.push({ icon: "⭐", label: "Halfway hero" });
    if (completed && duration <= 60) badges.push({ icon: "⚡", label: "Speedy" });
    if (completed && duration >= 90) badges.push({ icon: "💪", label: "Stamina" });
    var streak = (getSessions().filter(function (s) { return s.completed; }).length + (completed ? 1 : 0));
    if (streak >= 3) badges.push({ icon: "🔥", label: "On a streak" });
    if (!badges.length) badges.push({ icon: "🌱", label: "Great effort" });
    return badges;
  }

  function renderRewards(badges, completed) {
    var wrap = byId("rewardBadges");
    if (!wrap) return;
    wrap.innerHTML = badges.map(function (b) {
      return '<div class="reward-badge"><span class="reward-icon">' + b.icon + '</span><small>' + b.label + '</small></div>';
    }).join("");
    var cel = document.querySelector(".celebration");
    if (cel) cel.textContent = completed ? "🎉" : "💫";
  }

  function drawProgress() {
    var sessions = getSessions();
    var list = byId("progressList");
    list.innerHTML = sessions.length
      ? sessions.slice().reverse().map(function (s) {
          var pct = Math.round((s.score / Math.max(s.target, 1)) * 100);
          return '<div class="progress-item"><div><strong>' + new Date(s.date).toLocaleDateString() + '</strong><small> · ' + s.exercise + '</small></div><span class="pill">' + s.score + '/' + s.target + ' · ' + pct + '%</span></div>';
        }).join("")
      : '<div class="progress-item empty">No sessions yet — complete an exercise to see progress.</div>';

    var canvas = byId("progressChart");
    var ctx = canvas.getContext("2d");
    var W = canvas.width, H = canvas.height;
    var padL = 56, padR = 24, padT = 28, padB = 46;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#152238"; ctx.font = "700 16px Arial, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Reward score per session", padL, 18);
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1;
    ctx.font = "600 11px Arial, sans-serif"; ctx.fillStyle = "#64748b"; ctx.textAlign = "right";
    var ySteps = 4;
    for (var g = 0; g <= ySteps; g++) {
      var y = padT + (plotH * g) / ySteps;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      var val = Math.round(targetScore * (1 - g / ySteps));
      ctx.fillText(String(val), padL - 8, y + 4);
    }
    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(W - padR, padT + plotH); ctx.stroke();
    if (!sessions.length) {
      ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center"; ctx.font = "700 14px Arial, sans-serif";
      ctx.fillText("No data yet", padL + plotW / 2, padT + plotH / 2); return;
    }
    var n = sessions.length; var slot = plotW / n; var barW = Math.min(48, slot * 0.6);
    sessions.forEach(function (s, i) {
      var cx = padL + slot * i + slot / 2;
      var barH = (Math.min(s.score, targetScore) / targetScore) * plotH;
      var by = padT + plotH - barH;
      ctx.fillStyle = s.score >= s.target ? "#23b7a7" : "#65a5ff";
      ctx.fillRect(cx - barW / 2, by, barW, barH);
      ctx.fillStyle = "#64748b"; ctx.font = "600 11px Arial, sans-serif"; ctx.textAlign = "center";
      var d = new Date(s.date);
      ctx.fillText((d.getMonth() + 1) + "/" + d.getDate(), cx, padT + plotH + 16);
      ctx.fillStyle = "#152238"; ctx.font = "700 11px Arial, sans-serif"; ctx.fillText(String(s.score), cx, by - 6);
    });
    ctx.strokeStyle = "#ff6b6b"; ctx.lineWidth = 2.5; ctx.beginPath();
    sessions.forEach(function (s, i) {
      var cx = padL + slot * i + slot / 2;
      var yy = padT + plotH - (Math.min(s.score, targetScore) / targetScore) * plotH;
      if (i === 0) ctx.moveTo(cx, yy); else ctx.lineTo(cx, yy);
    });
    ctx.stroke();
  }

  function getSessions() {
    try { return JSON.parse(localStorage.getItem("neuroBridgeSessions")) || []; } catch (e) { return []; }
  }

  function promptForExercise() {
    var entry = catalogEntry(currentExercise);
    return t(entry.promptKey);
  }

  function getLanguage(code) {
    for (var i = 0; i < languages.length; i++) if (languages[i].code === code) return languages[i];
    return languages[0];
  }

  function speak(text) {
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var lang = getLanguage(currentLang);
      // Native BCP-47 tag if available; otherwise use fallback locale for phonetic delivery.
      var speechLang = lang.fallback === "en" ? "en-US" : "sw-KE";
      u.lang = speechLang;
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function t(key) {
    var lang = getLanguage(currentLang);
    var primary = tx[lang.code];
    if (primary && primary[key]) return primary[key];
    var fb = tx[lang.fallback];
    if (fb && fb[key]) return fb[key];
    return tx.en[key] || key;
  }

  function byId(id) { return document.getElementById(id); }
})();
