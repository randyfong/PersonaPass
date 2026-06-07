const textOnlyVideoInput = {
  targetProfile: {
    title: "Young Family",
    summary: "Budget-aware parents looking for safe, simple weekend fun.",
    tone: "Playful, reassuring, and practical."
  },
  eventSource: {
    title: "Outdoor Movie Night",
    description: "A free neighborhood screening with snacks, lawn seating, and family activities.",
    eventInfo: {
      name: "Outdoor Movie Night",
      startDate: "Saturday at 7:30 PM",
      location: "Civic Park",
      ticketInfo: {
        summary: "Free entry"
      },
      sections: [
        {
          title: "Before the movie",
          body: "Arrive early for music, crafts, and picnic space."
        }
      ]
    }
  }
};

const imageVideoInput = {
  targetProfile: {
    title: "Adult",
    summary: "Social, design-conscious guests looking for a lively night out."
  },
  eventSource: {
    title: "Rooftop Jazz Social",
    description: "Live jazz, city views, cocktails, and an energetic after-work crowd.",
    images: [
      "https://example.com/assets/rooftop.jpg",
      {
        url: "https://example.com/assets/jazz-stage.png",
        alt: "Jazz stage"
      }
    ],
    mediaAssets: [
      {
        type: "logo",
        url: "https://example.com/assets/logo.webp"
      }
    ],
    eventInfo: {
      name: "Rooftop Jazz Social",
      image: "https://example.com/assets/hero.jpg",
      location: "Skyline Terrace"
    }
  }
};

const urlRouteVideoInput = {
  profile: textOnlyVideoInput.targetProfile,
  eventUrl: "https://example.com/outdoor-movie-night"
};

module.exports = {
  imageVideoInput,
  textOnlyVideoInput,
  urlRouteVideoInput
};
