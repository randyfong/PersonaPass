const profileLibrary = {
  Adult: {
    needs: "Efficiency, clear value, convenience, and practical benefits.",
    message: "Use direct, benefit-led language with enough detail to support confident decisions.",
    tone: "Respectful, concise, and useful."
  },
  Child: {
    needs: "Safety, simplicity, fun, reassurance for caregivers, and age-appropriate experiences.",
    message: "Use playful, concrete language and make caregiver benefits easy to understand.",
    tone: "Warm, simple, and encouraging."
  },
  "Young Family": {
    needs: "Budget awareness, safety, convenience, flexibility, and activities that work for multiple ages.",
    message: "Emphasize low-friction planning, family value, trust, and shared experiences.",
    tone: "Helpful, reassuring, and practical."
  },
  Teenager: {
    needs: "Independence, social relevance, self-expression, speed, and credibility.",
    message: "Lead with autonomy, peer-friendly benefits, and a modern voice without sounding forced.",
    tone: "Confident, casual, and authentic."
  },
  Senior: {
    needs: "Clarity, comfort, accessibility, trust, and support when needed.",
    message: "Highlight ease of use, reliability, personal benefit, and visible assistance.",
    tone: "Patient, clear, and respectful."
  },
  "Business Traveler": {
    needs: "Speed, reliability, productivity, location convenience, and predictable service.",
    message: "Focus on time saved, smooth logistics, premium consistency, and low hassle.",
    tone: "Polished, efficient, and professional."
  },
  Student: {
    needs: "Affordability, flexibility, usefulness, social proof, and quick access.",
    message: "Connect the offer to goals, budget, identity, and daily routines.",
    tone: "Clear, energetic, and grounded."
  },
  Custom: {
    needs: "Needs inferred from the supplied context.",
    message: "Use the audience clues to prioritize the strongest motivation and barrier.",
    tone: "Adaptable, audience-aware, and specific."
  }
};

const textSignals = [
  { pattern: /family|children|weekend|parents|stroller|household/i, profile: "Young Family" },
  { pattern: /child|kid|school|parent|play|toy|caregiver/i, profile: "Child" },
  { pattern: /teen|social|friends|gaming|independent|trend/i, profile: "Teenager" },
  { pattern: /senior|retired|mobility|accessible|comfort|grandparent/i, profile: "Senior" },
  { pattern: /business|flight|hotel|conference|meeting|traveler|executive/i, profile: "Business Traveler" },
  { pattern: /student|college|campus|class|study|budget/i, profile: "Student" },
  { pattern: /adult|professional|career|homeowner|commute/i, profile: "Adult" }
];

const modeTabs = document.querySelectorAll(".mode-tab");
const modePanels = document.querySelectorAll(".mode-panel");
const dropdownForm = document.querySelector("#dropdown-panel");
const profileSelect = document.querySelector("#profile-select");
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
const createVideoButton = document.querySelector("#create-video");
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
  title: "Adult",
  needs: profileLibrary.Adult.needs,
  tone: getRecommendedTone(profileLibrary.Adult)
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
    summary: `${currentProfile.needs} Recommended tone: ${currentProfile.tone}`,
    updatedAt: new Date().toISOString()
  };
}

function profileFromSummary(summary) {
  if (summary.needs || summary.tone) {
    return {
      title: summary.title || "Saved Profile",
      needs: summary.needs || "Needs to be defined.",
      tone: summary.tone || "Tone to be defined."
    };
  }

  const [needs, tone] = String(summary.summary || "").split(" Recommended tone: ");
  return {
    title: summary.title || "Saved Profile",
    needs: needs || "Needs to be defined.",
    tone: tone || "Tone to be defined."
  };
}

function setStepState(step, isComplete) {
  statusSteps[step].classList.toggle("complete", isComplete);
}

