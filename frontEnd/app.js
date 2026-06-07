const profileLibrary = {
  Adult: {
    needs: "You want efficiency, clear value, convenience, and practical benefits.",
    message: "Your page should use direct, benefit-led language with enough detail to support confident decisions.",
    tone: "Keep it respectful, concise, and useful."
  },
  Child: {
    needs: "You want safety, simplicity, fun, caregiver reassurance, and age-appropriate experiences.",
    message: "Your page should use playful, concrete language and make caregiver benefits easy to understand.",
    tone: "Keep it warm, simple, and encouraging."
  },
  "Young Family": {
    needs: "You want budget awareness, safety, convenience, flexibility, and activities that work for multiple ages.",
    message: "Your page should emphasize low-friction planning, family value, trust, and shared experiences.",
    tone: "Keep it helpful, reassuring, and practical."
  },
  Teenager: {
    needs: "You want independence, social relevance, self-expression, speed, and credibility.",
    message: "Your page should lead with autonomy, friend-friendly benefits, and a modern voice without sounding forced.",
    tone: "Keep it confident, casual, and authentic."
  },
  Senior: {
    needs: "You want clarity, comfort, accessibility, trust, and support when needed.",
    message: "Your page should highlight ease of use, reliability, personal benefit, and visible assistance.",
    tone: "Keep it patient, clear, and respectful."
  },
  "Business Traveler": {
    needs: "You want speed, reliability, productivity, location convenience, and predictable service.",
    message: "Your page should focus on time saved, smooth logistics, premium consistency, and low hassle.",
    tone: "Keep it polished, efficient, and professional."
  },
  Student: {
    needs: "You want affordability, flexibility, usefulness, social proof, and quick access.",
    message: "Your page should connect the offer to your goals, budget, identity, and daily routines.",
    tone: "Keep it clear, energetic, and grounded."
  },
  Custom: {
    needs: "You want the event page to reflect the context you shared.",
    message: "Your page should use your clues to prioritize the strongest motivation and barrier.",
    tone: "Keep it adaptable, audience-aware, and specific."
  }
};

const textSignals = [
  { pattern: /teen|teenager|teenagers|age 1[3-9]|ages 1[3-9]|1[3-9]\s*(?:year old|years old|year-old|yr old|yr-old)|social|friends|gaming|independent|trend/i, profile: "Teenager" },
  { pattern: /family|children|weekend|parents|stroller|household/i, profile: "Young Family" },
  { pattern: /child|kid|school|parent|play|toy|caregiver/i, profile: "Child" },
  { pattern: /senior|retired|mobility|accessible|comfort|grandparent/i, profile: "Senior" },
  { pattern: /business|flight|hotel|conference|meeting|traveler|executive/i, profile: "Business Traveler" },
  { pattern: /student|college|campus|class|study|budget/i, profile: "Student" },
  { pattern: /adult|professional|career|homeowner|commute|office|worker|night out|night on the town|money is no object|splurge/i, profile: "Adult" }
];

const paragraphForm = document.querySelector("#paragraph-panel");
const paragraphInput = document.querySelector("#paragraph-input");
const characterCount = document.querySelector("#character-count");

const profileTitle = document.querySelector("#profile-title");
const profileNeeds = document.querySelector("#profile-needs");
const profileTone = document.querySelector("#profile-tone");
const profileEditor = document.querySelector("#profile-editor");
const profileSummary = document.querySelector("#profile-summary");

const eventForm = document.querySelector("#event-form");
const websiteUrlInput = document.querySelector("#website-url");
const eventResult = document.querySelector("#event-result");
const eventUrl = document.querySelector("#event-url");

const createWebPageButton = document.querySelector("#create-web-page");
const actionMessage = document.querySelector("#action-message");

const profileStatus = document.querySelector("#profile-status");
const eventStatus = document.querySelector("#event-status");
const generateStatus = document.querySelector("#generate-status");
const statusSteps = {
  profile: document.querySelector('[data-status-step="profile"]'),
  event: document.querySelector('[data-status-step="event"]'),
  generate: document.querySelector('[data-status-step="generate"]')
};

