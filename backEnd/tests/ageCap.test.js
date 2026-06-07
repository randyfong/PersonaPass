const assert = require("node:assert/strict");

const { compareProfileToEvent, createTailoredPageModel } = require("../contentAnalyzer");
const { createDigitalAssets } = require("../digitalAssets");

const profile = {
  title: "Child",
  summary: [
    "Safety, simplicity, fun, reassurance for caregivers, and age-appropriate experiences.",
    "Recommended tone: Use playful, concrete language and make caregiver benefits easy to understand."
  ].join(" ")
};

const eventPage = {
  sourceUrl: "https://example.com/moulin-rouge",
  title: "Moulin Rouge! The Musical",
  description: "A large musical with seating, accessibility, family, child, kids, simple schedule and comfort details.",
  keywords: [
    "safety",
    "simple",
    "caregiver",
    "age",
    "family",
    "children",
    "comfort",
    "access"
  ],
  eventInfo: {
    name: "Moulin Rouge! The Musical",
    startDate: "Sat Jun 6",
    location: "Al Hirschfeld Theatre",
    sections: [
      {
        title: "Age guidance",
        body: [
          "Recommended for ages 12 and up.",
          "Children under 4 are not permitted.",
          "Children under 12 are not permitted in Can-Can seats."
        ].join(" ")
      },
      {
        title: "Content Advisory",
        body: "This production uses strobe lights, gunfire, smoke, and adult themes."
      }
    ],
    ticketInfo: {
      summary: "$67"
    }
  },
  text: [
    "easy simple schedule access accessibility comfortable comfort seating",
    "friends music social group together",
    "family kid kids child children caregiver parents safety",
    "Recommended for ages 12 and up.",
    "Children under 4 are not permitted.",
    "Children under 12 are not permitted in Can-Can seats.",
    "This production uses strobe lights, gunfire, smoke, and adult themes."
  ].join(" ")
};

const comparison = compareProfileToEvent(profile, eventPage);
const pageModel = createTailoredPageModel(profile, eventPage, comparison);
const detailAsset = createDigitalAssets({ pageModel, eventPage, comparison })
  .find((asset) => asset.id === "detail");

assert.equal(comparison.ageCompatibility.status, "mismatch");
assert.equal(comparison.ageScoreCap, 15);
assert.equal(comparison.score, 15);
assert.match(pageModel.proofPoint, /^15% fit/);
assert.match(pageModel.sections[0].body, /^Cautious 15% fit/);
assert.match(detailAsset.content, />15%<\/text>/);
assert.doesNotMatch(pageModel.proofPoint, /^72% fit/);
assert.doesNotMatch(detailAsset.content, />72%<\/text>/);

const profileWithEligibleChildAge = {
  title: "Child",
  summary: [
    "Safety, simplicity, fun, reassurance for caregivers, and age-appropriate experiences.",
    "This profile is for a kid who is 13 years old."
  ].join(" ")
};

const eligibleChildComparison = compareProfileToEvent(profileWithEligibleChildAge, eventPage);

assert.deepEqual(eligibleChildComparison.ageCompatibility.profileAges, [13]);
assert.equal(eligibleChildComparison.ageCompatibility.eventMinimumAge, 12);
assert.equal(eligibleChildComparison.ageCompatibility.status, "caution");
assert.equal(eligibleChildComparison.ageScoreCap, 55);
assert.ok(eligibleChildComparison.score > 15);

const profileWithUnderageChildAge = {
  title: "Child",
  summary: [
    "Safety, simplicity, fun, reassurance for caregivers, and age-appropriate experiences.",
    "This profile is for a child age 10."
  ].join(" ")
};

const underageChildComparison = compareProfileToEvent(profileWithUnderageChildAge, eventPage);