function setMode(mode) {
  modeTabs.forEach((tab) => {
    const isActive = tab.dataset.mode === mode;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  modePanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${mode}-panel`);
  });
}

function renderCurrentProfile() {
  profileTitle.value = currentProfile.title;
  profileNeeds.value = currentProfile.needs;
  profileTone.value = currentProfile.tone;
}

function syncEditedProfile() {
  currentProfile = {
    title: profileTitle.value.trim() || "Custom Profile",
    needs: profileNeeds.value.trim() || "Needs to be defined.",
    tone: profileTone.value.trim() || "Tone to be defined."
  };
}

function persistCurrentProfile() {
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

function summarizeFreeform(text) {
  const profileName = inferProfile(text);
  const trimmed = text.trim().replace(/\s+/g, " ");
  const detail = trimmed
    ? `This profile appears to describe ${profileName.toLowerCase()} users. Key clues: ${trimmed.slice(0, 180)}${trimmed.length > 180 ? "..." : ""}`
    : "";

  updateProfile(profileName, detail);
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withProtocol);
}

function saveEventUrl(value, showResult = false) {
  const url = normalizeUrl(value);
  websiteUrlInput.value = url.href;
  localStorage.setItem("eventUrl", url.href);
  localStorage.setItem("eventUrlUpdatedAt", new Date().toISOString());

  if (showResult) {
    eventResult.className = "inline-message success";
    eventResult.textContent = "Event URL saved.";
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
    profileSummary.textContent = "Generate or edit a profile to start.";
    profileStatus.textContent = "Needs profile";
    setStepState("profile", false);
    return false;
  }

  try {
    const profile = JSON.parse(savedProfile);
    profileSummary.classList.remove("empty-state");
    profileSummary.textContent = `${profile.title || "Saved Profile"}: ${profile.summary || "No profile summary was saved."}`;
    profileStatus.textContent = profile.title || "Saved";
    setStepState("profile", true);
    return true;
  } catch (error) {
    profileSummary.classList.add("empty-state");
    profileSummary.textContent = "The saved profile could not be loaded.";
    profileStatus.textContent = "Profile error";
    setStepState("profile", false);
    return false;
  }
}

function renderSavedEventUrl() {
  const savedUrl = localStorage.getItem("eventUrl");
  if (!savedUrl) {
    eventUrl.classList.add("empty-state");
    eventUrl.textContent = "Save an event URL to continue.";
    eventStatus.textContent = "Needs URL";
    setStepState("event", false);
    return false;
  }

  eventUrl.classList.remove("empty-state");
  eventUrl.innerHTML = `<a href="${escapeHtml(savedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(savedUrl)}</a>`;
  eventStatus.textContent = "Saved";
  setStepState("event", true);
  return true;
}

function renderSavedInputs() {
  const hasProfile = renderSavedProfile();
  const hasEvent = renderSavedEventUrl();
  const isReady = hasProfile && hasEvent;

  createWebPageButton.disabled = !isReady;
  createVideoButton.disabled = !isReady;
  generateStatus.textContent = isReady ? "Ready" : "Waiting";
  setStepState("generate", isReady);
  actionMessage.textContent = isReady
    ? "Ready to create customized event materials."
    : "Complete the profile and event URL before generating.";
}

async function createWebPage() {
  let savedInputs;
  let resultTab = null;

  try {
    savedInputs = getSavedInputs();
  } catch (error) {
    actionMessage.textContent = "The saved profile could not be loaded. Save the profile again before creating a page.";
    return;
  }

  if (!savedInputs) {
    renderSavedInputs();
    return;
  }

  createWebPageButton.disabled = true;
  createWebPageButton.textContent = "Creating...";
  actionMessage.textContent = "Creating your tailored page...";
  resultTab = window.open("about:blank", "_blank");

  if (resultTab) {
    resultTab.opener = null;
    resultTab.document.title = "Creating tailored page";
    resultTab.document.body.innerHTML = "<p style=\"font-family: system-ui, sans-serif; padding: 24px;\">Creating your tailored page...</p>";
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
    }
    actionMessage.textContent = "Tailored web page created.";
  } catch (error) {
    if (resultTab && !resultTab.closed) {
      resultTab.close();
    }

    actionMessage.textContent = `Start the backend with "cd backEnd && npm start", then try again. ${error.message}`;
  } finally {
    createWebPageButton.disabled = false;
    createWebPageButton.textContent = "Customize Web Page";
    renderSavedInputs();
  }
}

async function createVideo() {
  let savedInputs;
  let resultTab = null;

  try {
    savedInputs = getSavedInputs();
  } catch (error) {
    actionMessage.textContent = "The saved profile could not be loaded. Save the profile again before creating a video.";
    return;
  }

  if (!savedInputs) {
    renderSavedInputs();
    return;
  }

  createVideoButton.disabled = true;
  createVideoButton.textContent = "Creating video...";
  actionMessage.textContent = "Creating your event teaser...";
  resultTab = window.open("about:blank", "_blank");

  if (resultTab) {
    resultTab.opener = null;
    resultTab.document.title = "Creating event teaser";
    resultTab.document.body.innerHTML = "<p style=\"font-family: system-ui, sans-serif; padding: 24px;\">Creating your Happy Horse event teaser...</p>";
  }

  try {
    const response = await fetch("http://localhost:3001/api/create-video", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(savedInputs)
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      const error = new Error(result.error || "The backend could not create the video.");
      error.code = result.code;
      throw error;
    }

    const pageUrl = new URL("video/index.html", window.location.href);
    pageUrl.searchParams.set("videoUrl", result.videoUrl);
    pageUrl.searchParams.set("status", result.status || "completed");
    pageUrl.searchParams.set("title", "Event Teaser");

    if (resultTab) {
      resultTab.location.href = pageUrl.href;
    }
    actionMessage.textContent = "Event teaser created.";
  } catch (error) {
    if (resultTab && !resultTab.closed) {
      resultTab.close();
    }

    if (error.code === "MCP_AUTH_ERROR") {
      actionMessage.textContent = `The backend is running, but Magnific MCP authentication failed. ${error.message}`;
    } else if ((error.code === "MCP_ERROR" || error.code === "GENERATION_ERROR") && /MAGNIFIC[_ ]MCP/i.test(error.message)) {
      actionMessage.textContent = `The backend is running, but Magnific MCP video generation is not configured. ${error.message}`;
    } else {
      actionMessage.textContent = `Start the backend with "cd backEnd && npm start", then try again. ${error.message}`;
    }
  } finally {
    createVideoButton.disabled = false;
    createVideoButton.textContent = "Customize Video";
    renderSavedInputs();
  }
}

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

dropdownForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateProfile(profileSelect.value);
});

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
    eventResult.textContent = "Enter a valid website URL.";
  }
});

websiteUrlInput.addEventListener("change", () => {
  try {
    saveEventUrl(websiteUrlInput.value);
  } catch (error) {
    eventResult.className = "inline-message";
    eventResult.textContent = "Enter a valid website URL before it can be saved.";
  }
});

createWebPageButton.addEventListener("click", createWebPage);
createVideoButton.addEventListener("click", createVideo);
window.addEventListener("pageshow", renderSavedInputs);
window.addEventListener("focus", renderSavedInputs);
window.addEventListener("storage", renderSavedInputs);

loadSavedState();
