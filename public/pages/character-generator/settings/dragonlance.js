// CG-20 setting: moons, oaths, and a war that already happened.
//
// Registers itself into SETTINGS (declared in character-generator-data.js,
// which must load first) -- see the comment above that array for the
// registration pattern.

SETTINGS.push({
  id: "dragonlance",
  name: "Dragonlance",
  code: "L",
  label: "dragonlance",
  note: "moons, oaths, and a war that already happened.",
  // Small folk carry this one, so the roadkin are native here. Nothing
  // to pact with means no warlock.
  species: (list) =>
    list.filter(
      (entry) =>
        entry.id !== "orc" &&
        entry.id !== "goliath" &&
        entry.id !== "dragonborn" &&
        entry.id !== "tiefling",
    ),
  classes: (list) => list.filter((cls) => cls.id !== "warlock"),
  names: {
    human: {
      given: [
        ["Aur", "Ban", "Cael", "Dara", "Ist", "Mar", "Ren", "Til"],
        ["ian", "eth", "wyn", "or", "ana", "ist", "us", "el"],
      ],
      family: [
        ["Silver", "Moon", "Bright", "Iron", "Lance", "Storm", "White", "Ever"],
        ["blade", "watch", "banner", "field", "moor", "vale", "oath", "light"],
      ],
    },
    elf: {
      given: [
        ["Sil", "Thae", "Eryn", "Las", "Quen", "Faer", "Ith", "Aelu"],
        ["wen", "driel", "ianthe", "or", "wyn", "iel", "essa", "une"],
      ],
      family: [
        ["Star", "Leaf", "Moon", "Dawn", "Wind", "Silver", "Dew", "Sky"],
        ["shade", "song", "glade", "whisper", "fall", "reach", "bloom", "rest"],
      ],
    },
    gnome: {
      given: [
        ["Cog", "Bell", "Pyr", "Nim", "Tock", "Ves", "Wim", "Zan"],
        ["ric", "itt", "ora", "ex", "ple", "adin", "us", "ick"],
      ],
      family: [
        ["Over", "Under", "Cross", "Back", "Fore", "Counter", "Half", "Double"],
        ["thread", "wound", "spring", "gauge", "flange", "ratchet", "bearing"],
      ],
    },
    halfling: {
      given: [
        ["Pell", "Bram", "Dilly", "Wren", "Fen", "Mab", "Corry", "Nix"],
        ["kin", "by", "et", "ow", "le", "ra", "und", "ick"],
      ],
      family: [
        ["Nine", "Ever", "Far", "Odd", "Quick", "Long", "Half", "Bright"],
        ["pockets", "road", "whistle", "spoon", "latch", "penny", "step"],
      ],
    },
  },
  epithets: [
    "the Late-Sworn",
    "of the Lantern Road",
    "the Moonlit",
    "the Oathless",
    "who Waited",
    "of the Long Barrows",
    "the Twice-Promised",
    "the Unheralded",
    "the Star-Counted",
    "who Kept the Vow",
  ],
  regions: [
    "the Vale of Lamps",
    "Silverpine",
    "the Lantern Road",
    "High Kiln",
    "Whitemoor",
    "the Redwatch",
    "Ninewells",
    "the Long Barrows",
    "the Farwatch",
    "Moonmere",
  ],
  subclasses: {
    bard: "College of the Long Road",
    cleric: "Restored Faith Domain",
    paladin: "Oath of the Broken Lance",
    rogue: "the Lantern Company",
    sorcerer: "the Moonborn Line",
    wizard: "Order of the Crimson Moon",
  },
});
