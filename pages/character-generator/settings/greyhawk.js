// CG-20 setting: older and colder, a narrower roster.
//
// Registers itself into SETTINGS (declared in character-generator-data.js,
// which must load first) -- see the comment above that array for the
// registration pattern.

SETTINGS.push({
  id: "greyhawk",
  name: "Greyhawk",
  code: "H",
  label: "greyhawk",
  note: "older and colder. a narrower roster, a longer memory.",
  species: (list) =>
    list.filter((entry) => entry.id !== "dragonborn" && entry.id !== "goliath"),
  names: {
    human: {
      given: [
        ["Ald", "Cuth", "Erly", "Gwyn", "Hal", "Osric", "Ren", "Wilm"],
        ["ric", "mund", "a", "eth", "win", "gar", "ild", "ot"],
      ],
      family: [
        ["Grey", "Marsh", "Kettle", "Black", "Stand", "Old", "Rook", "Bram"],
        ["ward", "field", "stone", "rush", "gate", "barrow", "mill", "hollow"],
      ],
    },
  },
  epithets: [
    "the Elder",
    "of the Old March",
    "the Grey",
    "the Sworn",
    "the Unransomed",
    "of the Ninefold Hills",
    "the Weatherbeaten",
    "the Landless",
  ],
  regions: [
    "the Kettlemarch",
    "the Grey Vale",
    "the Ashen Downs",
    "the Ninefold Hills",
    "the Marchward",
    "Blackrush",
    "the Old Duchy",
    "Hollowbrake",
  ],
  subclasses: {
    cleric: "Old Faith Domain",
    fighter: "Company of the Standing Shield",
    ranger: "Marchwarden",
    wizard: "the Grey Circle",
  },
});