let currentProfile = {
  title: "Custom Persona",
  needs: "Describe the persona above to build this.",
  tone: "Tone guidance will appear after you build a persona."
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getRecommendedTone(profile) {
  return [profile.message, profile.tone].filter(Boolean).join(" ");
}

function getProfileSummary() {
  return {
    title: currentProfile.title,
    needs: currentProfile.needs,
    tone: currentProfile.tone,
    summary: `${currentProfile.needs} ${currentProfile.tone}`,
    updatedAt: new Date().toISOString()
  };
}

function profileFromSummary(summary) {
  if (summary.needs || summary.tone) {
    return {
      title: summary.title || "Saved Persona",
      needs: summary.needs || "Needs to be defined.",
      tone: summary.tone || "Tone to be defined."
    };
  }

  const [needs, tone] = String(summary.summary || "").split(" Recommended tone: ");
  return {
    title: summary.title || "Saved Persona",
    needs: needs || "Needs to be defined.",
    tone: tone || "Tone to be defined."
  };
}

function setStepState(step, isComplete) {
  statusSteps[step].classList.toggle("complete", isComplete);
}

function renderCurrentProfile() {
  profileTitle.value = currentProfile.title;
  profileNeeds.value = currentProfile.needs;
  profileTone.value = currentProfile.tone;
}

function clearActionMessagePreserve() {
  delete actionMessage.dataset.preserve;
}

function syncEditedProfile() {
  currentProfile = {
    title: profileTitle.value.trim() || "Custom Profile",
    needs: profileNeeds.value.trim() || "Needs to be defined.",
    tone: profileTone.value.trim() || "Tone to be defined."
  };
}

function persistCurrentProfile() {
  clearActionMessagePreserve();
  localStorage.setItem("profileSummary", JSON.stringify(getProfileSummary()));
  renderSavedInputs();
}

function updateProfile(profileName, customDetail = "") {
  const profile = profileLibrary[profileName] || profileLibrary.Custom;
  currentProfile = {
    title: profileName,
    needs: customDetail || profile.needs,
    tone: getRecommendedTone(profile)
  };
  renderCurrentProfile();
  persistCurrentProfile();
}

function inferProfile(text) {
  const match = textSignals.find((signal) => signal.pattern.test(text));
  return match ? match.profile : "Adult";
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function sentenceList(values) {
  if (values.length <= 1) {
    return values[0] || "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function buildPersonaTitle(text, profileName) {
  if (profileName === "Adult" && hasAny(text, [/night (?:out|on the town)/i, /money is no object/i, /splurge/i])) {
    return "Night-Out Group";
  }

  if (profileName === "Adult" && hasAny(text, [/office|worker|coworker|team/i])) {
    return "Office Group";
  }

  if (profileName === "Young Family" && hasAny(text, [/budget|tight|afford|cheap|save/i])) {
    return "Budget-Conscious Family";
  }

  return profileName;
}

function buildNeedsFromText(text, profileName) {
  const needs = [];

  if (hasAny(text, [/night (?:out|on the town)/i, /fun|party|celebrat|show|theater|theatre/i])) {
    needs.push("a memorable night out");
  }

  if (hasAny(text, [/money is no object|splurge|premium|vip|best seats|ready to spend|spend/i])
    && !hasAny(text, [/budget|tight|cheap|afford|save/i])) {
    needs.push("premium options that feel worth the spend");
  }

  if (hasAny(text, [/office|worker|coworker|team|group/i])) {
    needs.push("easy group planning");
  }

  if (hasAny(text, [/friends|social|together|date/i])) {
    needs.push("social energy");
  }

  if (hasAny(text, [/budget|tight|cheap|afford|free|discount|value|save/i])) {
    needs.push("clear value and manageable cost");
  }

  if (hasAny(text, [/kid|child|children|family|parent|caregiver|stroller/i])) {
    needs.push("age-aware logistics");
    needs.push("reassurance for caregivers");
  }

  if (hasAny(text, [/teen|teenager|friends|independent|trend/i])) {
    needs.push("independence and social credibility");
  }

  if (hasAny(text, [/comfort|accessible|mobility|seating|parking|transport|easy/i])) {
    needs.push("comfort, access, and smooth arrival details");
  }

  if (hasAny(text, [/business|conference|meeting|traveler|executive|flight|hotel/i])) {
    needs.push("efficient timing and dependable logistics");
  }

  const profileDefaults = {
    Adult: ["clear reasons to choose this event", "smooth planning"],
    Child: ["safe, simple fun", "caregiver confidence"],
    "Young Family": ["family-friendly logistics", "flexibility across ages"],
    Teenager: ["social relevance", "a voice that feels current"],
    Senior: ["clarity, comfort, and reliable support"],
    "Business Traveler": ["speed, convenience, and predictability"],
    Student: ["affordability, usefulness, and quick access"]
  };

  const distinctNeeds = [...new Set([...needs, ...(profileDefaults[profileName] || [])])].slice(0, 4);
  return distinctNeeds.length
    ? `You want ${sentenceList(distinctNeeds)}.`
    : profileLibrary.Custom.needs;
}

function buildToneFromText(text, profileName) {
  if (profileName === "Adult" && hasAny(text, [/night (?:out|on the town)/i, /money is no object|splurge|premium|vip|ready to spend/i])) {
    return "Your page should feel like it was made for a standout night out: upbeat, confident, and specific. It should lead with the feeling of the evening, premium perks, great seats, nearby food or drinks, and a simple next step.";
  }

  if (profileName === "Young Family" || profileName === "Child") {
    return "Your page should speak warmly and practically. It should lead with fun, safety, timing, age fit, price, and the details you need to say yes without overthinking it.";
  }

  if (profileName === "Teenager") {
    return "Your page should feel casual, current, and concrete. It should lead with what makes the event worth sharing with friends, then make the practical details quick to scan.";
  }

  if (profileName === "Business Traveler") {
    return "Your page should feel polished and efficient. It should lead with time saved, location convenience, reliable logistics, and the clearest reason this fits your tight schedule.";
  }

  if (profileName === "Senior") {
    return "Your page should speak clearly and respectfully. It should lead with comfort, accessibility, seating, timing, and the support available before and during the event.";
  }

  if (hasAny(text, [/budget|tight|cheap|afford|free|discount|value|save/i])) {
    return "Your page should lead with value, useful inclusions, and low-friction planning. Keep the tone encouraging, specific, and easy to act on.";
  }

  return "Your page should speak directly to what you want from the outing. It should lead with the strongest benefit, make the logistics easy to scan, and keep the voice vivid, useful, and human.";
}

function summarizeFreeform(text) {
  if (!text.trim()) {
    return;
  }

  const profileName = inferProfile(text);
  const trimmed = text.trim().replace(/\s+/g, " ");
  const title = buildPersonaTitle(trimmed, profileName);

  currentProfile = {
    title,
    needs: buildNeedsFromText(trimmed, profileName),
    tone: buildToneFromText(trimmed, profileName)
  };
  renderCurrentProfile();
  persistCurrentProfile();
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withProtocol);
}

function saveEventUrl(value, showResult = false) {
  const url = normalizeUrl(value);
  clearActionMessagePreserve();
  websiteUrlInput.value = url.href;
  localStorage.setItem("eventUrl", url.href);
  localStorage.setItem("eventUrlUpdatedAt", new Date().toISOString());

  if (showResult) {
    eventResult.className = "inline-message success";
    eventResult.textContent = "Link saved.";
  }

  renderSavedInputs();
  return url;
}

function loadSavedState() {
  const savedProfile = localStorage.getItem("profileSummary");
  const savedUrl = localStorage.getItem("eventUrl");

  if (savedProfile) {
    try {
      currentProfile = profileFromSummary(JSON.parse(savedProfile));
      renderCurrentProfile();
    } catch (error) {
      localStorage.removeItem("profileSummary");
    }
  } else {
    renderCurrentProfile();
  }

  if (savedUrl) {
    websiteUrlInput.value = savedUrl;
  }

  renderSavedInputs();
}

function getSavedInputs() {
  const savedProfile = localStorage.getItem("profileSummary");
  const savedEventUrl = localStorage.getItem("eventUrl");

  if (!savedProfile || !savedEventUrl) {
    return null;
  }

  return {
    profile: JSON.parse(savedProfile),
    eventUrl: savedEventUrl.trim()
  };
}

function renderSavedProfile() {
  const savedProfile = localStorage.getItem("profileSummary");
  if (!savedProfile) {
    profileSummary.classList.add("empty-state");
    profileSummary.textContent = "Choose or describe a persona.";
    profileStatus.textContent = "Choose one";
    setStepState("profile", false);
    return false;
  }

  try {
    const profile = JSON.parse(savedProfile);
    profileSummary.classList.remove("empty-state");
    profileSummary.textContent = `${profile.title || "Saved Persona"}: ${profile.summary || "No details saved yet."}`;
    profileStatus.textContent = profile.title || "Ready";
    setStepState("profile", true);
    return true;
  } catch (error) {
    profileSummary.classList.add("empty-state");
    profileSummary.textContent = "This persona could not be loaded.";
    profileStatus.textContent = "Needs fix";
    setStepState("profile", false);
    return false;
  }
}

function renderSavedEventUrl() {
  const savedUrl = localStorage.getItem("eventUrl");
  if (!savedUrl) {
    eventUrl.classList.add("empty-state");
    eventUrl.textContent = "Add an event link.";
    eventStatus.textContent = "Add link";
    setStepState("event", false);
    return false;
  }

  eventUrl.classList.remove("empty-state");
  eventUrl.innerHTML = `<a href="${escapeHtml(savedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(savedUrl)}</a>`;
  eventStatus.textContent = "Added";
  setStepState("event", true);
  return true;
}

function renderSavedInputs() {
  const hasProfile = renderSavedProfile();
  const hasEvent = renderSavedEventUrl();
  const isReady = hasProfile && hasEvent;

  createWebPageButton.disabled = !isReady;
  generateStatus.textContent = isReady ? "Ready" : "Waiting";
  setStepState("generate", isReady);

  if (!actionMessage.dataset.preserve) {
    actionMessage.textContent = isReady
      ? "Ready to create."
      : "Add both items to start.";
  }
}

async function createWebPage() {
  let savedInputs;
  let resultTab = null;
  let shouldPreserveActionMessage = false;

  try {
    savedInputs = getSavedInputs();
  } catch (error) {
    actionMessage.dataset.preserve = "true";
    actionMessage.textContent = "This persona could not be loaded. Please choose it again.";
    return;
  }

  if (!savedInputs) {
    renderSavedInputs();
    return;
  }

  createWebPageButton.disabled = true;
  createWebPageButton.textContent = "Creating...";
  delete actionMessage.dataset.preserve;
  actionMessage.textContent = "Creating your page...";
  resultTab = window.open("about:blank", "_blank");

  if (resultTab) {
    resultTab.opener = null;
    resultTab.document.title = "Creating page";
    resultTab.document.body.innerHTML = "<p style=\"font-family: system-ui, sans-serif; padding: 24px;\">Creating your page...</p>";
  }

  try {
    const response = await fetch("http://localhost:3001/api/create-web-page", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(savedInputs)
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "The backend could not create the page.");
    }

    const resultUrl = `http://localhost:3001${result.page.url}`;
    if (resultTab) {
      resultTab.location.href = resultUrl;
      actionMessage.textContent = "Page created.";
    } else {
      actionMessage.innerHTML = `Page created. <a href="${escapeHtml(resultUrl)}" target="_blank" rel="noopener noreferrer">Open it here</a>.`;
    }
    actionMessage.dataset.preserve = "true";
    shouldPreserveActionMessage = true;
  } catch (error) {
    if (resultTab && !resultTab.closed) {
      resultTab.close();
    }

    actionMessage.dataset.preserve = "true";
    shouldPreserveActionMessage = true;
    actionMessage.textContent = `Start the backend with "cd backEnd && npm start", then try again. ${error.message}`;
  } finally {
    createWebPageButton.disabled = false;
    createWebPageButton.textContent = "Create Page";
    renderSavedInputs();

    if (!shouldPreserveActionMessage) {
      delete actionMessage.dataset.preserve;
    }
  }
}

paragraphInput.addEventListener("input", () => {
  const singleParagraph = paragraphInput.value.replace(/\n{2,}/g, "\n").replace(/\n/g, " ");
  if (singleParagraph !== paragraphInput.value) {
    paragraphInput.value = singleParagraph;
  }
  characterCount.textContent = `${paragraphInput.value.length} / ${paragraphInput.maxLength}`;
});

paragraphForm.addEventListener("submit", (event) => {
  event.preventDefault();
  summarizeFreeform(paragraphInput.value);
});

profileEditor.addEventListener("input", () => {
  syncEditedProfile();
  persistCurrentProfile();
});

eventForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    saveEventUrl(websiteUrlInput.value, true);
  } catch (error) {
    eventResult.className = "inline-message error";
    eventResult.textContent = "Please enter a valid event link.";
  }
});

websiteUrlInput.addEventListener("change", () => {
  try {
    saveEventUrl(websiteUrlInput.value);
  } catch (error) {
    eventResult.className = "inline-message";
    eventResult.textContent = "Please enter a valid event link.";
  }
});

createWebPageButton.addEventListener("click", createWebPage);
window.addEventListener("pageshow", renderSavedInputs);
window.addEventListener("focus", renderSavedInputs);
window.addEventListener("storage", renderSavedInputs);

loadSavedState();
