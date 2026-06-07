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
const resultPanel = document.querySelector(".result-panel");
const saveProfileButton = document.querySelector("#save-profile");
const savedSummary = document.querySelector(".saved-summary");
const savedSummaryTitle = document.querySelector("#saved-summary-title");
const savedSummaryCopy = document.querySelector("#saved-summary-copy");

let currentProfile = {
  title: "Adult",
  needs: profileLibrary.Adult.needs,
  tone: getRecommendedTone(profileLibrary.Adult)
};

function getRecommendedTone(profile) {
  return [profile.message, profile.tone].filter(Boolean).join(" ");
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

function updateProfile(profileName, customDetail = "") {
  const profile = profileLibrary[profileName] || profileLibrary.Custom;
  currentProfile = {
    title: profileName,
    needs: customDetail || profile.needs,
    tone: getRecommendedTone(profile)
  };
  resultPanel.hidden = false;
  renderCurrentProfile();
  persistCurrentProfile();
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

function getProfileSummary() {
  return {
    title: currentProfile.title,
    summary: `${currentProfile.needs} Recommended tone: ${currentProfile.tone}`,
    updatedAt: new Date().toISOString()
  };
}

function persistCurrentProfile() {
  localStorage.setItem("profileSummary", JSON.stringify(getProfileSummary()));
}

function renderSavedProfileSummary() {
  const profile = getProfileSummary();
  savedSummaryTitle.value = profile.title;
  savedSummaryCopy.value = profile.summary;
  savedSummary.hidden = false;
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

function resetInputs() {
  profileSelect.value = "Adult";
  paragraphInput.value = "";
  characterCount.textContent = `0 / ${paragraphInput.maxLength}`;
  setMode("dropdown");
}

function saveProfile() {
  syncEditedProfile();
  persistCurrentProfile();
  renderSavedProfileSummary();
  resetInputs();
  resultPanel.hidden = true;
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

saveProfileButton.addEventListener("click", saveProfile);
