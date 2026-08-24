// CG-20 setting: no gods, no water, and no going back.
//
// Registers itself into SETTINGS (declared in character-generator-data.js,
// which must load first) -- see the comment above that array for the
// registration pattern.

SETTINGS.push({
  id: "dark-sun",
  name: "Dark Sun",
  code: "D",
  label: "dark sun",
  note: "no gods, no water, and no going back.",
  // A thinner bestiary and an emptier sky: the gods are gone, which is
  // what takes the cleric and the paladin with them. The goliath stays
  // as the big folk; the half-dwarf and the carapan (see SPECIES in
  // character-generator-data.js) are native here and nowhere else.
  species: (list) =>
    list.filter(
      (entry) =>
        entry.id !== "gnome" &&
        entry.id !== "dragonborn" &&
        entry.id !== "tiefling" &&
        entry.id !== "orc",
    ),
  classes: (list) =>
    list.filter((cls) => cls.id !== "cleric" && cls.id !== "paladin"),
  names: {
    human: {
      given: [
        ["Ka", "Sef", "Tor", "Nim", "Ras", "Uld", "Yez", "Bri"],
        ["ra", "ok", "ith", "ax", "un", "el", "ash", "ka"],
      ],
      family: [
        ["Salt", "Glass", "Cinder", "Dry", "Sun", "Bone", "Char", "Thirst"],
        [
          "walker",
          "cutter",
          "born",
          "wind",
          "glare",
          "field",
          "tender",
          "comb",
        ],
      ],
    },
    dwarf: {
      given: [
        ["Bur", "Kad", "Mol", "Grim", "Tesh", "Ond", "Ur", "Zad"],
        ["ak", "un", "esh", "ir", "om", "az", "ek", "ar"],
      ],
      family: [
        ["Deep", "Stone", "Salt", "Furrow", "Iron", "Kiln", "Sand", "Cistern"],
        ["keeper", "tender", "oath", "delve", "warden", "brand", "hold", "vow"],
      ],
    },
  },
  epithets: [
    "the Sun-Struck",
    "of the Dry Well",
    "who Walked It",
    "the Unwatered",
    "the Salt-Cured",
    "of Ninth Well",
    "the Still Breathing",
    "the Sold Twice",
    "the Bone-Cutter",
    "who Crossed the Glass",
  ],
  regions: [
    "the Glass Flats",
    "Saltmourn",
    "the Cinder Reach",
    "Ninth Well",
    "the Burnt Stair",
    "Kiln",
    "the Scour",
    "Last Shade",
    "the Hollow Cistern",
    "Emberreach",
  ],
  subclasses: {
    barbarian: "the Sand-Born Fury",
    druid: "Circle of the Last Water",
    fighter: "Arena Champion",
    ranger: "Flats-Walker",
    sorcerer: "the Cinder Bloodline",
    wizard: "the Ashen Art",
  },
});