assert.deepEqual(underageChildComparison.ageCompatibility.profileAges, [10]);
assert.equal(underageChildComparison.ageCompatibility.eventMinimumAge, 12);
assert.equal(underageChildComparison.ageCompatibility.status, "mismatch");
assert.equal(underageChildComparison.ageScoreCap, 15);
assert.equal(underageChildComparison.score, 15);

const adultProfile = {
  title: "Adult",
  summary: [
    "This profile appears to describe adult users.",
    "Key clues: We are 30 years old and ready to go out on the town.",
    "We've got a chunk of money in our pocket and are ready to spend."
  ].join(" ")
};

const adultComparison = compareProfileToEvent(adultProfile, eventPage);
const adultPageModel = createTailoredPageModel(adultProfile, eventPage, adultComparison);

assert.equal(adultComparison.ageCompatibility.status, "match");
assert.equal(adultComparison.ageScoreAdjustment, 30);
assert.equal(adultComparison.spendReadyPremiumFit, true);
assert.equal(adultComparison.spendReadyScoreBonus, 10);
assert.equal(adultComparison.scoreFloor, 82);
assert.ok(adultComparison.score >= 80);
assert.equal(adultComparison.unmetNeedPenalty, 0);
assert.deepEqual(adultComparison.interests, ["social energy"]);
assert.match(adultPageModel.proofPoint, /^[8-9]\d% fit|100% fit/);
assert.doesNotMatch(adultPageModel.proofPoint, /^0% fit/);

const spendReadyAdultProfile = {
  title: "Adult",
  summary: [
    "This profile appears to describe adult users.",
    "Key clues: We are a couple that's 35 years old and we love live theater.",
    "We love to spend as much money as we can to have a good time."
  ].join(" ")
};

const spendReadyAdultComparison = compareProfileToEvent(spendReadyAdultProfile, eventPage);

assert.equal(spendReadyAdultComparison.ageCompatibility.status, "match");
assert.equal(spendReadyAdultComparison.spendReadyPremiumFit, true);
assert.equal(spendReadyAdultComparison.spendReadyScoreBonus, 10);
assert.equal(spendReadyAdultComparison.scoreFloor, 82);
assert.equal(spendReadyAdultComparison.unmetNeedPenalty, 0);
assert.ok(spendReadyAdultComparison.score >= 80);

const adultEntertainmentEventPage = {
  ...eventPage,
  title: "Late Night Cabaret",
  description: "A nightlife cabaret with cocktails, live music, social energy, and mature themes.",
  eventInfo: {
    ...eventPage.eventInfo,
    name: "Late Night Cabaret",
    sections: [
      {
        title: "About",
        body: "Adult entertainment with cocktails, live music, and mature audiences."
      },
      {
        title: "Age guidance",
        body: "Children under 16 are not permitted."
      }
    ],
    ticketInfo: {
      summary: "$45"
    }
  },
  text: [
    "nightlife cabaret cocktails drinks live music social group together",
    "adult entertainment mature audiences",
    "Children under 16 are not permitted."
  ].join(" ")
};

const adultEntertainmentComparison = compareProfileToEvent(adultProfile, adultEntertainmentEventPage);

assert.equal(adultEntertainmentComparison.ageCompatibility.status, "match");
assert.equal(adultEntertainmentComparison.ageScoreAdjustment, 30);
assert.equal(adultEntertainmentComparison.spendReadyPremiumFit, true);
assert.equal(adultEntertainmentComparison.spendReadyScoreBonus, 10);
assert.equal(adultEntertainmentComparison.scoreFloor, 82);
assert.ok(adultEntertainmentComparison.score >= 80);
assert.deepEqual(adultEntertainmentComparison.interests, ["social energy"]);

