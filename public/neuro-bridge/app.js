(function () {
  "use strict";

  var targetScore = 8;
  var currentLang = localStorage.getItem("neuroBridgeLanguage") || "en";
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

  var videoLibrary = {
    arm: "",
    leg: "https://video.wixstatic.com/video/8b93a1_efe5df88e0874702a476887b714ce922/1080p/mp4/file.mp4",
    balance: "",
    gait: "https://www.youtube.com/embed/o71yp4jZHH8",
  };

  var tx = {
    en: {
      chooseLanguage: "Choose a language to begin.",
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
      armRaise: "Arm Raise",
      legKick: "Leg Kick",
      balanceHold: "Balance Hold",
      armGameSub: "Pop balloons by raising the hand.",
      legGameSub: "Kick toward the glowing side star.",
      balanceGameSub: "Stay steady to collect balance rings.",
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
      legLibraryCopy: "PT instruction: stand on the weak leg, support with the weak arm on a rail, then attempt to kick the stars with the other leg. The caregiver supports from behind if needed.",
      balanceLibraryCopy: "Gait and balance reference video for safe supported balance practice.",
      localProgress: "Local progress",
      recentSessions: "Recent Sessions",
      today: "Today",
      dailyPlan: "Daily therapy plan",
      dailyPlanCopy: "Complete one arm, one leg, and one balance session with caregiver support.",
      armSetup: "Keep the upper body visible. The child raises the hand into the balloon zone.",
      legSetup: "Stand on the weak leg and support with the weak arm on a rail. Kick the stars with the other leg while the caregiver supports from behind if needed.",
      balanceSetup: "Keep the full body visible. The child stays steady while supported safely.",
      armTitle: "Pop the balloons",
      legTitle: "Kick the stars",
      balanceTitle: "Hold balance",
      armPrompt: "Raise your hand",
      legPrompt: "Kick the glowing star",
      balancePrompt: "Stay steady",
      success: "Good job",
      complete: "Great work today.",
      waiting: "Waiting for movement",
      detected: "Movement detected",
      bodyMoving: "Large body movement ignored",
      reps: "rewards",
      gait: "Gait",
      gaitLibraryCopy: "Reference for assisted walking and step training.",
    },
    sw: {
      chooseLanguage: "Chagua lugha kuanza.",
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
      armRaise: "Kuinua Mkono",
      legKick: "Kupiga Teke",
      balanceHold: "Kushika Mizani",
      armGameSub: "Pasua baluni kwa kuinua mkono.",
      legGameSub: "Piga teke upande nyota inapoangaza.",
      balanceGameSub: "Kaa imara kukusanya pete za mizani.",
      cameraSetup: "Maandalizi ya Kamera",
      caregiverGuide: "Mwongozo wa mlezi",
      safetyNote: "Simamisha kama kuna maumivu, kizunguzungu, au uchovu usio wa kawaida.",
      cameraHint: "Kamera itaanza ukibonyeza Anza.",
      useDemo: "Tumia demo",
      begin: "Anza",
      voicePrompt: "Sauti ya maelekezo",
      recalibrate: "Panga upya",
      sessionComplete: "Kipindi kimekamilika",
      rewards: "zawadi",
      seconds: "sekunde",
      seeProgress: "Tazama maendeleo",
      home: "Nyumbani",
      contentLibrary: "Maktaba ya maudhui",
      referenceVideos: "Video za Rejea",
      videoPlaceholder: "Video yako ya rejea itaonekana hapa.",
      armLibraryCopy: "Mwongozo wa kuinua mkono kwa usalama hadi usawa wa bega.",
      legLibraryCopy: "Maelekezo ya PT: simama kwa mguu dhaifu, tumia mkono dhaifu kushika reli, kisha jaribu kupiga nyota kwa mguu mwingine. Mlezi asaidie kwa nyuma ikihitajika.",
      balanceLibraryCopy: "Video ya rejea ya mwendo na mizani kwa mazoezi salama ya kushikiliwa.",
      localProgress: "Maendeleo ya kifaa hiki",
      recentSessions: "Vipindi vya Karibuni",
      today: "Leo",
      dailyPlan: "Mpango wa tiba wa kila siku",
      dailyPlanCopy: "Kamilisha zoezi moja la mkono, mguu, na mizani kwa msaada wa mlezi.",
      armSetup: "Sehemu ya juu ya mwili ionekane. Mtoto ainua mkono hadi eneo la baluni.",
      legSetup: "Simama kwa mguu dhaifu na shika reli kwa mkono dhaifu. Piga nyota kwa mguu mwingine huku mlezi akisaidia kwa nyuma ikihitajika.",
      balanceSetup: "Mwili mzima uonekane. Mtoto akae imara akiwa salama na kusaidiwa.",
      armTitle: "Pasua baluni",
      legTitle: "Piga nyota",
      balanceTitle: "Shika mizani",
      armPrompt: "Inua mkono",
      legPrompt: "Piga teke kuelekea nyota",
      balancePrompt: "Kaa imara",
      success: "Hongera",
      complete: "Kazi nzuri leo.",
      waiting: "Inasubiri mwendo",
      detected: "Mwendo umetambuliwa",
      bodyMoving: "Mwendo mkubwa wa mwili umepuuzwa",
      reps: "zawadi",
      gait: "Mwendo wa Miguu",
      gaitLibraryCopy: "Rejea ya mafunzo ya kutembea kwa msaada na hatua salama.",
    },
    ki: {
      chooseLanguage: "Thuura rũthiomi rwa kwambĩrĩria.",
      homeTitle: "Mũciĩ wa Ũhonia",
      startTherapy: "Ambĩrĩria Ũhonia",
      startTherapySub: "Thuura thaka ya ũhonia",
      library: "Ngathĩti",
      librarySub: "Vidio na mĩtaratara ya kũrora",
      progress: "Ũthiĩ na Mbere",
      progressSub: "Rora ihinda iria ciahonoketio",
      reminders: "Ciugo cia Kũririkania",
      remindersSub: "Mũbango wa ũmũthĩ",
      therapyGames: "Thaka cia ũhonia",
      chooseExercise: "Thuura Mũthethania",
      armRaise: "Kũambararia Guoko",
      legKick: "Kũringa na Kũgũrũ",
      balanceHold: "Kũrũgama Wega",
      armGameSub: "Tũraga mĩbũmbũ na kũambararia guoko.",
      legGameSub: "Ringa na kũgũrũ kũrĩa njata ĩraara.",
      balanceGameSub: "Ikara ũrũgamĩte wega ũcokanĩrĩrie mĩcĩrĩnga.",
      cameraSetup: "Kũhaarĩria Kamera",
      caregiverGuide: "Mũtaaro wa mũmũmenyereri",
      safetyNote: "Tigithĩria angĩkorwo nĩ kũrĩ ruo, kĩrigicano, kana mũnoga mũnene.",
      cameraHint: "Kamera ĩkwambĩrĩria wahĩnyĩra Ambĩrĩria.",
      useDemo: "Hũthĩra mũthemba wa kuonania",
      begin: "Ambĩrĩria",
      voicePrompt: "Mũgambo wa mũtaaro",
      recalibrate: "Haarĩria Rĩngĩ",
      sessionComplete: "Ihinda nĩ rĩathira",
      rewards: "irathimo",
      seconds: "thekondi",
      seeProgress: "Rora ũthiĩ na mbere",
      home: "Mũciĩ",
      contentLibrary: "Ngathĩti ya maũndũ",
      referenceVideos: "Vidio cia Kũrora",
      videoPlaceholder: "Vidio yaku ya kũrora nĩyo ĩkuonekana haha.",
      armLibraryCopy: "Mũtaaro wa kũambararia guoko na ũhoro wa kũigana kĩande.",
      legLibraryCopy: "Mataaro ma mũthondeki: rũgama na kũgũrũ kũrĩa kũrĩ na hinya mũnini, ũnyiitĩrĩre na guoko kũrĩa kũrĩ na hinya mũnini, ũcoke ũgerie kũringa njata na kũgũrũ kũngĩ. Mũmũmenyereri amũteithagie na thuutha kũngĩbatarania.",
      balanceLibraryCopy: "Mũtaaro wa kũrũgama wega ũrĩ na ũteithio mwega.",
      gait: "Mwĩtĩkanio wa Magũrũ",
      gaitLibraryCopy: "Vidio ya kũrora ya kwĩruta gũthiĩ na hatua na ũteithio.",
      localProgress: "Ũthiĩ na mbere wa ũyũ mũtambo",
      recentSessions: "Ihinda iria cia Mahinda mathaa",
      today: "Ũmũthĩ",
      dailyPlan: "Mũbango wa ũhonia wa o mũthenya",
      dailyPlanCopy: "Thondeka ũthethania ũmwe wa guoko, ũmwe wa kũgũrũ, na ũmwe wa kũrũgama wega na ũteithio wa mũmũmenyereri.",
      armSetup: "Tigĩrĩra mwĩrĩ wa igũrũ wonekane. Mwana aambararie guoko nginya handũ ha mĩbũmbũ.",
      legSetup: "Rũgama na kũgũrũ kũrĩa kũrĩ na hinya mũnini, ũnyiite mũrarara na guoko kũrĩa kũrĩ na hinya mũnini. Ringa njata na kũgũrũ kũngĩ, mũmũmenyereri akũteithagie na thuutha kũngĩbatarania.",
      balanceSetup: "Tigĩrĩra mwĩrĩ wothe wonekane. Mwana akare arũgamĩte wega arĩ na ũteithio mũrũmu.",
      armTitle: "Tũra mĩbũmbũ",
      legTitle: "Ringa njata",
      balanceTitle: "Rũgama wega",
      armPrompt: "Ambararia guoko",
      legPrompt: "Ringa njata na kũgũrũ",
      balancePrompt: "Ikara ũrũgamĩte",
      success: "Wĩka wega",
      complete: "Wĩka wega mũno ũmũthĩ.",
      waiting: "Njetereire mwĩtĩkanio",
      detected: "Mwĩtĩkanio nĩ wonwo",
      bodyMoving: "Kũinaina mũnene kwa mwĩrĩ gũtigĩtwo",
      reps: "irathimo",
    },
  };

  var exerciseNames = { arm: "armRaise", leg: "legKick", balance: "balanceHold" };

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    applyTranslations();
    renderVideoSlots();
    document.querySelectorAll(".language-card").forEach(function (button) {
      button.addEventListener("click", function () {
        currentLang = button.dataset.lang;
        localStorage.setItem("neuroBridgeLanguage", currentLang);
        applyTranslations();
        renderVideoSlots();
        showScreen("homeScreen");
      });
    });
    document.addEventListener("click", function (event) {
      var go = event.target.closest("[data-go]");
      if (go) showScreen(go.dataset.go);
      var ex = event.target.closest("[data-exercise]");
      if (ex) selectExercise(ex.dataset.exercise);
    });
    byId("beginSessionButton").addEventListener("click", function () {
      demoMode = false;
      beginSession();
    });
    byId("demoModeButton").addEventListener("click", function () {
      demoMode = true;
      beginSession();
    });
    byId("exitSessionButton").addEventListener("click", function () {
      endSession(false);
      showScreen("homeScreen");
    });
    byId("speakButton").addEventListener("click", function () {
      speak(promptForExercise());
    });
    byId("recalibrateButton").addEventListener("click", resetTracking);
    drawProgress();
  }

  function selectExercise(type) {
    currentExercise = type;
    byId("setupExerciseLabel").textContent = t(exerciseNames[type]);
    byId("setupInstruction").textContent = t(type + "Setup");
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
    document.documentElement.lang = currentLang;
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      node.textContent = t(node.dataset.i18n);
    });
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
      } else if (/youtube|youtu\.be|vimeo|choosept|https?:\/\//i.test(src)) {
        slot.innerHTML = '<a class="video-link" href="' + src + '" target="_blank" rel="noreferrer">Open video</a>';
      } else {
        slot.innerHTML = '<video controls playsinline src="' + src + '"></video>';
      }
    });
  }

  function beginSession() {
    startCamera().then(function () {
      score = 0;
      active = true;
      sessionStart = Date.now();
      byId("scoreCount").textContent = score;
      byId("targetCount").textContent = targetScore;
      byId("sessionTypeLabel").textContent = t(exerciseNames[currentExercise]);
      byId("sessionTitle").textContent = t(currentExercise + "Title");
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
      if (poseReady) {
        byId("cameraStatus").textContent = "Pose detection active. Ready to begin.";
      }
      setTimeout(tick, 120);
    };
    tick();
  }


  function initPoseModel() {
    if (poseModel || !window.Pose) return;
    poseModel = new Pose({
      locateFile: function (file) {
        return "https://cdn.jsdelivr.net/npm/@mediapipe/pose/" + file;
      },
    });
    poseModel.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    poseModel.onResults(function (results) {
      if (results.poseLandmarks) {
        lastPose = results.poseLandmarks;
        poseReady = true;
      }
      poseBusy = false;
    });
  }

  function resetTracking() {
    previousFrame = null;
    lastPose = null;
    poseReady = false;
    steadyStartedAt = 0;
    lastSuccessAt = Date.now();
  }

  function renderTarget() {
    var layer = byId("targetLayer");
    layer.className = currentExercise + "-targets";
    if (currentExercise === "arm") layer.innerHTML = '<div class="target-zone top-zone">Hand target</div><div class="balloon reward-object"></div>';
    if (currentExercise === "leg") {
      targetSide = Math.random() > 0.5 ? "right" : "left";
      layer.innerHTML = '<div class="star-target ' + targetSide + '">☆</div>';
    }
    if (currentExercise === "balance") layer.innerHTML = '<div class="balance-ring reward-object">◇</div>';
  }

  function trackMotion() {
    if (!active) return;
    var video = byId("sessionVideo");
    var canvas = byId("trackingCanvas");
    if (!video || video.readyState < 2) {
      animationId = requestAnimationFrame(trackMotion);
      return;
    }
    var w = 180, h = 135;
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    var current = ctx.getImageData(0, 0, w, h).data;
    if (poseModel && !poseBusy) {
      poseBusy = true;
      poseModel.send({ image: video }).catch(function () {
        poseBusy = false;
      });
    }
    if (!previousFrame) {
      previousFrame = current.slice(0);
      animationId = requestAnimationFrame(trackMotion);
      return;
    }
    var poseDetected = detectPoseMotion();
    // For leg & balance: require MediaPipe pose to avoid false positives from arm movement.
    // Pixel motion is only used as a fallback when pose hasn't initialised yet, and only for arm exercise.
    var pixelDetected = false;
    if (currentExercise === "arm" && !poseReady) {
      pixelDetected = detectExerciseMotion(current, previousFrame, w, h);
    }
    var detected = poseDetected || pixelDetected;
    byId("motionReadout").textContent = detected ? t("detected") : (poseReady ? "Pose tracking active — " + t("waiting") : "Loading pose model…");
    if (detected && Date.now() - lastSuccessAt > 1300) registerSuccess();
    previousFrame = current.slice(0);
    animationId = requestAnimationFrame(trackMotion);
  }

  function detectExerciseMotion(current, previous, w, h) {
    if (currentExercise === "arm") return regionScore(current, previous, w, 0.08, 0.92, 0.06, 0.38) > 4.8 && regionScore(current, previous, w, 0.25, 0.75, 0.45, 0.92) < 3.2;
    if (currentExercise === "leg") {
      var sideScore = targetSide === "left"
        ? regionScore(current, previous, w, 0.02, 0.35, 0.50, 0.96)
        : regionScore(current, previous, w, 0.65, 0.98, 0.50, 0.96);
      var torsoScore = regionScore(current, previous, w, 0.30, 0.70, 0.08, 0.48);
      return sideScore > 4.2 && torsoScore < 3.5;
    }
    if (currentExercise === "balance") return regionScore(current, previous, w, 0.20, 0.80, 0.12, 0.92) < 1.2;
    return false;
  }

  function detectPoseMotion() {
    if (!poseReady || !lastPose) return false;
    var lShoulder = landmark(11);
    var rShoulder = landmark(12);
    var lWrist = landmark(15);
    var rWrist = landmark(16);
    var lHip = landmark(23);
    var rHip = landmark(24);
    var lKnee = landmark(25);
    var rKnee = landmark(26);
    var lAnkle = landmark(27);
    var rAnkle = landmark(28);

    if (currentExercise === "arm") {
      var leftArmRaised = visible(lShoulder, lWrist) && lWrist.y < lShoulder.y - 0.08;
      var rightArmRaised = visible(rShoulder, rWrist) && rWrist.y < rShoulder.y - 0.08;
      return leftArmRaised || rightArmRaised;
    }

    if (currentExercise === "leg") {
      var kickingAnkle = rAnkle;
      var kickingKnee = rKnee;
      var supportHip = lHip;
      var kickVisible = visible(kickingAnkle, kickingKnee);
      var sideReached = targetSide === "left" ? kickingAnkle.x < 0.38 : kickingAnkle.x > 0.62;
      var lifted = kickVisible && kickingAnkle.y < kickingKnee.y + 0.18;
      var torsoStable = visible(lHip, rHip) ? Math.abs(lHip.y - rHip.y) < 0.18 : true;
      var weakSideLoaded = supportHip && supportHip.visibility > 0.35;
      return kickVisible && sideReached && lifted && torsoStable && weakSideLoaded;
    }

    if (currentExercise === "balance") {
      var stable = visible(lShoulder, rShoulder) && visible(lHip, rHip) &&
        Math.abs(lShoulder.y - rShoulder.y) < 0.10 &&
        Math.abs(lHip.y - rHip.y) < 0.10 &&
        Math.abs(((lShoulder.x + rShoulder.x) / 2) - ((lHip.x + rHip.x) / 2)) < 0.16;
      if (!stable) {
        steadyStartedAt = 0;
        return false;
      }
      if (!steadyStartedAt) steadyStartedAt = Date.now();
      return Date.now() - steadyStartedAt > 1200;
    }

    return false;
  }

  function landmark(index) {
    return lastPose && lastPose[index];
  }

  function visible(a, b) {
    return a && b && (a.visibility === undefined || a.visibility > 0.35) && (b.visibility === undefined || b.visibility > 0.35);
  }

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

  function registerSuccess() {
    lastSuccessAt = Date.now();
    score++;
    byId("scoreCount").textContent = score;
    burstTarget();
    speak(score >= targetScore ? t("complete") : t("success"));
    if (score >= targetScore) {
      setTimeout(function () { endSession(true); }, 700);
    } else {
      setTimeout(renderTarget, 450);
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
      registerSuccess();
    }, 1300);
  }

  function endSession(save) {
    active = false;
    clearInterval(demoTimer);
    cancelAnimationFrame(animationId);
    if (!save) return;
    var duration = Math.max(1, Math.round((Date.now() - sessionStart) / 1000));
    var sessions = getSessions();
    sessions.push({ date: new Date().toISOString(), exercise: t(exerciseNames[currentExercise]), score: score, target: targetScore, duration: duration });
    localStorage.setItem("neuroBridgeSessions", JSON.stringify(sessions.slice(-12)));
    byId("resultSummary").textContent = t("complete");
    byId("resultScore").textContent = score;
    byId("resultTime").textContent = duration;
    showScreen("resultScreen");
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
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#152238";
    ctx.font = "700 16px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Reward score per session", padL, 18);

    // Y grid + labels (0..target)
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.font = "600 11px Arial, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    var ySteps = 4;
    for (var g = 0; g <= ySteps; g++) {
      var y = padT + (plotH * g) / ySteps;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      var val = Math.round(targetScore * (1 - g / ySteps));
      ctx.fillText(String(val), padL - 8, y + 4);
    }

    // Axes
    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(W - padR, padT + plotH);
    ctx.stroke();

    if (!sessions.length) {
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.font = "700 14px Arial, sans-serif";
      ctx.fillText("No data yet", padL + plotW / 2, padT + plotH / 2);
      return;
    }

    // Bars
    var n = sessions.length;
    var slot = plotW / n;
    var barW = Math.min(48, slot * 0.6);
    sessions.forEach(function (s, i) {
      var cx = padL + slot * i + slot / 2;
      var h = (Math.min(s.score, targetScore) / targetScore) * plotH;
      var by = padT + plotH - h;
      ctx.fillStyle = s.score >= s.target ? "#23b7a7" : "#65a5ff";
      ctx.fillRect(cx - barW / 2, by, barW, h);
      // X label
      ctx.fillStyle = "#64748b";
      ctx.font = "600 11px Arial, sans-serif";
      ctx.textAlign = "center";
      var d = new Date(s.date);
      ctx.fillText((d.getMonth() + 1) + "/" + d.getDate(), cx, padT + plotH + 16);
      ctx.fillStyle = "#152238";
      ctx.font = "700 11px Arial, sans-serif";
      ctx.fillText(String(s.score), cx, by - 6);
    });

    // Trend line
    ctx.strokeStyle = "#ff6b6b";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    sessions.forEach(function (s, i) {
      var cx = padL + slot * i + slot / 2;
      var y = padT + plotH - (Math.min(s.score, targetScore) / targetScore) * plotH;
      if (i === 0) ctx.moveTo(cx, y); else ctx.lineTo(cx, y);
    });
    ctx.stroke();
  }


  function getSessions() {
    try {
      return JSON.parse(localStorage.getItem("neuroBridgeSessions")) || [];
    } catch (e) {
      return [];
    }
  }

  function promptForExercise() {
    return t(currentExercise + "Prompt");
  }

  function speak(text) {
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = currentLang === "sw" ? "sw-KE" : currentLang === "ki" ? "sw-KE" : "en-US";
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function t(key) {
    return (tx[currentLang] && tx[currentLang][key]) || tx.en[key] || key;
  }

  function byId(id) {
    return document.getElementById(id);
  }
})();
