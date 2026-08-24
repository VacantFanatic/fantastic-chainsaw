// CG-20 setting: crowded and chartered, refuses nothing.
//
// Registers itself into SETTINGS (declared in character-generator-data.js,
// which must load first) -- see the comment above that array for the
// registration pattern.

SETTINGS.push({
  id: "forgotten-realms",
  name: "Forgotten Realms",
  code: "F",
  label: "forgotten realms",
  note: "crowded and chartered. everything is somewhere.",
  // The one setting that refuses nothing: its whole character is that
  // the entire roster already lives there.
  names: {
    human: {
      given: [
        ["Aer", "Bral", "Dorn", "Elmi", "Kes", "Ryld", "Tal", "Vaeri"],
        ["an", "eth", "ara", "us", "wyn", "ir", "ond", "essa"],
      ],
      family: [
        [
          "Storm",
          "Silver",
          "Dawn",
          "Amber",
          "Black",
          "Hearth",
          "Sun",
          "Winter",
        ],
        ["hand", "moon", "staff", "hall", "water", "song", "mantle", "fell"],
      ],
    },
  },
  epithets: [
    "of the Amber Coast",
    "the Well-Connected",
    "the Chartered",
    "the Twice-Contracted",
    "of No Guild",
    "the Bonded",
    "the Recommended",
    "the Overbooked",
  ],
  regions: [
    "the Amber Coast",
    "the Harrowmark",
    "Nine Bridges",
    "the Silverfell",
    "Candlewatch",
    "the Salt Marches",
    "Old Thornhold",
    "the Winterhall",
  ],
  subclasses: {
    bard: "College of the Nine Bridges",
    cleric: "Dawnkeeper Domain",
    rogue: "the Quiet Trade",
    wizard: "Order of the Amber Scroll",
  },
});