const childFriendlyEventPage = {
  ...eventPage,
  title: "Family Garden Concert",
  description: "A family concert with kids activities, simple access, seating, and comfort details.",
  eventInfo: {
    ...eventPage.eventInfo,
    name: "Family Garden Concert",
    sections: [
      {
        title: "About",
        body: "Families, kids, children, parents, and caregivers are welcome at this relaxed outdoor music event."
      }
    ],
    ticketInfo: {
      summary: "Free"
    }
  },
  text: [
    "easy simple schedule access accessibility comfortable comfort seating",
    "family kids children parents caregivers safety fun",
    "free outdoor music together"
  ].join(" ")
};

const childFriendlyComparison = compareProfileToEvent(profile, childFriendlyEventPage);
const childFriendlyPageModel = createTailoredPageModel(profile, childFriendlyEventPage, childFriendlyComparison);

assert.equal(childFriendlyComparison.ageCompatibility.status, "match");
assert.equal(childFriendlyComparison.ageScoreCap, null);
assert.ok(childFriendlyComparison.score >= 60);
assert.ok(childFriendlyComparison.interests.includes("family value"));
assert.match(childFriendlyPageModel.proofPoint, /^[6-9]\d% fit|100% fit/);

const sparseProfile = {
  title: "Custom Profile",
  summary: "Looking for something memorable with a calm pace."
};

const sparseEventPage = {
  sourceUrl: "https://example.com/sparse",
  title: "Quiet Evening",
  description: "A simple local evening event.",
  keywords: ["local"],
  eventInfo: {
    name: "Quiet Evening",
    sections: []
  },
  text: "local evening event"
};

const sparseComparison = compareProfileToEvent(sparseProfile, sparseEventPage);

assert.notEqual(sparseComparison.ageCompatibility.status, "mismatch");
assert.equal(sparseComparison.ageCompatibility.adultFriendlyEvent, false);
assert.equal(sparseComparison.scoreFloor, 0);
assert.equal(sparseComparison.score, 0);

const adultFriendlyNoKidsComparison = compareProfileToEvent(sparseProfile, adultEntertainmentEventPage);

assert.notEqual(adultFriendlyNoKidsComparison.ageCompatibility.status, "mismatch");
assert.equal(adultFriendlyNoKidsComparison.ageCompatibility.adultFriendlyEvent, true);
assert.equal(adultFriendlyNoKidsComparison.scoreFloor, 50);
assert.equal(adultFriendlyNoKidsComparison.score, 50);

const youngFamilyProfile = {
  title: "Young Family",
  summary: [
    "Budget awareness, safety, convenience, flexibility, and activities that work for multiple ages.",
    "Emphasize low-friction planning, family value, trust, and shared experiences."
  ].join(" ")
};

const freeSparseEventPage = {
  ...sparseEventPage,
  description: "A free local evening event.",
  text: "local evening event free"
};

const youngFamilyNoAgeRestrictionsComparison = compareProfileToEvent(youngFamilyProfile, freeSparseEventPage);

assert.equal(youngFamilyNoAgeRestrictionsComparison.ageCompatibility.profileAgeGroup, "family");
assert.notEqual(youngFamilyNoAgeRestrictionsComparison.ageCompatibility.status, "mismatch");
assert.equal(youngFamilyNoAgeRestrictionsComparison.ageCompatibility.adultFriendlyEvent, false);
assert.equal(youngFamilyNoAgeRestrictionsComparison.scoreFloor, 50);
assert.equal(youngFamilyNoAgeRestrictionsComparison.score, 50);

const youngFamilyMissingAffordabilityComparison = compareProfileToEvent(youngFamilyProfile, sparseEventPage);

assert.equal(youngFamilyMissingAffordabilityComparison.ageCompatibility.profileAgeGroup, "family");
assert.notEqual(youngFamilyMissingAffordabilityComparison.ageCompatibility.status, "mismatch");
assert.equal(youngFamilyMissingAffordabilityComparison.ageCompatibility.adultFriendlyEvent, false);
assert.equal(youngFamilyMissingAffordabilityComparison.scoreFloor, 40);
assert.equal(youngFamilyMissingAffordabilityComparison.score, 40);
