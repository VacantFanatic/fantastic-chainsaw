// CG–20 — a level 1 D&D character generator, wired to a fake front panel.
//
// Rules content (species, classes, backgrounds, gear, spells) is from the
// System Reference Document 5.2.1, (c) Wizards of the Coast LLC, licensed
// under CC BY 4.0. The SRD has no name tables, so the names here are
// synthesised locally from syllable banks — those are made up, not SRD.
//
// The whole character is a pure function of five short seeds, one per
// channel (name / species / class / background / stats). That is what the
// serial number on the panel is: the five seeds, printed. Paste a serial
// into the URL hash and you get the same character back. The DIP switches
// hold a channel's seed across a roll.

/* ---------------------------------------------------------
   Reference data — SRD 5.2.1
   --------------------------------------------------------- */

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

const SKILLS = [
  { id: "athletics", name: "Athletics", ability: "str" },
  { id: "acrobatics", name: "Acrobatics", ability: "dex" },
  { id: "sleight-of-hand", name: "Sleight of Hand", ability: "dex" },
  { id: "stealth", name: "Stealth", ability: "dex" },
  { id: "arcana", name: "Arcana", ability: "int" },
  { id: "history", name: "History", ability: "int" },
  { id: "investigation", name: "Investigation", ability: "int" },
  { id: "nature", name: "Nature", ability: "int" },
  { id: "religion", name: "Religion", ability: "int" },
  { id: "animal-handling", name: "Animal Handling", ability: "wis" },
  { id: "insight", name: "Insight", ability: "wis" },
  { id: "medicine", name: "Medicine", ability: "wis" },
  { id: "perception", name: "Perception", ability: "wis" },
  { id: "survival", name: "Survival", ability: "wis" },
  { id: "deception", name: "Deception", ability: "cha" },
  { id: "intimidation", name: "Intimidation", ability: "cha" },
  { id: "performance", name: "Performance", ability: "cha" },
  { id: "persuasion", name: "Persuasion", ability: "cha" },
];

const SKILL_BY_NAME = {};
SKILLS.forEach((skill) => {
  SKILL_BY_NAME[skill.name] = skill;
});

const ORIGIN_FEATS = [
  "Alert",
  "Crafter",
  "Healer",
  "Lucky",
  "Magic Initiate (Cleric)",
  "Magic Initiate (Druid)",
  "Magic Initiate (Wizard)",
  "Musician",
  "Savage Attacker",
  "Skilled",
  "Tavern Brawler",
  "Tough",
];

const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];

const STANDARD_LANGUAGES = [
  "Common Sign Language",
  "Draconic",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
];

const SPECIES = [
  {
    id: "dragonborn",
    name: "Dragonborn",
    size: ["Medium"],
    speed: 30,
    traits: [
      "Breath Weapon — 1d10 damage in a 15 ft. Cone or 30 ft. Line, PB times per Long Rest",
      "Damage Resistance — to your ancestry's damage type",
      "Darkvision 60 ft.",
      "Draconic Flight — at level 5",
    ],
    lineage: {
      label: "Draconic Ancestry",
      options: [
        { name: "Black", note: "Acid damage" },
        { name: "Blue", note: "Lightning damage" },
        { name: "Brass", note: "Fire damage" },
        { name: "Bronze", note: "Lightning damage" },
        { name: "Copper", note: "Acid damage" },
        { name: "Gold", note: "Fire damage" },
        { name: "Green", note: "Poison damage" },
        { name: "Red", note: "Fire damage" },
        { name: "Silver", note: "Cold damage" },
        { name: "White", note: "Cold damage" },
      ],
    },
  },
  {
    id: "dwarf",
    name: "Dwarf",
    size: ["Medium"],
    speed: 30,
    traits: [
      "Darkvision 120 ft.",
      "Dwarven Resilience — Poison resistance, advantage on Poison saves",
      "Dwarven Toughness — +1 Hit Point per level",
      "Stonecunning — Tremorsense 60 ft. as a Bonus Action",
    ],
  },
  {
    id: "elf",
    name: "Elf",
    size: ["Medium"],
    speed: 30,
    traits: [
      "Darkvision 60 ft.",
      "Fey Ancestry — advantage on saves against the Charmed condition",
      "Trance — a Long Rest takes 4 hours",
    ],
    keenSenses: ["Insight", "Perception", "Survival"],
    lineage: {
      label: "Elven Lineage",
      options: [
        {
          name: "Drow",
          note: "Darkvision 120 ft.; Dancing Lights, then Faerie Fire, Darkness",
          darkvision: 120,
        },
        {
          name: "High Elf",
          note: "Prestidigitation, then Detect Magic, Misty Step",
        },
        {
          name: "Wood Elf",
          note: "Speed 35 ft.; Druidcraft, then Longstrider, Pass without Trace",
          speed: 35,
        },
      ],
    },
  },
  {
    id: "gnome",
    name: "Gnome",
    size: ["Small"],
    speed: 30,
    traits: [
      "Darkvision 60 ft.",
      "Gnomish Cunning — advantage on Int, Wis, and Cha saving throws",
    ],
    lineage: {
      label: "Gnomish Lineage",
      options: [
        {
          name: "Forest Gnome",
          note: "Minor Illusion; Speak with Animals as a Ritual",
        },
        {
          name: "Rock Gnome",
          note: "Mending, Prestidigitation; build Tiny clockwork devices",
        },
      ],
    },
  },
  {
    id: "goliath",
    name: "Goliath",
    size: ["Medium"],
    speed: 35,
    traits: [
      "Powerful Build — advantage on Grappled saves, count as Large for carry",
      "Large Form — at level 5",
    ],
    lineage: {
      label: "Giant Ancestry",
      options: [
        { name: "Cloud's Jaunt", note: "Bonus Action teleport 30 ft." },
        { name: "Fire's Burn", note: "1d10 Fire damage on a hit" },
        { name: "Frost's Chill", note: "1d6 Cold damage and reduce Speed" },
        {
          name: "Hill's Tumble",
          note: "Knock a Large or smaller target Prone",
        },
        { name: "Stone's Endurance", note: "Reduce damage by 1d12 + Con" },
        { name: "Storm's Thunder", note: "1d8 Thunder damage as a Reaction" },
      ],
    },
  },
  {
    id: "halfling",
    name: "Halfling",
    size: ["Small"],
    speed: 30,
    traits: [
      "Brave — advantage on saves against the Frightened condition",
      "Halfling Nimbleness — move through the space of larger creatures",
      "Luck — reroll a 1 on a D20 Test",
      "Naturally Stealthy — Hide behind a larger creature",
    ],
  },
  {
    id: "human",
    name: "Human",
    size: ["Medium", "Small"],
    speed: 30,
    traits: [
      "Resourceful — Heroic Inspiration after every Long Rest",
      "Skillful — proficiency in one extra skill",
      "Versatile — an extra Origin feat",
    ],
  },
  {
    id: "orc",
    name: "Orc",
    size: ["Medium"],
    speed: 30,
    traits: [
      "Adrenaline Rush — Dash as a Bonus Action and gain temporary HP",
      "Darkvision 120 ft.",
      "Relentless Endurance — drop to 1 HP instead of 0, once per Long Rest",
    ],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    size: ["Medium", "Small"],
    speed: 30,
    traits: ["Darkvision 60 ft.", "Otherworldly Presence — Thaumaturgy"],
    lineage: {
      label: "Fiendish Legacy",
      options: [
        {
          name: "Abyssal",
          note: "Poison resistance; Poison Spray, then Ray of Sickness",
        },
        {
          name: "Chthonic",
          note: "Necrotic resistance; Chill Touch, then False Life",
        },
        {
          name: "Infernal",
          note: "Fire resistance; Fire Bolt, then Hellish Rebuke",
        },
      ],
    },
  },
];

const CLASSES = [
  {
    id: "barbarian",
    name: "Barbarian",
    hitDie: 12,
    primary: ["str"],
    saves: ["str", "con"],
    skillCount: 2,
    skillList: [
      "Animal Handling",
      "Athletics",
      "Intimidation",
      "Nature",
      "Perception",
      "Survival",
    ],
    subclass: "Path of the Berserker",
    features: ["Rage", "Unarmored Defense", "Weapon Mastery (2)"],
    armorTraining: "Light and Medium armor, Shields",
    weaponTraining: "Simple and Martial weapons",
    toolTraining: "—",
    kit: {
      armor: null,
      shield: false,
      weapons: ["Greataxe", "Handaxe", "Handaxe", "Handaxe", "Handaxe"],
      gear: ["Explorer's Pack"],
      gp: 15,
    },
    unarmoredDefense: "con",
  },
  {
    id: "bard",
    name: "Bard",
    hitDie: 8,
    primary: ["cha"],
    saves: ["dex", "cha"],
    skillCount: 3,
    skillList: "any",
    subclass: "College of Lore",
    features: ["Bardic Inspiration", "Spellcasting"],
    armorTraining: "Light armor",
    weaponTraining: "Simple weapons",
    toolTraining: "Three Musical Instruments of your choice",
    kit: {
      armor: "Leather Armor",
      shield: false,
      weapons: ["Dagger", "Dagger"],
      gear: ["Musical Instrument", "Entertainer's Pack"],
      gp: 19,
    },
    casting: { ability: "cha", cantrips: 2, prepared: 4, slots: 2 },
  },
  {
    id: "cleric",
    name: "Cleric",
    hitDie: 8,
    primary: ["wis"],
    saves: ["wis", "cha"],
    skillCount: 2,
    skillList: ["History", "Insight", "Medicine", "Persuasion", "Religion"],
    subclass: "Life Domain",
    features: ["Spellcasting", "Divine Order"],
    armorTraining: "Light and Medium armor, Shields",
    weaponTraining: "Simple weapons",
    toolTraining: "—",
    kit: {
      armor: "Chain Shirt",
      shield: true,
      weapons: ["Mace"],
      gear: ["Holy Symbol", "Priest's Pack"],
      gp: 7,
    },
    casting: { ability: "wis", cantrips: 3, prepared: 4, slots: 2 },
  },
  {
    id: "druid",
    name: "Druid",
    hitDie: 8,
    primary: ["wis"],
    saves: ["int", "wis"],
    skillCount: 2,
    skillList: [
      "Animal Handling",
      "Arcana",
      "Insight",
      "Medicine",
      "Nature",
      "Perception",
      "Religion",
      "Survival",
    ],
    subclass: "Circle of the Land",
    features: ["Spellcasting", "Druidic", "Primal Order"],
    armorTraining: "Light armor, Shields",
    weaponTraining: "Simple weapons",
    toolTraining: "Herbalism Kit",
    kit: {
      armor: "Leather Armor",
      shield: true,
      weapons: ["Sickle"],
      gear: [
        "Druidic Focus (Quarterstaff)",
        "Explorer's Pack",
        "Herbalism Kit",
      ],
      gp: 9,
    },
    casting: { ability: "wis", cantrips: 2, prepared: 4, slots: 2 },
  },
  {
    id: "fighter",
    name: "Fighter",
    hitDie: 10,
    primary: ["str", "dex"],
    saves: ["str", "con"],
    skillCount: 2,
    skillList: [
      "Acrobatics",
      "Animal Handling",
      "Athletics",
      "History",
      "Insight",
      "Intimidation",
      "Perception",
      "Persuasion",
      "Survival",
    ],
    subclass: "Champion",
    features: ["Fighting Style", "Second Wind", "Weapon Mastery (3)"],
    armorTraining: "Light, Medium, and Heavy armor, Shields",
    weaponTraining: "Simple and Martial weapons",
    toolTraining: "—",
    kit: {
      armor: "Chain Mail",
      shield: false,
      weapons: ["Greatsword", "Flail", "Javelin"],
      gear: ["8 Javelins", "Dungeoneer's Pack"],
      gp: 4,
    },
    fightingStyles: [
      "Archery",
      "Defense",
      "Dueling",
      "Great Weapon Fighting",
      "Protection",
      "Two-Weapon Fighting",
    ],
  },
  {
    id: "monk",
    name: "Monk",
    hitDie: 8,
    primary: ["dex", "wis"],
    saves: ["str", "dex"],
    skillCount: 2,
    skillList: [
      "Acrobatics",
      "Athletics",
      "History",
      "Insight",
      "Religion",
      "Stealth",
    ],
    subclass: "Warrior of the Open Hand",
    features: ["Martial Arts (1d6)", "Unarmored Defense"],
    armorTraining: "—",
    weaponTraining:
      "Simple weapons and Martial weapons with the Light property",
    toolTraining: "One Artisan's Tools or Musical Instrument",
    kit: {
      armor: null,
      shield: false,
      weapons: ["Spear", "Dagger", "Dagger"],
      gear: ["5 Daggers", "Artisan's Tools", "Explorer's Pack"],
      gp: 11,
    },
    unarmoredDefense: "wis",
    martialArts: true,
  },
  {
    id: "paladin",
    name: "Paladin",
    hitDie: 10,
    primary: ["str", "cha"],
    saves: ["wis", "cha"],
    skillCount: 2,
    skillList: [
      "Athletics",
      "Insight",
      "Intimidation",
      "Medicine",
      "Persuasion",
      "Religion",
    ],
    subclass: "Oath of Devotion",
    features: ["Lay On Hands", "Spellcasting", "Weapon Mastery (2)"],
    armorTraining: "Light, Medium, and Heavy armor, Shields",
    weaponTraining: "Simple and Martial weapons",
    toolTraining: "—",
    kit: {
      armor: "Chain Mail",
      shield: true,
      weapons: ["Longsword", "Javelin"],
      gear: ["6 Javelins", "Holy Symbol", "Priest's Pack"],
      gp: 9,
    },
    casting: { ability: "cha", cantrips: 0, prepared: 2, slots: 2 },
  },
  {
    id: "ranger",
    name: "Ranger",
    hitDie: 10,
    primary: ["dex", "wis"],
    saves: ["str", "dex"],
    skillCount: 3,
    skillList: [
      "Animal Handling",
      "Athletics",
      "Insight",
      "Investigation",
      "Nature",
      "Perception",
      "Stealth",
      "Survival",
    ],
    subclass: "Hunter",
    features: [
      "Spellcasting",
      "Favored Enemy (Hunter's Mark)",
      "Weapon Mastery (2)",
    ],
    armorTraining: "Light and Medium armor, Shields",
    weaponTraining: "Simple and Martial weapons",
    toolTraining: "—",
    kit: {
      armor: "Studded Leather Armor",
      shield: false,
      weapons: ["Scimitar", "Shortsword", "Longbow"],
      gear: [
        "20 Arrows",
        "Quiver",
        "Druidic Focus (sprig of mistletoe)",
        "Explorer's Pack",
      ],
      gp: 7,
    },
    casting: { ability: "wis", cantrips: 0, prepared: 2, slots: 2 },
  },
  {
    id: "rogue",
    name: "Rogue",
    hitDie: 8,
    primary: ["dex"],
    saves: ["dex", "int"],
    skillCount: 4,
    skillList: [
      "Acrobatics",
      "Athletics",
      "Deception",
      "Insight",
      "Intimidation",
      "Investigation",
      "Perception",
      "Persuasion",
      "Sleight of Hand",
      "Stealth",
    ],
    subclass: "Thief",
    features: [
      "Expertise (2 skills)",
      "Sneak Attack (1d6)",
      "Thieves' Cant",
      "Weapon Mastery (2)",
    ],
    armorTraining: "Light armor",
    weaponTraining: "Simple weapons, Martial weapons with Finesse or Light",
    toolTraining: "Thieves' Tools",
    kit: {
      armor: "Leather Armor",
      shield: false,
      weapons: ["Shortsword", "Shortbow", "Dagger", "Dagger"],
      gear: ["20 Arrows", "Quiver", "Thieves' Tools", "Burglar's Pack"],
      gp: 8,
    },
    expertise: 2,
  },
  {
    id: "sorcerer",
    name: "Sorcerer",
    hitDie: 6,
    primary: ["cha"],
    saves: ["con", "cha"],
    skillCount: 2,
    skillList: [
      "Arcana",
      "Deception",
      "Insight",
      "Intimidation",
      "Persuasion",
      "Religion",
    ],
    subclass: "Draconic Sorcery",
    features: ["Spellcasting", "Innate Sorcery"],
    armorTraining: "—",
    weaponTraining: "Simple weapons",
    toolTraining: "—",
    kit: {
      armor: null,
      shield: false,
      weapons: ["Spear", "Dagger", "Dagger"],
      gear: ["Arcane Focus (crystal)", "Dungeoneer's Pack"],
      gp: 28,
    },
    casting: { ability: "cha", cantrips: 4, prepared: 2, slots: 2 },
  },
  {
    id: "warlock",
    name: "Warlock",
    hitDie: 8,
    primary: ["cha"],
    saves: ["wis", "cha"],
    skillCount: 2,
    skillList: [
      "Arcana",
      "Deception",
      "History",
      "Intimidation",
      "Investigation",
      "Nature",
      "Religion",
    ],
    subclass: "Fiend Patron",
    features: ["Eldritch Invocations (1)", "Pact Magic"],
    armorTraining: "Light armor",
    weaponTraining: "Simple weapons",
    toolTraining: "—",
    kit: {
      armor: "Leather Armor",
      shield: false,
      weapons: ["Sickle", "Dagger", "Dagger"],
      gear: ["Arcane Focus (orb)", "Book (occult lore)", "Scholar's Pack"],
      gp: 15,
    },
    casting: {
      ability: "cha",
      cantrips: 2,
      prepared: 2,
      slots: 1,
      label: "Pact Magic",
    },
  },
  {
    id: "wizard",
    name: "Wizard",
    hitDie: 6,
    primary: ["int"],
    saves: ["int", "wis"],
    skillCount: 2,
    skillList: [
      "Arcana",
      "History",
      "Insight",
      "Investigation",
      "Medicine",
      "Nature",
      "Religion",
    ],
    subclass: "Evoker",
    features: ["Spellcasting", "Ritual Adept", "Arcane Recovery"],
    armorTraining: "—",
    weaponTraining: "Simple weapons",
    toolTraining: "—",
    kit: {
      armor: null,
      shield: false,
      weapons: ["Dagger", "Dagger"],
      gear: [
        "Arcane Focus (Quarterstaff)",
        "Robe",
        "Spellbook",
        "Scholar's Pack",
      ],
      gp: 5,
    },
    casting: { ability: "int", cantrips: 3, prepared: 4, slots: 2, book: 6 },
  },
];

const BACKGROUNDS = [
  {
    name: "Acolyte",
    abilities: ["int", "wis", "cha"],
    feat: "Magic Initiate (Cleric)",
    skills: ["Insight", "Religion"],
    tool: "Calligrapher's Supplies",
  },
  {
    name: "Artisan",
    abilities: ["str", "dex", "int"],
    feat: "Crafter",
    skills: ["Investigation", "Persuasion"],
    tool: "Artisan's Tools",
  },
  {
    name: "Charlatan",
    abilities: ["dex", "con", "cha"],
    feat: "Skilled",
    skills: ["Deception", "Sleight of Hand"],
    tool: "Forgery Kit",
  },
  {
    name: "Criminal",
    abilities: ["dex", "con", "int"],
    feat: "Alert",
    skills: ["Sleight of Hand", "Stealth"],
    tool: "Thieves' Tools",
  },
  {
    name: "Entertainer",
    abilities: ["str", "dex", "cha"],
    feat: "Musician",
    skills: ["Acrobatics", "Performance"],
    tool: "Musical Instrument",
  },
  {
    name: "Farmer",
    abilities: ["str", "con", "wis"],
    feat: "Tough",
    skills: ["Animal Handling", "Nature"],
    tool: "Carpenter's Tools",
  },
  {
    name: "Guard",
    abilities: ["str", "int", "wis"],
    feat: "Alert",
    skills: ["Athletics", "Perception"],
    tool: "Gaming Set",
  },
  {
    name: "Guide",
    abilities: ["dex", "con", "wis"],
    feat: "Magic Initiate (Druid)",
    skills: ["Stealth", "Survival"],
    tool: "Cartographer's Tools",
  },
  {
    name: "Hermit",
    abilities: ["con", "wis", "cha"],
    feat: "Healer",
    skills: ["Medicine", "Religion"],
    tool: "Herbalism Kit",
  },
  {
    name: "Merchant",
    abilities: ["con", "int", "cha"],
    feat: "Lucky",
    skills: ["Animal Handling", "Persuasion"],
    tool: "Navigator's Tools",
  },
  {
    name: "Noble",
    abilities: ["str", "int", "cha"],
    feat: "Skilled",
    skills: ["History", "Persuasion"],
    tool: "Gaming Set",
  },
  {
    name: "Sage",
    abilities: ["con", "int", "wis"],
    feat: "Magic Initiate (Wizard)",
    skills: ["Arcana", "History"],
    tool: "Calligrapher's Supplies",
  },
  {
    name: "Sailor",
    abilities: ["str", "dex", "wis"],
    feat: "Tavern Brawler",
    skills: ["Acrobatics", "Perception"],
    tool: "Navigator's Tools",
  },
  {
    name: "Scribe",
    abilities: ["dex", "int", "wis"],
    feat: "Skilled",
    skills: ["Investigation", "Perception"],
    tool: "Calligrapher's Supplies",
  },
  {
    name: "Soldier",
    abilities: ["str", "dex", "con"],
    feat: "Savage Attacker",
    skills: ["Athletics", "Intimidation"],
    tool: "Gaming Set",
  },
  {
    name: "Wayfarer",
    abilities: ["dex", "wis", "cha"],
    feat: "Lucky",
    skills: ["Insight", "Stealth"],
    tool: "Thieves' Tools",
  },
];

const WEAPONS = {
  Dagger: {
    dice: "1d4",
    type: "Piercing",
    finesse: true,
    props: "Finesse, Light, Thrown (20/60)",
    mastery: "Nick",
  },
  Flail: {
    dice: "1d8",
    type: "Bludgeoning",
    props: "—",
    mastery: "Sap",
  },
  Greataxe: {
    dice: "1d12",
    type: "Slashing",
    props: "Heavy, Two-Handed",
    mastery: "Cleave",
  },
  Greatsword: {
    dice: "2d6",
    type: "Slashing",
    props: "Heavy, Two-Handed",
    mastery: "Graze",
  },
  Handaxe: {
    dice: "1d6",
    type: "Slashing",
    props: "Light, Thrown (20/60)",
    mastery: "Vex",
  },
  Javelin: {
    dice: "1d6",
    type: "Piercing",
    props: "Thrown (30/120)",
    mastery: "Slow",
  },
  Longbow: {
    dice: "1d8",
    type: "Piercing",
    ranged: true,
    props: "Ammunition (150/600), Heavy, Two-Handed",
    mastery: "Slow",
  },
  Longsword: {
    dice: "1d8",
    type: "Slashing",
    props: "Versatile (1d10)",
    mastery: "Sap",
  },
  Mace: {
    dice: "1d6",
    type: "Bludgeoning",
    props: "—",
    mastery: "Sap",
  },
  Scimitar: {
    dice: "1d6",
    type: "Slashing",
    finesse: true,
    props: "Finesse, Light",
    mastery: "Nick",
  },
  Shortbow: {
    dice: "1d6",
    type: "Piercing",
    ranged: true,
    props: "Ammunition (80/320), Two-Handed",
    mastery: "Vex",
  },
  Shortsword: {
    dice: "1d6",
    type: "Piercing",
    finesse: true,
    props: "Finesse, Light",
    mastery: "Vex",
  },
  Sickle: {
    dice: "1d4",
    type: "Slashing",
    props: "Light",
    mastery: "Nick",
  },
  Spear: {
    dice: "1d6",
    type: "Piercing",
    props: "Thrown (20/60), Versatile (1d8)",
    mastery: "Sap",
  },
};

const ARMOR = {
  "Leather Armor": { base: 11, dexCap: null },
  "Studded Leather Armor": { base: 12, dexCap: null },
  "Chain Shirt": { base: 13, dexCap: 2 },
  "Chain Mail": {
    base: 16,
    dexCap: 0,
    note: "Str 13, Disadvantage on Stealth",
  },
};

const CANTRIPS = {
  "Acid Splash": { dice: "1d6", type: "Acid", mode: "Dex save" },
  "Chill Touch": { dice: "1d10", type: "Necrotic", mode: "Melee spell attack" },
  "Dancing Lights": {},
  Druidcraft: {},
  "Eldritch Blast": {
    dice: "1d10",
    type: "Force",
    mode: "Ranged spell attack",
  },
  "Fire Bolt": { dice: "1d10", type: "Fire", mode: "Ranged spell attack" },
  Guidance: {},
  Light: {},
  "Mage Hand": {},
  Mending: {},
  Message: {},
  "Minor Illusion": {},
  "Poison Spray": { dice: "1d12", type: "Poison", mode: "Con save" },
  Prestidigitation: {},
  "Produce Flame": { dice: "1d8", type: "Fire", mode: "Ranged spell attack" },
  "Ray of Frost": { dice: "1d8", type: "Cold", mode: "Ranged spell attack" },
  Resistance: {},
  "Sacred Flame": { dice: "1d8", type: "Radiant", mode: "Dex save" },
  Shillelagh: {},
  "Shocking Grasp": {
    dice: "1d8",
    type: "Lightning",
    mode: "Melee spell attack",
  },
  "Spare the Dying": {},
  Thaumaturgy: {},
  "True Strike": { dice: "weapon", type: "—", mode: "Weapon attack" },
  "Vicious Mockery": { dice: "1d6", type: "Psychic", mode: "Wis save" },
};

const SPELL_LISTS = {
  bard: {
    cantrips: [
      "Dancing Lights",
      "Light",
      "Mage Hand",
      "Mending",
      "Message",
      "Minor Illusion",
      "Prestidigitation",
      "True Strike",
      "Vicious Mockery",
    ],
    first: [
      "Charm Person",
      "Cure Wounds",
      "Detect Magic",
      "Disguise Self",
      "Dissonant Whispers",
      "Faerie Fire",
      "Healing Word",
      "Heroism",
      "Identify",
      "Longstrider",
      "Silent Image",
      "Sleep",
      "Speak with Animals",
      "Thunderwave",
      "Unseen Servant",
    ],
  },
  cleric: {
    cantrips: [
      "Guidance",
      "Light",
      "Mending",
      "Resistance",
      "Sacred Flame",
      "Spare the Dying",
      "Thaumaturgy",
    ],
    first: [
      "Bane",
      "Bless",
      "Command",
      "Create or Destroy Water",
      "Cure Wounds",
      "Detect Evil and Good",
      "Detect Magic",
      "Guiding Bolt",
      "Healing Word",
      "Inflict Wounds",
      "Protection from Evil and Good",
      "Purify Food and Drink",
      "Sanctuary",
      "Shield of Faith",
    ],
  },
  druid: {
    cantrips: [
      "Druidcraft",
      "Guidance",
      "Mending",
      "Message",
      "Poison Spray",
      "Produce Flame",
      "Resistance",
      "Shillelagh",
    ],
    first: [
      "Animal Friendship",
      "Charm Person",
      "Create or Destroy Water",
      "Cure Wounds",
      "Detect Magic",
      "Entangle",
      "Faerie Fire",
      "Fog Cloud",
      "Goodberry",
      "Healing Word",
      "Jump",
      "Longstrider",
      "Speak with Animals",
      "Thunderwave",
    ],
  },
  paladin: {
    cantrips: [],
    first: [
      "Bless",
      "Command",
      "Cure Wounds",
      "Detect Evil and Good",
      "Detect Magic",
      "Divine Favor",
      "Heroism",
      "Protection from Evil and Good",
      "Purify Food and Drink",
      "Searing Smite",
      "Shield of Faith",
    ],
  },
  ranger: {
    cantrips: [],
    first: [
      "Alarm",
      "Animal Friendship",
      "Cure Wounds",
      "Detect Magic",
      "Ensnaring Strike",
      "Entangle",
      "Fog Cloud",
      "Goodberry",
      "Jump",
      "Longstrider",
      "Speak with Animals",
    ],
  },
  sorcerer: {
    cantrips: [
      "Acid Splash",
      "Dancing Lights",
      "Fire Bolt",
      "Light",
      "Mage Hand",
      "Mending",
      "Message",
      "Minor Illusion",
      "Poison Spray",
      "Prestidigitation",
      "Ray of Frost",
      "Shocking Grasp",
      "True Strike",
    ],
    first: [
      "Burning Hands",
      "Charm Person",
      "Chromatic Orb",
      "Color Spray",
      "Comprehend Languages",
      "Detect Magic",
      "Disguise Self",
      "Expeditious Retreat",
      "False Life",
      "Feather Fall",
      "Fog Cloud",
      "Jump",
      "Mage Armor",
      "Magic Missile",
      "Shield",
      "Silent Image",
      "Sleep",
      "Thunderwave",
    ],
  },
  warlock: {
    cantrips: [
      "Chill Touch",
      "Eldritch Blast",
      "Mage Hand",
      "Minor Illusion",
      "Poison Spray",
      "Prestidigitation",
      "True Strike",
    ],
    first: [
      "Charm Person",
      "Comprehend Languages",
      "Expeditious Retreat",
      "Hellish Rebuke",
      "Hex",
      "Protection from Evil and Good",
      "Unseen Servant",
    ],
  },
  wizard: {
    cantrips: [
      "Acid Splash",
      "Chill Touch",
      "Dancing Lights",
      "Fire Bolt",
      "Light",
      "Mage Hand",
      "Mending",
      "Message",
      "Minor Illusion",
      "Poison Spray",
      "Prestidigitation",
      "Ray of Frost",
      "Shocking Grasp",
      "True Strike",
    ],
    first: [
      "Alarm",
      "Burning Hands",
      "Charm Person",
      "Chromatic Orb",
      "Color Spray",
      "Comprehend Languages",
      "Detect Magic",
      "Disguise Self",
      "Expeditious Retreat",
      "False Life",
      "Feather Fall",
      "Find Familiar",
      "Fog Cloud",
      "Grease",
      "Identify",
      "Jump",
      "Longstrider",
      "Mage Armor",
      "Magic Missile",
      "Shield",
      "Silent Image",
      "Sleep",
      "Thunderwave",
      "Unseen Servant",
    ],
  },
};

// Made-up names: the SRD has no name tables, so the panel synthesises
// them from two syllable banks per species.
const NAME_BANKS = {
  dragonborn: {
    given: [
      ["Arj", "Bal", "Kri", "Med", "Nad", "Rho", "Sath", "Ther", "Vex", "Zar"],
      ["han", "asar", "ash", "rash", "arr", "gar", "kor", "vash", "rin", "dax"],
    ],
    family: [
      ["Vask", "Thrym", "Oren", "Drav", "Sathr", "Kelv", "Myast", "Norix"],
      ["arion", "var", "keth", "alash", "ixan", "orash", "enar", "ius"],
    ],
  },
  dwarf: {
    given: [
      ["Dur", "Bar", "Thra", "Kaz", "Mor", "Grun", "Hel", "Or"],
      ["in", "ak", "din", "rim", "gar", "dur", "nar", "bek"],
    ],
    family: [
      ["Iron", "Deep", "Stone", "Gold", "Ember", "Anvil", "Coal", "Storm"],
      ["fist", "forge", "delve", "beard", "vein", "shield", "helm", "hollow"],
    ],
  },
  elf: {
    given: [
      ["Ael", "Cel", "Fael", "Lith", "Mira", "Rhys", "Sylv", "Thal"],
      ["arion", "ien", "wyn", "ath", "riel", "dor", "essa", "han"],
    ],
    family: [
      ["Moon", "Star", "Sun", "Dusk", "Thorn", "Silver", "Willow", "Rain"],
      ["whisper", "glade", "shade", "weaver", "song", "fall", "bough", "tide"],
    ],
  },
  gnome: {
    given: [
      ["Bim", "Fizz", "Nyx", "Pim", "Wren", "Zook", "Tam", "Orv"],
      ["ble", "ick", "us", "enna", "ory", "it", "adin", "el"],
    ],
    family: [
      ["Cog", "Tick", "Bramble", "Glim", "Fidget", "Nettle", "Sprock", "Wob"],
      ["wrench", "spindle", "button", "whistle", "gear", "socket", "latch"],
    ],
  },
  goliath: {
    given: [
      ["Ka", "Vor", "Ilm", "Tho", "Ug", "Nal", "Bren", "Ska"],
      ["thra", "gan", "vek", "run", "dara", "mok", "tel", "issa"],
    ],
    family: [
      ["Cloud", "Stone", "Frost", "Storm", "Hill", "Ember", "Peak", "Iron"],
      ["speaker", "breaker", "shoulder", "strider", "song", "reach", "gale"],
    ],
  },
  halfling: {
    given: [
      ["Pip", "Merri", "Rosa", "Tolly", "Wend", "Cor", "Bea", "Fen"],
      ["kin", "bold", "mund", "lie", "wick", "der", "nix", "row"],
    ],
    family: [
      ["Under", "Apple", "Copper", "Barrow", "Green", "Marl", "Thistle"],
      ["bough", "whistle", "kettle", "hollow", "field", "brook", "waite"],
    ],
  },
  human: {
    given: [
      ["Ash", "Bram", "Cald", "Dun", "Far", "Hal", "Mer", "Wen"],
      ["ric", "wen", "ora", "as", "iel", "mund", "ith", "an"],
    ],
    family: [
      ["Ash", "Bram", "Cald", "Dun", "Far", "Hal", "Mer", "Wen"],
      ["ford", "wick", "ridge", "mere", "stead", "combe", "gate", "holt"],
    ],
  },
  orc: {
    given: [
      ["Gru", "Thok", "Ur", "Mak", "Bra", "Sha", "Zog", "Dre"],
      ["mash", "na", "gar", "tuk", "zash", "ka", "rul", "vek"],
    ],
    family: [
      ["Skull", "Bone", "Iron", "Blood", "Ash", "Wolf", "War", "Storm"],
      ["splitter", "binder", "tusk", "fang", "drum", "brand", "howl", "jaw"],
    ],
  },
  tiefling: {
    given: [
      ["Ak", "Bal", "Ceph", "Dam", "Isk", "Mor", "Rav", "Zeph"],
      ["men", "ara", "iel", "zar", "ith", "ora", "us", "yn"],
    ],
    family: [
      [
        "Sorrow",
        "Ember",
        "Vigil",
        "Providence",
        "Reverence",
        "Grief",
        "Fortune",
        "Silence",
      ],
      null,
    ],
  },
};

const EPITHETS = [
  "the Unasked",
  "the Twice-Buried",
  "the Merely Adequate",
  "the Uninvited",
  "of No Fixed Abode",
  "the Emphatic",
  "the Patient",
  "the Unpaid",
  "the Hollow",
  "the Second",
];

/* ---------------------------------------------------------
   Seeded randomness
   --------------------------------------------------------- */

// Campaign settings. For now this only re-skins the panel: nothing here
// reaches buildCharacter, so every setting still rolls a generic SRD
// character. When it does start filtering species and adjusting bonuses,
// this is where that data hangs.
//
// The code letter is what goes in the serial. Generic is deliberately
// letterless -- see serialOf.
const SETTINGS = [
  { id: "generic", code: "G", label: "generic" },
  { id: "forgotten-realms", code: "F", label: "forgotten realms" },
  { id: "greyhawk", code: "H", label: "greyhawk" },
  { id: "dark-sun", code: "D", label: "dark sun" },
  { id: "dragonlance", code: "L", label: "dragonlance" },
];

function settingFor(id) {
  return SETTINGS.find((entry) => entry.id === id) || SETTINGS[0];
}

// Cartridges clamp what the machine is allowed to roll. Shaped like
// SETTINGS -- a table, not logic -- and like SETTINGS the first entry is
// the absence of one and writes nothing to the serial. A cartridge does
// change what a seed produces, so it has to be in the serial: without it
// an old link would rebuild a different character.
const CARTRIDGES = [
  {
    id: "none",
    label: "no cartridge",
    note: "the machine rolls the whole book.",
  },
  {
    id: "casters",
    label: "casters only",
    note: "every roll comes back holding a spell list.",
    classes: (list) => list.filter((cls) => cls.casting),
  },
  {
    id: "martial",
    label: "no magic",
    note: "nobody who casts. swords, fists and nerve.",
    classes: (list) => list.filter((cls) => !cls.casting),
  },
  {
    id: "no-humans",
    label: "no humans",
    note: "the human entry is skipped on the species channel.",
    species: (list) => list.filter((entry) => entry.id !== "human"),
  },
  {
    id: "small-folk",
    label: "small folk",
    note: "gnomes and halflings, and whatever they get up to.",
    species: (list) =>
      list.filter((entry) => entry.id === "gnome" || entry.id === "halfling"),
  },
  {
    id: "frontline",
    label: "frontline",
    note: "d10 and d12 hit dice only -- built to be hit.",
    classes: (list) => list.filter((cls) => cls.hitDie >= 10),
  },
];

function cartridgeFor(id) {
  return CARTRIDGES.find((entry) => entry.id === id) || CARTRIDGES[0];
}

// A cartridge that filtered a list down to nothing would be a cartridge
// that breaks the machine, so an empty result falls back to the full list
// rather than throwing somewhere further down.
function clampList(list, filter) {
  if (!filter) return list;
  const kept = filter(list);
  return kept.length ? kept : list;
}

function speciesListFor(cartridgeId) {
  return clampList(SPECIES, cartridgeFor(cartridgeId).species);
}

function classListFor(cartridgeId) {
  return clampList(CLASSES, cartridgeFor(cartridgeId).classes);
}

// How many characters one serial can describe.
const PARTY_MAX = 6;

const CHANNELS = ["name", "species", "class", "background", "stats"];
const SEED_LENGTH = 4;

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// mulberry32: small, fast, and good enough for dice.
function makeRng(text) {
  let state = hashString(text);
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Every seed in the machine is minted here, whatever the entropy behind
// it: Math.random for a roll, a hash of your text for a patched channel,
// a derived stream for a party member. Downstream they are the same
// four characters and nothing can tell them apart.
function mintSeed(rng) {
  let seed = "";
  for (let i = 0; i < SEED_LENGTH; i += 1) {
    seed += Math.floor(rng() * 36).toString(36);
  }
  return seed.toUpperCase();
}

function randomSeed() {
  return mintSeed(Math.random);
}

// The INPUT port. A dial walks a channel through seeds: offset 0 is
// wherever the channel already was, and every step either side derives
// from that anchor, so turning back really does bring back what you just
// passed. Nothing here is stored -- the seed it lands on is in the
// serial like any other, which is the only record the machine keeps.
function seedFromDial(anchor, offset) {
  if (offset === 0) return anchor;
  return mintSeed(makeRng("dial/" + anchor + "/" + offset));
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function pickMany(rng, list, count) {
  const pool = list.slice();
  const taken = [];
  while (taken.length < count && pool.length > 0) {
    taken.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return taken;
}

function rollDie(rng, sides) {
  return 1 + Math.floor(rng() * sides);
}

/* ---------------------------------------------------------
   Character assembly
   --------------------------------------------------------- */

const ABILITY_PRIORITY = {
  barbarian: ["str", "con", "dex", "wis", "cha", "int"],
  bard: ["cha", "dex", "con", "wis", "int", "str"],
  cleric: ["wis", "con", "str", "cha", "dex", "int"],
  druid: ["wis", "con", "dex", "int", "cha", "str"],
  fighter: ["str", "con", "dex", "wis", "cha", "int"],
  monk: ["dex", "wis", "con", "str", "int", "cha"],
  paladin: ["str", "cha", "con", "wis", "dex", "int"],
  ranger: ["dex", "wis", "con", "str", "int", "cha"],
  rogue: ["dex", "con", "int", "wis", "cha", "str"],
  sorcerer: ["cha", "con", "dex", "wis", "int", "str"],
  warlock: ["cha", "con", "dex", "wis", "int", "str"],
  wizard: ["int", "con", "dex", "wis", "cha", "str"],
};

const PROFICIENCY_BONUS = 2;
const LEVEL = 1;
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

function modifier(score) {
  return Math.floor((score - 10) / 2);
}

function signed(value) {
  return (value >= 0 ? "+" : "−") + Math.abs(value);
}

// How ornamented a name is allowed to be. Weathered is the machine's old
// hard-coded 0.28, and stays the default so every serial minted before
// the knob existed still spells the same name.
const FLOURISHES = [
  { id: "plain", chance: 0, label: "plain" },
  { id: "weathered", chance: 0.28, label: "weathered" },
  { id: "baroque", chance: 0.6, label: "baroque" },
];
const FLOURISH_DEFAULT = 1;

function flourishFor(id) {
  return (
    FLOURISHES.find((entry) => entry.id === id) || FLOURISHES[FLOURISH_DEFAULT]
  );
}

function buildName(rng, speciesId, flourishId) {
  const bank = NAME_BANKS[speciesId];
  const given = pick(rng, bank.given[0]) + pick(rng, bank.given[1]);
  const family = bank.family[1]
    ? pick(rng, bank.family[0]) + pick(rng, bank.family[1])
    : pick(rng, bank.family[0]);
  const name = given + " " + family;
  const chance = flourishFor(flourishId).chance;
  return rng() < chance ? name + ", " + pick(rng, EPITHETS) : name;
}

// Four detents on one knob, from prudent to reckless. Each method draws a
// different number of dice from the stream, which is fine: the method is
// in the serial, so a (seed, method) pair is still deterministic.
const METHOD_LETTERS = { array: "A", gritty: "G", dice: "R", heroic: "H" };

function rollAbilityScores(rng, method) {
  if (method === "array") return STANDARD_ARRAY.slice();

  // heroic is 4d6 drop lowest with each 1 rerolled once -- the reroll
  // happens per die, in draw order, so the stream stays stable.
  const die = () => {
    let value = rollDie(rng, 6);
    if (method === "heroic" && value === 1) value = rollDie(rng, 6);
    return value;
  };

  const scores = [];
  for (let i = 0; i < 6; i += 1) {
    if (method === "gritty") {
      scores.push(die() + die() + die());
    } else {
      const dice = [die(), die(), die(), die()].sort((a, b) => b - a);
      scores.push(dice[0] + dice[1] + dice[2]);
    }
  }
  return scores.sort((a, b) => b - a);
}

function assignScores(pool, priority) {
  const scores = {};
  priority.forEach((ability, index) => {
    scores[ability] = pool[index];
  });
  return scores;
}

// A background raises one of its three abilities by 2 and another by 1.
// The panel spends them where the class wants them.
function applyBackgroundBoosts(scores, background, priority) {
  const ordered = background.abilities
    .slice()
    .sort((a, b) => priority.indexOf(a) - priority.indexOf(b));
  const boosts = { [ordered[0]]: 2, [ordered[1]]: 1 };
  Object.keys(boosts).forEach((ability) => {
    scores[ability] = Math.min(20, scores[ability] + boosts[ability]);
  });
  return { scores, boosts };
}

function attackEntry(name, dice, damageType, abilityMod, notes) {
  return {
    name: name,
    bonus: signed(abilityMod + PROFICIENCY_BONUS),
    damage: dice + " " + signed(abilityMod) + " " + damageType,
    notes: notes,
  };
}

function buildAttacks(cls, mods, spellcasting) {
  const attacks = [];
  const seen = {};

  cls.kit.weapons.forEach((weaponName) => {
    if (seen[weaponName]) return;
    seen[weaponName] = true;

    const weapon = WEAPONS[weaponName];
    let abilityMod = mods.str;
    if (weapon.ranged) abilityMod = mods.dex;
    else if (weapon.finesse) abilityMod = Math.max(mods.str, mods.dex);

    attacks.push(
      attackEntry(
        weaponName,
        weapon.dice,
        weapon.type,
        abilityMod,
        weapon.props + " · mastery: " + weapon.mastery,
      ),
    );
  });

  if (cls.martialArts) {
    attacks.push(
      attackEntry(
        "Unarmed Strike",
        "1d6",
        "Bludgeoning",
        Math.max(mods.str, mods.dex),
        "Martial Arts die",
      ),
    );
  }

  if (spellcasting) {
    spellcasting.cantrips.forEach((cantripName) => {
      const cantrip = CANTRIPS[cantripName];
      if (!cantrip.dice) return;
      const isAttack = /attack/.test(cantrip.mode);
      attacks.push({
        name: cantripName,
        bonus: isAttack ? spellcasting.attack : "DC " + spellcasting.dc,
        damage:
          cantrip.dice === "weapon"
            ? "weapon damage"
            : cantrip.dice + " " + cantrip.type,
        notes: cantrip.mode + " · cantrip",
      });
    });
  }

  return attacks;
}

function buildEquipment(cls, background) {
  const items = [];
  if (cls.kit.armor) items.push(cls.kit.armor);
  if (cls.kit.shield) items.push("Shield");

  const counts = {};
  cls.kit.weapons.forEach((weapon) => {
    counts[weapon] = (counts[weapon] || 0) + 1;
  });
  Object.keys(counts).forEach((weapon) => {
    items.push(
      counts[weapon] > 1 ? counts[weapon] + " " + weapon + "s" : weapon,
    );
  });

  cls.kit.gear.forEach((item) => items.push(item));
  items.push(background.name + " background: 50 GP in place of the kit");
  return items;
}

// The species a seed produces, without rolling the rest of the character.
// buildCharacter draws the same value as the first pick off its own
// species stream -- these two have to agree, so they read the same.
function speciesFor(seed, cartridgeId) {
  return pick(makeRng("species/" + seed), speciesListFor(cartridgeId));
}

function buildCharacter(state) {
  const speciesRng = makeRng("species/" + state.seeds.species);
  const speciesList = speciesListFor(state.cartridge);
  const classList = classListFor(state.cartridge);
  const classRng = makeRng("class/" + state.seeds.class);
  const backgroundRng = makeRng("background/" + state.seeds.background);
  const statsRng = makeRng("stats/" + state.seeds.stats + "/" + state.method);

  const species = pick(speciesRng, speciesList);
  const lineage = species.lineage
    ? pick(speciesRng, species.lineage.options)
    : null;
  const size = pick(speciesRng, species.size);
  const speed = (lineage && lineage.speed) || species.speed;

  const cls = pick(classRng, classList);
  const background = pick(backgroundRng, BACKGROUNDS);
  const priority = ABILITY_PRIORITY[cls.id];

  // A held name keeps the species it was named for, so re-rolling species
  // cannot quietly rename a character the panel says is held. The pin
  // rides in the serial (see serialOf), so the link still rebuilds this.
  const namedFor = state.nameSpecies || species.id;
  const nameRng = makeRng("name/" + state.seeds.name + "/" + namedFor);
  const name = buildName(nameRng, namedFor, state.flourish);

  const pool = rollAbilityScores(statsRng, state.method);
  const boosted = applyBackgroundBoosts(
    assignScores(pool, priority),
    background,
    priority,
  );
  const scores = boosted.scores;

  const mods = {};
  ABILITIES.forEach((ability) => {
    mods[ability] = modifier(scores[ability]);
  });

  // Skills: the background's two are fixed; the class picks the rest from
  // its own list, skipping anything already covered.
  const skills = background.skills.slice();
  const classPool = (
    cls.skillList === "any" ? SKILLS.map((skill) => skill.name) : cls.skillList
  ).filter((skillName) => skills.indexOf(skillName) === -1);
  pickMany(classRng, classPool, cls.skillCount).forEach((skillName) => {
    skills.push(skillName);
  });

  const feats = [background.feat];
  const traits = species.traits.slice();

  if (species.keenSenses) {
    const sense = pick(speciesRng, species.keenSenses);
    traits.push("Keen Senses — proficiency in " + sense);
    if (skills.indexOf(sense) === -1) skills.push(sense);
  }

  if (species.id === "human") {
    const extra = SKILLS.map((skill) => skill.name).filter(
      (skillName) => skills.indexOf(skillName) === -1,
    );
    skills.push(pick(speciesRng, extra));
    feats.push(
      pick(
        speciesRng,
        ORIGIN_FEATS.filter((feat) => feat !== background.feat),
      ),
    );
  }

  if (lineage) {
    traits.push(
      species.lineage.label + ": " + lineage.name + " — " + lineage.note,
    );
  }

  if (cls.fightingStyles) {
    feats.push("Fighting Style: " + pick(classRng, cls.fightingStyles));
  }

  const expertise = cls.expertise
    ? pickMany(classRng, skills.slice(), cls.expertise)
    : [];

  const languages = ["Common"].concat(
    pickMany(backgroundRng, STANDARD_LANGUAGES, 2),
  );

  let maxHp = cls.hitDie + mods.con;
  if (species.id === "dwarf") maxHp += LEVEL;
  if (feats.indexOf("Tough") !== -1) maxHp += LEVEL * 2;

  let armorClass;
  if (cls.kit.armor) {
    const armor = ARMOR[cls.kit.armor];
    const dexPart =
      armor.dexCap === null ? mods.dex : Math.min(mods.dex, armor.dexCap);
    armorClass = armor.base + dexPart;
  } else if (cls.unarmoredDefense) {
    armorClass = 10 + mods.dex + mods[cls.unarmoredDefense];
  } else {
    armorClass = 10 + mods.dex;
  }
  if (cls.kit.shield) armorClass += 2;

  const hasAlert = feats.some((feat) => feat === "Alert");
  const initiative = mods.dex + (hasAlert ? PROFICIENCY_BONUS : 0);

  let spellcasting = null;
  if (cls.casting) {
    const list = SPELL_LISTS[cls.id];
    const spellRng = makeRng("spells/" + state.seeds.class + "/" + cls.id);
    const ability = cls.casting.ability;
    spellcasting = {
      label: cls.casting.label || "Spellcasting",
      ability: ability,
      mod: signed(mods[ability]),
      dc: 8 + PROFICIENCY_BONUS + mods[ability],
      attack: signed(PROFICIENCY_BONUS + mods[ability]),
      slots: cls.casting.slots,
      cantrips: pickMany(spellRng, list.cantrips, cls.casting.cantrips),
      prepared: pickMany(spellRng, list.first, cls.casting.prepared),
      book: cls.casting.book || null,
    };
    if (cls.id === "ranger") spellcasting.prepared.unshift("Hunter's Mark");
  }

  return {
    name: name,
    alignment: pick(backgroundRng, ALIGNMENTS),
    species: species,
    lineage: lineage,
    size: size,
    speed: speed,
    cls: cls,
    background: background,
    scores: scores,
    mods: mods,
    boosts: boosted.boosts,
    skills: skills,
    expertise: expertise,
    feats: feats,
    traits: traits,
    languages: languages,
    maxHp: maxHp,
    armorClass: armorClass,
    initiative: initiative,
    spellcasting: spellcasting,
    attacks: buildAttacks(cls, mods, spellcasting),
    equipment: buildEquipment(cls, background),
    gold: cls.kit.gp + 50,
    heroicInspiration: species.id === "human",
  };
}

/* ---------------------------------------------------------
   Rendering
   --------------------------------------------------------- */

const ABILITY_NAMES = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = byId(id);
  if (node) node.textContent = value;
}

function fillList(id, items) {
  const list = byId(id);
  if (!list) return;
  list.textContent = "";
  items.forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    list.appendChild(entry);
  });
}

// The lamp bank is a readout of the deck, not a second set of controls:
// every lamp mirrors a switch that lives below it. Nothing here is
// focusable, and the whole display is aria-hidden -- the spoken version of
// this is the status line, which already announces each change.
function setLamp(name, lit) {
  const lamp = document.querySelector('[data-lamp="' + name + '"]');
  if (lamp) lamp.classList.toggle("is-lit", lit);
}

function syncLamps() {
  CHANNELS.forEach((channel) => {
    setLamp("hold-" + channel, state.holds[channel]);
  });

  setLamp("input", Object.keys(state.patched).length > 0);
  setLamp("sync", state.party > 1);
  setLamp("aux", state.cartridge !== CARTRIDGES[0].id);
  setLamp("midi", midiState.connected);

  Object.keys(METHOD_LETTERS).forEach((method) => {
    setLamp("method-" + method, state.method === method);
  });

  Object.keys(TEMPOS).forEach((tempo) => {
    setLamp("tempo-" + tempo, transport.tempo === tempo);
  });

  const flourish = flourishFor(state.flourish);
  setLamp("flourish", flourish.id !== FLOURISHES[FLOURISH_DEFAULT].id);
  setText("lamp-flourish", flourish.label);

  // Generic is the absence of a setting rather than one of them, so its
  // lamp reads as off -- the same rule the serial follows.
  const setting = settingFor(state.setting);
  setLamp("setting", setting.id !== SETTINGS[0].id);
  setText("lamp-setting", setting.label);

  setText("lamp-cartridge", cartridgeFor(state.cartridge).label);
}

// The strip reports what is plugged in, not merely which drawer is open.
function syncPorts() {
  const live = {
    input: Object.keys(state.patched).length > 0,
    sync: state.party > 1,
    aux: state.cartridge !== CARTRIDGES[0].id,
    midi: midiState.connected,
  };

  document.querySelectorAll("[data-port]").forEach((port) => {
    port.classList.toggle("is-live", !!live[port.getAttribute("data-port")]);
  });

  syncDials();
}

function setBars(values) {
  ABILITIES.forEach((ability) => {
    const bar = document.querySelector('[data-bar="' + ability + '"]');
    if (!bar) return;
    const level = Math.max(0, Math.min(1, (values[ability] - 6) / 14));
    bar.style.setProperty("--level", level.toFixed(3));
  });
}

function renderSkills(character) {
  const passives = {};

  SKILLS.forEach((skill) => {
    const row = document.querySelector('[data-skill="' + skill.id + '"]');
    if (!row) return;

    const proficient = character.skills.indexOf(skill.name) !== -1;
    const expert = character.expertise.indexOf(skill.name) !== -1;
    const bonus = skillBonus(character, skill);

    row.classList.toggle("is-proficient", proficient);
    row.classList.toggle("is-expert", expert);
    row.querySelector("[data-mod]").textContent = signed(bonus);
    row.querySelector("[data-note]").textContent = expert
      ? "expertise"
      : proficient
        ? "proficient"
        : "not proficient";

    passives[skill.id] = 10 + bonus;
  });

  return passives;
}

function renderSaves(character) {
  ABILITIES.forEach((ability) => {
    const row = document.querySelector('[data-save="' + ability + '"]');
    if (!row) return;

    const proficient = character.cls.saves.indexOf(ability) !== -1;
    const bonus =
      character.mods[ability] + (proficient ? PROFICIENCY_BONUS : 0);

    row.classList.toggle("is-proficient", proficient);
    row.querySelector("[data-mod]").textContent = signed(bonus);
    row.querySelector("[data-note]").textContent = proficient
      ? "proficient"
      : "not proficient";
  });
}

function renderAttacks(character) {
  const body = byId("attacks");
  body.textContent = "";

  character.attacks.forEach((attack) => {
    const row = document.createElement("tr");
    [attack.name, attack.bonus, attack.damage, attack.notes].forEach(
      (value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.setAttribute("scope", "row");
        cell.textContent = value;
        row.appendChild(cell);
      },
    );
    body.appendChild(row);
  });
}

function renderSpells(character) {
  const section = byId("spellcasting");
  const casting = character.spellcasting;

  if (!casting) {
    // Clear the lists too: a hidden section keeping the last caster's
    // spells is the kind of thing that leaks into a print or a copy.
    section.hidden = true;
    fillList("cantrips", []);
    fillList("prepared", []);
    return;
  }

  section.hidden = false;
  setText("spell-label", casting.label);
  setText("spell-ability", ABILITY_NAMES[casting.ability]);
  setText("spell-mod", casting.mod);
  setText("spell-dc", String(casting.dc));
  setText("spell-attack", casting.attack);
  setText("spell-slots", casting.slots + " × level 1");
  setText(
    "spell-book",
    casting.book ? casting.book + " spells in the spellbook" : "—",
  );

  fillList("cantrips", casting.cantrips.length ? casting.cantrips : ["—"]);
  fillList("prepared", casting.prepared);
}

// Just the LCD: name line, build line, bars. Split out of render so the
// audition key can flash a phantom character on the display without the
// sheet, the serial, or the address bar hearing about it.
function renderDisplay(character) {
  setText("lcd-name", character.name);
  setText(
    "lcd-build",
    character.species.name + " " + character.cls.name + " · level 1",
  );
  setBars(character.scores);
}

function render(character) {
  setText("sheet-name", character.name);
  setText("sheet-class", character.cls.name);
  setText("sheet-subclass", character.cls.subclass);
  setText(
    "sheet-species",
    character.lineage
      ? character.species.name + " (" + character.lineage.name + ")"
      : character.species.name,
  );
  setText("sheet-background", character.background.name);
  setText("sheet-alignment", character.alignment);

  ABILITIES.forEach((ability) => {
    setText("score-" + ability, String(character.scores[ability]));
    setText("mod-" + ability, signed(character.mods[ability]));
    const boost = character.boosts[ability];
    setText("boost-" + ability, boost ? "background " + signed(boost) : "");
  });

  const passives = renderSkills(character);
  renderSaves(character);

  setText("armor-class", String(character.armorClass));
  setText("initiative", signed(character.initiative));
  setText("speed", character.speed + " ft.");
  setText("size", character.size);
  setText("prof-bonus", signed(PROFICIENCY_BONUS));
  setText("hit-points", String(character.maxHp));
  setText("hit-dice", "1d" + character.cls.hitDie);
  setText("passive-perception", String(passives.perception));
  setText("passive-insight", String(passives.insight));
  setText("passive-investigation", String(passives.investigation));
  setText(
    "heroic-inspiration",
    character.heroicInspiration ? "yes — Resourceful" : "no",
  );

  setText("armor-note", character.cls.kit.armor || "unarmored");
  setText("prof-armor", character.cls.armorTraining);
  setText("prof-weapons", character.cls.weaponTraining);
  setText("prof-tools", character.cls.toolTraining);
  setText("prof-background-tool", character.background.tool);
  setText("languages", character.languages.join(", "));
  setText("gold", character.gold + " GP");

  renderAttacks(character);

  fillList(
    "class-features",
    character.cls.features.concat("Subclass: " + character.cls.subclass),
  );
  fillList("species-traits", character.traits);
  fillList("feats", character.feats);
  fillList("equipment", character.equipment);

  renderSpells(character);

  renderDisplay(character);

  setText(
    "announce",
    character.name +
      ", a level 1 " +
      character.species.name +
      " " +
      character.cls.name +
      ", " +
      character.background.name +
      " background. Sheet updated.",
  );
}

function asPlainText(character) {
  const lines = [];
  const rule = "----------------------------------------";

  lines.push(character.name);
  lines.push(
    "Level 1 " +
      character.species.name +
      (character.lineage ? " (" + character.lineage.name + ")" : "") +
      " " +
      character.cls.name +
      " — " +
      character.cls.subclass,
  );
  lines.push(
    "Background: " +
      character.background.name +
      " · Alignment: " +
      character.alignment,
  );
  lines.push(rule);
  lines.push(
    ABILITIES.map(
      (ability) =>
        ability.toUpperCase() +
        " " +
        character.scores[ability] +
        " (" +
        signed(character.mods[ability]) +
        ")",
    ).join("  "),
  );
  lines.push(
    "AC " +
      character.armorClass +
      " · HP " +
      character.maxHp +
      " · Speed " +
      character.speed +
      " ft. · Initiative " +
      signed(character.initiative) +
      " · PB " +
      signed(PROFICIENCY_BONUS),
  );
  lines.push(rule);
  lines.push("Skills: " + character.skills.join(", "));
  if (character.expertise.length) {
    lines.push("Expertise: " + character.expertise.join(", "));
  }
  lines.push("Saving throws: " + character.cls.saves.join(", ").toUpperCase());
  lines.push("Feats: " + character.feats.join(", "));
  lines.push("Traits: " + character.traits.join("; "));
  lines.push("Languages: " + character.languages.join(", "));
  lines.push(rule);
  lines.push("Attacks:");
  character.attacks.forEach((attack) => {
    lines.push(
      "  " +
        attack.name +
        " — " +
        attack.bonus +
        " — " +
        attack.damage +
        " — " +
        attack.notes,
    );
  });
  lines.push("Equipment: " + character.equipment.join(", "));
  lines.push("Coin: " + character.gold + " GP");

  if (character.spellcasting) {
    const casting = character.spellcasting;
    lines.push(rule);
    lines.push(
      casting.label +
        " — " +
        ABILITY_NAMES[casting.ability] +
        ", save DC " +
        casting.dc +
        ", attack " +
        casting.attack +
        ", slots " +
        casting.slots,
    );
    if (casting.cantrips.length) {
      lines.push("Cantrips: " + casting.cantrips.join(", "));
    }
    lines.push("Prepared: " + casting.prepared.join(", "));
  }

  lines.push(rule);
  lines.push("Serial: " + serialOf(state));
  lines.push(
    "Rules content from SRD 5.2.1, (c) Wizards of the Coast LLC, CC BY 4.0.",
  );

  return lines.join("\n");
}

/* ---------------------------------------------------------
   PDF export

   A PDF is a text format with an index bolted to the end, so one can be
   written out by hand -- which is the only way to offer a download here
   and keep the no-dependency, no-build-step rule. Nothing is fetched and
   nothing is installed: the file is assembled as a string and handed to
   the browser as a blob.

   Two things make that tractable. The base-14 fonts (Helvetica, Courier)
   are in every reader, so no font has to be embedded. And the file stays
   pure ASCII -- anything above 127 is written as a WinAnsi octal escape
   -- so a string index is a byte offset, which is what the xref table
   needs.
   --------------------------------------------------------- */

const PDF_PAGE = {
  width: 612, // US Letter in points, the size the 2024 sheet prints at
  height: 792,
  margin: 46,
  gutter: 24,
  footer: 30,
};

const PDF_FONT = { body: "F1", bold: "F2", mono: "F3" };

// Anything the generator can emit that WinAnsi spells differently from
// ASCII. Everything else above 127 would be a bug worth seeing, so it
// becomes a question mark rather than being silently dropped.
const PDF_WIN_ANSI = {
  "—": "\\227",
  "–": "\\226",
  "‘": "\\221",
  "’": "\\222",
  "“": "\\223",
  "”": "\\224",
  "·": "\\267",
  "×": "\\327",
  é: "\\351",
};

// The writer has to know how wide a line will be before it commits to
// it. Canvas has the metrics already, and Arial -- what a browser hands
// back when asked for Helvetica -- is metrically identical to it, so the
// wrap is measured rather than guessed at.
const pdfMeasure = (function () {
  const context = document.createElement("canvas").getContext("2d");
  return function (text, size, bold, mono) {
    const family = mono
      ? "'Courier New', Courier, monospace"
      : "Helvetica, Arial, sans-serif";
    context.font = (bold ? "bold " : "") + size + "px " + family;
    return context.measureText(text).width;
  };
})();

function pdfString(text) {
  let out = "";
  String(text)
    .split("")
    .forEach((glyph) => {
      if (glyph === "\\" || glyph === "(" || glyph === ")") {
        out += "\\" + glyph;
      } else if (glyph.charCodeAt(0) < 128) {
        out += glyph;
      } else {
        out += PDF_WIN_ANSI[glyph] || "?";
      }
    });
  return out;
}

function pdfNum(value) {
  return Number(value).toFixed(2);
}

function pdfWrap(text, size, bold, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? line + " " + word : word;
    if (line && pdfMeasure(next, size, bold) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/* --- the page as a cursor --------------------------------------------- */

function pdfStart() {
  const top = PDF_PAGE.height - PDF_PAGE.margin;
  return {
    pages: [],
    ops: [],
    columnWidth: (PDF_PAGE.width - PDF_PAGE.margin * 2 - PDF_PAGE.gutter) / 2,
    columnTop: top,
    bottom: PDF_PAGE.margin + PDF_PAGE.footer,
    column: 0,
    y: top,
  };
}

function pdfColumnX(doc) {
  return PDF_PAGE.margin + doc.column * (doc.columnWidth + PDF_PAGE.gutter);
}

function pdfBreakPage(doc) {
  doc.pages.push(doc.ops);
  doc.ops = [];
  doc.column = 0;
  doc.columnTop = PDF_PAGE.height - PDF_PAGE.margin;
  doc.y = doc.columnTop;
}

// Ask for room before drawing anything. Fill the left column, then the
// right, then start a page: the order a reader takes them in.
function pdfNeed(doc, height) {
  if (doc.y - height >= doc.bottom) return;
  if (doc.column === 0) {
    doc.column = 1;
    doc.y = doc.columnTop;
    return;
  }
  pdfBreakPage(doc);
}

function pdfWrite(doc, text, x, y, options) {
  doc.ops.push(
    "q " +
      pdfNum(options.gray === undefined ? 0.1 : options.gray) +
      " g BT /" +
      (options.font || PDF_FONT.body) +
      " " +
      pdfNum(options.size) +
      " Tf " +
      pdfNum(options.spacing || 0) +
      " Tc 1 0 0 1 " +
      pdfNum(x) +
      " " +
      pdfNum(y) +
      " Tm (" +
      pdfString(text) +
      ") Tj ET Q",
  );
}

function pdfRule(doc, x, y, width, gray) {
  doc.ops.push(
    "q " +
      pdfNum(gray === undefined ? 0.62 : gray) +
      " G 0.6 w " +
      pdfNum(x) +
      " " +
      pdfNum(y) +
      " m " +
      pdfNum(x + width) +
      " " +
      pdfNum(y) +
      " l S Q",
  );
}

// Proficiency gets a filled square rather than a dot: a circle is four
// bezier segments, and this is a 3pt mark nobody will squint at.
function pdfMark(doc, x, y) {
  doc.ops.push("q 0.1 g " + pdfNum(x) + " " + pdfNum(y) + " 3 3 re f Q");
}

/* --- drawing the sheet ------------------------------------------------ */

function pdfHeading(doc, title) {
  pdfNeed(doc, 44);
  const x = pdfColumnX(doc);
  doc.y -= 13;
  pdfWrite(doc, title.toUpperCase(), x, doc.y, {
    size: 7.4,
    font: PDF_FONT.bold,
    spacing: 0.9,
    gray: 0.3,
  });
  doc.y -= 5;
  pdfRule(doc, x, doc.y, doc.columnWidth);
  doc.y -= 11;
}

function pdfRow(doc, row) {
  const size = row.bold ? 9 : 8.4;
  const indent = row.indent || 0;
  const value = row.value === undefined ? "" : String(row.value);
  const valueWidth = value ? pdfMeasure(value, size, row.bold) : 0;
  const width = doc.columnWidth - indent - (valueWidth ? valueWidth + 8 : 0);
  const lines = pdfWrap(row.label, size, row.bold, width);

  pdfNeed(doc, lines.length * (size + 2.6));

  const x = pdfColumnX(doc) + indent;
  lines.forEach((line, index) => {
    pdfWrite(doc, line, x, doc.y, {
      size: size,
      font: row.bold ? PDF_FONT.bold : PDF_FONT.body,
      gray: row.faint ? 0.42 : 0.1,
    });

    if (index === 0 && value) {
      pdfWrite(
        doc,
        value,
        pdfColumnX(doc) + doc.columnWidth - valueWidth,
        doc.y,
        { size: size, font: row.bold ? PDF_FONT.bold : PDF_FONT.body },
      );
    }
    if (index === 0 && row.mark) pdfMark(doc, x - 8, doc.y + 2);

    doc.y -= size + 2.6;
  });
}

function pdfHeader(doc, character, serial) {
  const width = PDF_PAGE.width - PDF_PAGE.margin * 2;
  const x = PDF_PAGE.margin;

  doc.y -= 20;
  pdfWrite(doc, character.name, x, doc.y, { size: 20, font: PDF_FONT.bold });

  doc.y -= 15;
  pdfWrite(
    doc,
    "Level 1 " +
      character.species.name +
      (character.lineage ? " (" + character.lineage.name + ")" : "") +
      " " +
      character.cls.name +
      " — " +
      character.cls.subclass,
    x,
    doc.y,
    { size: 10 },
  );

  doc.y -= 12;
  pdfWrite(
    doc,
    character.background.name +
      " background · " +
      character.alignment +
      " · " +
      character.size +
      " · " +
      character.speed +
      " ft.",
    x,
    doc.y,
    { size: 8.6, gray: 0.35 },
  );
  pdfWrite(doc, serial, x + width - pdfMeasure(serial, 8, false, true), doc.y, {
    size: 8,
    font: PDF_FONT.mono,
    gray: 0.35,
  });

  doc.y -= 10;
  pdfRule(doc, x, doc.y, width, 0.35);
  doc.y -= 6;

  // Everything after the header flows in two columns, and the right one
  // starts level with the left rather than at the top of the sheet.
  doc.columnTop = doc.y;
}

function skillBonus(character, skill) {
  const proficient = character.skills.indexOf(skill.name) !== -1;
  const expert = character.expertise.indexOf(skill.name) !== -1;
  return (
    character.mods[skill.ability] +
    (proficient ? PROFICIENCY_BONUS : 0) +
    (expert ? PROFICIENCY_BONUS : 0)
  );
}

// The same sheet the page shows, as data: one list of sections, each a
// list of rows. The layout above knows nothing about D&D, and this knows
// nothing about points and columns.
function sheetSections(character) {
  const sections = [];
  const passiveOf = function (id) {
    return (
      10 +
      skillBonus(
        character,
        SKILLS.find((skill) => skill.id === id),
      )
    );
  };

  const abilities = { title: "ability scores", rows: [] };
  ABILITIES.forEach((ability) => {
    abilities.rows.push({
      label: ABILITY_NAMES[ability],
      value: character.scores[ability] + "  " + signed(character.mods[ability]),
      bold: true,
    });

    const proficientSave = character.cls.saves.indexOf(ability) !== -1;
    abilities.rows.push({
      label: "saving throw",
      value: signed(
        character.mods[ability] + (proficientSave ? PROFICIENCY_BONUS : 0),
      ),
      indent: 12,
      mark: proficientSave,
      faint: !proficientSave,
    });

    SKILLS.filter((skill) => skill.ability === ability).forEach((skill) => {
      const trained =
        character.skills.indexOf(skill.name) !== -1 ||
        character.expertise.indexOf(skill.name) !== -1;
      abilities.rows.push({
        label: skill.name,
        value: signed(skillBonus(character, skill)),
        indent: 12,
        mark: trained,
        faint: !trained,
      });
    });
  });
  sections.push(abilities);

  sections.push({
    title: "combat",
    rows: [
      { label: "armor class", value: character.armorClass },
      {
        label: character.cls.kit.armor || "unarmored",
        indent: 12,
        faint: true,
      },
      { label: "hit points", value: character.maxHp },
      { label: "hit dice", value: "1d" + character.cls.hitDie },
      { label: "initiative", value: signed(character.initiative) },
      { label: "proficiency bonus", value: signed(PROFICIENCY_BONUS) },
      { label: "passive perception", value: passiveOf("perception") },
      { label: "passive insight", value: passiveOf("insight") },
      { label: "passive investigation", value: passiveOf("investigation") },
      {
        label: "heroic inspiration",
        value: character.heroicInspiration ? "yes" : "no",
      },
    ],
  });

  sections.push({
    title: "attacks",
    rows: character.attacks.map((attack) => ({
      label:
        attack.name +
        " — " +
        attack.bonus +
        " — " +
        attack.damage +
        (attack.notes ? " — " + attack.notes : ""),
    })),
  });

  sections.push({
    title: "features & traits",
    rows: character.cls.features
      .concat("Subclass: " + character.cls.subclass)
      .concat(character.traits)
      .concat(character.feats)
      .map((entry) => ({ label: entry })),
  });

  sections.push({
    title: "proficiencies & training",
    rows: [
      { label: "armor", bold: true },
      { label: character.cls.armorTraining, indent: 12 },
      { label: "weapons", bold: true },
      { label: character.cls.weaponTraining, indent: 12 },
      { label: "tools", bold: true },
      { label: character.cls.toolTraining, indent: 12 },
      { label: character.background.tool, indent: 12 },
      { label: "languages", bold: true },
      { label: character.languages.join(", "), indent: 12 },
    ],
  });

  sections.push({
    title: "equipment",
    rows: character.equipment
      .map((item) => ({ label: item }))
      .concat([{ label: "coin", value: character.gold + " GP", bold: true }]),
  });

  if (character.spellcasting) {
    const casting = character.spellcasting;
    sections.push({
      title: casting.label,
      rows: [
        {
          label: "spellcasting ability",
          value: ABILITY_NAMES[casting.ability],
        },
        { label: "spell save DC", value: casting.dc },
        { label: "spell attack", value: casting.attack },
        { label: "level 1 slots", value: casting.slots },
        { label: "cantrips", bold: true },
        {
          label: casting.cantrips.length ? casting.cantrips.join(", ") : "none",
          indent: 12,
        },
        { label: "prepared", bold: true },
        { label: casting.prepared.join(", "), indent: 12 },
      ],
    });
  }

  return sections;
}

/* --- file assembly ---------------------------------------------------- */

// Footers are written last because they carry a page count, which is not
// known until the last page has been broken.
function pdfFooters(doc, serial) {
  const width = PDF_PAGE.width - PDF_PAGE.margin * 2;

  doc.pages.forEach((ops, index) => {
    const held = doc.ops;
    doc.ops = ops;

    const y = PDF_PAGE.margin + 12;
    pdfRule(doc, PDF_PAGE.margin, y + 12, width, 0.75);
    pdfWrite(doc, "cg–20 · " + serial, PDF_PAGE.margin, y, {
      size: 7.2,
      font: PDF_FONT.mono,
      gray: 0.45,
    });

    const note =
      "SRD 5.2.1 · CC BY 4.0 · page " + (index + 1) + " of " + doc.pages.length;
    pdfWrite(
      doc,
      note,
      PDF_PAGE.margin + width - pdfMeasure(note, 7.2, false, true),
      y,
      { size: 7.2, font: PDF_FONT.mono, gray: 0.45 },
    );

    doc.ops = held;
  });
}

function pdfSerialize(doc, title) {
  const count = doc.pages.length;
  const pageIds = doc.pages.map((page, index) => 3 + index);
  const contentIds = doc.pages.map((page, index) => 3 + count + index);
  const fontIds = [3 + count * 2, 4 + count * 2, 5 + count * 2];

  const bodies = [];
  bodies[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  bodies[2] =
    "<< /Type /Pages /Count " +
    count +
    " /Kids [" +
    pageIds.map((id) => id + " 0 R").join(" ") +
    "] >>";

  doc.pages.forEach((ops, index) => {
    bodies[pageIds[index]] =
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
      PDF_PAGE.width +
      " " +
      PDF_PAGE.height +
      "] /Resources << /Font << /F1 " +
      fontIds[0] +
      " 0 R /F2 " +
      fontIds[1] +
      " 0 R /F3 " +
      fontIds[2] +
      " 0 R >> >> /Contents " +
      contentIds[index] +
      " 0 R >>";

    const stream = ops.join("\n");
    bodies[contentIds[index]] =
      "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream";
  });

  ["Helvetica", "Helvetica-Bold", "Courier"].forEach((name, index) => {
    bodies[fontIds[index]] =
      "<< /Type /Font /Subtype /Type1 /BaseFont /" +
      name +
      " /Encoding /WinAnsiEncoding >>";
  });

  let out = "%PDF-1.4\n";
  const offsets = [];
  for (let id = 1; id < bodies.length; id += 1) {
    offsets[id] = out.length;
    out += id + " 0 obj\n" + bodies[id] + "\nendobj\n";
  }

  // This is why the file stays ASCII: every xref entry is a byte offset,
  // and one multi-byte character would slide all of them.
  const startxref = out.length;
  out += "xref\n0 " + bodies.length + "\n0000000000 65535 f \n";
  for (let id = 1; id < bodies.length; id += 1) {
    out += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
  }

  out +=
    "trailer\n<< /Size " +
    bodies.length +
    " /Root 1 0 R /Info << /Title (" +
    pdfString(title) +
    ") /Producer (cg-20) >> >>\nstartxref\n" +
    startxref +
    "\n%%EOF\n";

  return out;
}

function buildSheetPdf(character, serial) {
  const doc = pdfStart();
  pdfHeader(doc, character, serial);

  sheetSections(character).forEach((section) => {
    pdfHeading(doc, section.title);
    section.rows.forEach((row) => pdfRow(doc, row));
  });

  pdfBreakPage(doc);
  pdfFooters(doc, serial);
  return pdfSerialize(doc, character.name);
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "character"
  );
}

// The sheet leaves as a file the same way whatever it is made of, so
// the two exports share everything except what they put in the blob.
function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked a beat later: revoking it inline cancels the download in
  // some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function exportName(character, serial, extension) {
  return slugify(character.name) + "-" + serial + "." + extension;
}

function exportSheet() {
  const character = buildCharacter(state);
  const serial = serialOf(state);

  downloadFile(
    new Blob([buildSheetPdf(character, serial)], { type: "application/pdf" }),
    exportName(character, serial, "pdf"),
  );
  status("sheet exported as PDF");
}

// The sheet as data rather than as a page. Deliberately not a dump of the
// generator's own tables -- a species in here is a name and a size, not
// the whole SRD entry -- because this is for something that wants to read
// the character, not rebuild the machine. The serial does that.
function asJson(character, serial) {
  const abilities = {};
  ABILITIES.forEach((ability) => {
    const proficient = character.cls.saves.indexOf(ability) !== -1;
    abilities[ability] = {
      score: character.scores[ability],
      modifier: character.mods[ability],
      save: character.mods[ability] + (proficient ? PROFICIENCY_BONUS : 0),
      proficientSave: proficient,
      backgroundBoost: character.boosts[ability] || 0,
    };
  });

  const passive = (id) =>
    10 +
    skillBonus(
      character,
      SKILLS.find((skill) => skill.id === id),
    );

  return {
    serial: serial,
    generator: "cg-20",
    rules: "SRD 5.2.1, © Wizards of the Coast LLC, CC BY 4.0",
    name: character.name,
    level: 1,
    alignment: character.alignment,
    species: {
      name: character.species.name,
      lineage: character.lineage ? character.lineage.name : null,
      size: character.size,
      speed: character.speed,
    },
    class: {
      name: character.cls.name,
      subclass: character.cls.subclass,
      hitDie: "1d" + character.cls.hitDie,
    },
    background: {
      name: character.background.name,
      tool: character.background.tool,
    },
    proficiencyBonus: PROFICIENCY_BONUS,
    abilities: abilities,
    combat: {
      armorClass: character.armorClass,
      hitPoints: character.maxHp,
      initiative: character.initiative,
      heroicInspiration: character.heroicInspiration,
      passivePerception: passive("perception"),
      passiveInsight: passive("insight"),
      passiveInvestigation: passive("investigation"),
    },
    // Every skill, with what is true of it -- a consumer that only wants
    // the trained ones can filter, but one that wants the modifiers can
    // only get them from here.
    skills: SKILLS.map((skill) => ({
      name: skill.name,
      ability: skill.ability,
      modifier: skillBonus(character, skill),
      proficient: character.skills.indexOf(skill.name) !== -1,
      expertise: character.expertise.indexOf(skill.name) !== -1,
    })),
    attacks: character.attacks,
    equipment: character.equipment,
    gold: character.gold,
    features: {
      class: character.cls.features.concat(
        "Subclass: " + character.cls.subclass,
      ),
      species: character.traits,
      feats: character.feats,
    },
    training: {
      armor: character.cls.armorTraining,
      weapons: character.cls.weaponTraining,
      tools: character.cls.toolTraining,
      languages: character.languages,
    },
    spellcasting: character.spellcasting
      ? {
          label: character.spellcasting.label,
          ability: character.spellcasting.ability,
          saveDc: character.spellcasting.dc,
          attackBonus: character.spellcasting.attack,
          level1Slots: character.spellcasting.slots,
          cantrips: character.spellcasting.cantrips,
          prepared: character.spellcasting.prepared,
        }
      : null,
  };
}

function exportJson() {
  const character = buildCharacter(state);
  const serial = serialOf(state);

  downloadFile(
    new Blob([JSON.stringify(asJson(character, serial), null, 2)], {
      type: "application/json",
    }),
    exportName(character, serial, "json"),
  );
  status("sheet exported as JSON");
}

/* ---------------------------------------------------------
   Panel state, serial numbers, and controls
   --------------------------------------------------------- */

const state = {
  seeds: {},
  holds: {},
  method: "array",
  setting: "generic",
  cartridge: "none",
  flourish: FLOURISHES[FLOURISH_DEFAULT].id,
  // 1 is the machine on its own. Above that it is describing a party, and
  // every member past the first is derived from this serial.
  party: 1,
  // Which channels have a cable in them. The text is deliberately not
  // kept -- only the seed it minted, which is what the serial carries.
  patched: {},
  // Set only while a held name outlives the species it was drawn from.
  // null means "name follows the current species", which is the usual case.
  nameSpecies: null,
};

CHANNELS.forEach((channel) => {
  state.seeds[channel] = randomSeed();
  state.holds[channel] = false;
});

function serialOf(current) {
  const groups = CHANNELS.map((channel) => current.seeds[channel]);
  groups.push(METHOD_LETTERS[current.method]);
  // Generic adds no group. That keeps every serial minted before settings
  // existed byte-identical, so old links are not quietly invalidated.
  const setting = settingFor(current.setting);
  if (setting.id !== SETTINGS[0].id) groups.push(setting.code);

  // Same rule for the name pin: it is only written when the name really
  // has outlived its species, so nothing that was rolled without one
  // changes shape. "N" plus an index into SPECIES, which is already
  // load-bearing -- reordering that array rewrites every serial anyway.
  // Optional groups are written in a fixed order -- P, X, then N -- so a
  // given machine state always spells the same serial.
  if (current.party > 1) groups.push("P" + current.party);

  const cartridge = CARTRIDGES.findIndex(
    (entry) => entry.id === current.cartridge,
  );
  if (cartridge > 0) groups.push("X" + cartridge);

  const flourish = FLOURISHES.findIndex(
    (entry) => entry.id === current.flourish,
  );
  if (flourish !== FLOURISH_DEFAULT && flourish !== -1) {
    groups.push("F" + flourish);
  }

  const pinned = current.nameSpecies;
  if (
    pinned &&
    pinned !== speciesFor(current.seeds.species, current.cartridge).id
  ) {
    groups.push("N" + SPECIES.findIndex((entry) => entry.id === pinned));
  }
  return groups.join("-");
}

// Everything optional rides at the end of the serial behind a letter, so
// a serial minted before any of it still parses as the shorter thing it
// is. A seed is always four characters and a tail group is at most three,
// so the two can never be mistaken for each other.
const SERIAL_TAIL = {
  P: {
    key: "party",
    read: (value) => (value >= 1 && value <= PARTY_MAX ? value : null),
  },
  X: {
    key: "cartridge",
    read: (value) => (CARTRIDGES[value] ? CARTRIDGES[value].id : null),
  },
  N: {
    key: "nameSpecies",
    read: (value) => (SPECIES[value] ? SPECIES[value].id : null),
  },
  F: {
    key: "flourish",
    read: (value) => (FLOURISHES[value] ? FLOURISHES[value].id : null),
  },
};

function parseSerial(text) {
  const groups = text.replace(/^#/, "").toUpperCase().split("-");
  const withMethod = CHANNELS.length + 1;

  const tail = {
    party: 1,
    cartridge: CARTRIDGES[0].id,
    nameSpecies: null,
    flourish: FLOURISHES[FLOURISH_DEFAULT].id,
  };
  const seen = {};

  while (groups.length) {
    const match = /^([PXNF])(\d{1,2})$/.exec(groups[groups.length - 1]);
    if (!match) break;

    const entry = SERIAL_TAIL[match[1]];
    const value = entry.read(Number(match[2]));
    // An out-of-range group, or the same one twice, is refused rather
    // than shrugged off -- the same stance the setting letter takes.
    if (value === null || seen[entry.key]) return null;

    seen[entry.key] = true;
    tail[entry.key] = value;
    groups.pop();
  }

  if (groups.length !== withMethod && groups.length !== withMethod + 1) {
    return null;
  }

  let setting = SETTINGS[0].id;
  if (groups.length === withMethod + 1) {
    const code = groups.pop();
    const match = SETTINGS.find((entry) => entry.code === code);
    if (!match) return null;
    setting = match.id;
  }

  const methodGroup = groups.pop();
  const method = Object.keys(METHOD_LETTERS).find(
    (key) => METHOD_LETTERS[key] === methodGroup,
  );
  if (!method) return null;
  if (!groups.every((group) => /^[A-Z0-9]{4}$/.test(group))) return null;

  const seeds = {};
  CHANNELS.forEach((channel, index) => {
    seeds[channel] = groups[index];
  });
  return {
    seeds: seeds,
    method: method,
    setting: setting,
    cartridge: tail.cartridge,
    party: tail.party,
    nameSpecies: tail.nameSpecies,
    flourish: tail.flourish,
  };
}

// The panel's skin is a data attribute; the palettes live in the stylesheet
// so each setting stays a block of tokens rather than logic in here.
function applySetting() {
  const page = document.querySelector(".page-forge");
  if (page) page.setAttribute("data-setting", settingFor(state.setting).id);
}

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#*·";
let shuffleTimer = null;

function scramble(length) {
  let text = "";
  for (let i = 0; i < length; i += 1) {
    text += SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
  }
  return text;
}

/* ---------------------------------------------------------
   Takes -- the machine remembers its last rolls

   Sixteen serials in memory, nowhere else: stepping back through takes
   is just loading old serials, so it costs the format nothing. A serial
   arriving by hash starts a fresh reel -- a pasted link is a new
   session, not a continuation of this one.
   --------------------------------------------------------- */

const TAKE_LIMIT = 16;
// suppressed covers anything that is its own undo: stepping the reel,
// and dialling, which would otherwise flood sixteen slots in one spin.
const takes = { list: [], index: -1, suppressed: false };

function recordTake(serial) {
  if (takes.suppressed) return;
  if (takes.list[takes.index] === serial) return;

  // A new take after stepping back discards the future, like recording
  // over tape.
  takes.list = takes.list.slice(0, takes.index + 1);
  takes.list.push(serial);
  if (takes.list.length > TAKE_LIMIT) takes.list.shift();
  takes.index = takes.list.length - 1;
  syncTakeReadout();
}

function resetTakes() {
  takes.list = [];
  takes.index = -1;
}

function syncTakeReadout() {
  setText("lcd-take", "tk " + (takes.index + 1) + "/" + takes.list.length);
}

function stepTake(delta) {
  const target = takes.index + delta;
  if (target < 0) {
    status("no earlier take");
    return;
  }
  if (target >= takes.list.length) {
    status("no later take");
    return;
  }

  takes.suppressed = true;
  applySerial(parseSerial(takes.list[target]));
  takes.index = target;
  commit(false);
  takes.suppressed = false;

  syncTakeReadout();
  status("take " + (target + 1) + " of " + takes.list.length);
}

function commit(animated) {
  const character = buildCharacter(state);
  const serial = serialOf(state);

  recordTake(serial);
  syncLamps();
  syncPorts();
  renderParty();
  setText("serial", serial);
  setText("serial-lcd", serial);
  window.history.replaceState(null, "", "#" + serial);

  if (!animated || prefersReducedMotion) {
    render(character);
    return;
  }

  // The panel "searches" for a moment before it settles. Purely cosmetic:
  // the sheet below is only written once, at the end.
  const panel = byId("unit");
  panel.classList.add("is-busy");
  window.clearInterval(shuffleTimer);

  let ticks = 0;
  shuffleTimer = window.setInterval(function tick() {
    setText("lcd-name", scramble(14));
    setText("lcd-build", scramble(22));
    const noise = {};
    ABILITIES.forEach((ability) => {
      noise[ability] = 6 + Math.floor(Math.random() * 14);
    });
    setBars(noise);

    ticks += 1;
    if (ticks >= 9) {
      window.clearInterval(shuffleTimer);
      panel.classList.remove("is-busy");
      render(character);
    }
  }, 55);
}

// Hold the name and change the species and the name has to stay put,
// even though the two share a stream. Pin it to the species it was drawn
// from before that species goes; changing the name itself releases it.
// Rolling is not the only way a channel changes any more -- a patch cable
// does it too -- so both paths come through here.
function pinNameFor(channels) {
  if (channels.indexOf("name") !== -1) {
    state.nameSpecies = null;
  } else if (channels.indexOf("species") !== -1 && !state.nameSpecies) {
    state.nameSpecies = speciesFor(state.seeds.species, state.cartridge).id;
  }
}

function rollChannels(channels, animated) {
  pinNameFor(channels);

  channels.forEach((channel) => {
    state.seeds[channel] = randomSeed();
  });
  commit(animated);
}

/* ---------------------------------------------------------
   SYNC -- one serial, a whole party

   Member 1 is the machine itself. The rest are derived from its serial,
   so the link rebuilds the entire party -- and each member also spells a
   serial of its own, which is what the pull button loads.
   --------------------------------------------------------- */

// Derived from the serial the machine would have on its own, so the
// party group cannot feed its own derivation.
function baseSerialOf(current) {
  return serialOf(Object.assign({}, current, { party: 1 }));
}

function partySeeds(base, index) {
  const rng = makeRng("party/" + base + "/" + index);
  const seeds = {};
  CHANNELS.forEach((channel) => {
    seeds[channel] = mintSeed(rng);
  });
  return seeds;
}

function partyMember(current, index) {
  return {
    seeds:
      index === 1 ? current.seeds : partySeeds(baseSerialOf(current), index),
    method: current.method,
    setting: current.setting,
    cartridge: current.cartridge,
    flourish: current.flourish,
    party: 1,
    // A derived member was never held, so it has nothing pinned.
    nameSpecies: index === 1 ? current.nameSpecies : null,
  };
}

function renderParty() {
  const list = byId("party");
  if (!list) return;

  list.textContent = "";
  if (state.party < 2) return;

  for (let index = 1; index <= state.party; index += 1) {
    const member = partyMember(state, index);
    const character = buildCharacter(member);
    const serial = serialOf(member);

    const row = document.createElement("li");
    row.className = "party__row";

    const num = document.createElement("span");
    num.className = "party__num";
    num.textContent = String(index).padStart(2, "0");

    const name = document.createElement("span");
    name.className = "party__name";
    name.textContent = character.name;

    const build = document.createElement("span");
    build.className = "party__build";
    build.textContent = character.species.name + " " + character.cls.name;

    row.appendChild(num);
    row.appendChild(name);
    row.appendChild(build);

    if (index > 1) {
      const pull = document.createElement("button");
      pull.className = "party__pull";
      pull.type = "button";
      pull.textContent = "to main";
      pull.addEventListener("click", () => {
        // Load the member by its own serial rather than by copying seeds
        // across, so what lands on the sheet is exactly what that link
        // rebuilds. The party ends here: this machine is that character
        // now, on its own.
        applySerial(parseSerial(serial));
        status("pulled " + character.name + " to main");
        commit(true);
      });
      row.appendChild(pull);
    }

    list.appendChild(row);
  }
}

function status(message) {
  setText("lcd-status", message);
}

/* ---------------------------------------------------------
   MIDI -- five keys, five channels

   Real WebMIDI, which costs nothing to reach: it is a browser API, not a
   library. Access is asked for only when the reader presses connect, and
   when there is nothing to talk to the port says so rather than pretending.
   --------------------------------------------------------- */

const midiState = { connected: false, access: null };

function midiReport(message) {
  setText("midi-status", message);
  syncPorts();
  syncLamps();
}

function midiDevices(access) {
  const names = [];
  access.inputs.forEach((input) => names.push(input.name || "unnamed device"));
  return names;
}

function midiListen(access) {
  access.inputs.forEach((input) => {
    input.onmidimessage = onMidiMessage;
  });

  const names = midiDevices(access);
  midiState.connected = names.length > 0;
  midiReport(names.length ? "listening — " + names.join(", ") : "no device");
}

function onMidiMessage(event) {
  // [command, note, velocity]. A note-on with no velocity is a note-off
  // by another name, which is why the second test is here.
  const command = event.data[0] & 0xf0;
  const note = event.data[1];
  if (command !== 0x90 || event.data[2] === 0) return;

  const channel = CHANNELS[note % CHANNELS.length];
  status("midi rolled " + channel);
  rollChannels([channel], true);
}

function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    midiReport("midi not available in this browser");
    return;
  }
  // file:// is not a secure context, so a clone opened straight off disk
  // cannot do this. Everything else on the page still can.
  if (!window.isSecureContext) {
    midiReport("midi needs https or localhost");
    return;
  }

  midiReport("asking…");
  navigator.requestMIDIAccess().then(
    (access) => {
      midiState.access = access;
      access.onstatechange = () => midiListen(access);
      midiListen(access);
    },
    () => midiReport("midi access refused"),
  );
}

function copySheet() {
  const text = asPlainText(buildCharacter(state));

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    status("clipboard unavailable — use print");
    return;
  }

  navigator.clipboard.writeText(text).then(
    () => status("sheet copied to clipboard"),
    () => status("copy blocked by the browser"),
  );
}

/* ---------------------------------------------------------
   Knobs

   Rotary switches over radio groups. The radios stay the real control --
   they hold the value, take focus, and answer to the arrow keys -- and
   the dial is turned to match. Everything here is a second way to drive
   them, never the only way.

   A knob is [data-knob="<group>"] driving the radios named <group>, so
   the same code runs the 2-position ability-score switch and the
   5-position setting switch.
   --------------------------------------------------------- */

// How far the dial swings from centre, in degrees. The detents are spread
// evenly across it, so a knob's position count is the only thing that
// changes between one switch and the next.
const KNOB_SPREAD = 38;

// A drag shorter than this is treated as a click on the knob, which steps
// to the next position the way a real rotary switch does.
const KNOB_DRAG_SLOP = 4;

function knobRadios(group) {
  return Array.prototype.slice.call(
    document.querySelectorAll('[name="' + group + '"]'),
  );
}

function knobAngle(index, count) {
  if (count < 2) return 0;
  return -KNOB_SPREAD + (index / (count - 1)) * KNOB_SPREAD * 2;
}

function currentKnobIndex(group) {
  return knobRadios(group).findIndex((radio) => radio.checked);
}

// The detent marks are drawn from the same angle maths as the dial, rather
// than written out in CSS, so a knob with a different number of positions
// cannot drift out of step with its own ticks.
function drawKnobTicks(knob, group) {
  const holder = knob.querySelector("[data-knob-ticks]");
  if (!holder) return;
  const count = knobRadios(group).length;
  holder.textContent = "";
  for (let i = 0; i < count; i += 1) {
    const tick = document.createElement("span");
    tick.className = "knob__tick";
    tick.style.transform = "rotate(" + knobAngle(i, count) + "deg)";
    holder.appendChild(tick);
  }
}

function syncKnob(group) {
  const knob = document.querySelector('[data-knob="' + group + '"]');
  if (!knob) return;
  const radios = knobRadios(group);
  const index = radios.findIndex((radio) => radio.checked);
  if (index === -1) return;

  const dial = knob.querySelector("[data-knob-dial]");
  if (dial) {
    dial.style.transform = "rotate(" + knobAngle(index, radios.length) + "deg)";
  }
  knob.setAttribute("data-position", String(index));

  // The live position reads in the signal colour, so the knob says what it
  // is set to without relying on the pointer angle alone.
  const ticks = knob.querySelectorAll(".knob__tick");
  ticks.forEach((tick, i) => {
    tick.classList.toggle("is-on", i === index);
  });
}

// Select by index and let the group's own change handler do the rest, so
// the knob and the keyboard end up on exactly one code path.
function setKnobIndex(group, index) {
  const radios = knobRadios(group);
  const clamped = Math.max(0, Math.min(radios.length - 1, index));
  const radio = radios[clamped];
  if (!radio || radio.checked) return;
  radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles: true }));
}

// Pointer angle measured from the knob's centre: 0 at the top, positive
// clockwise, which is the same convention as the CSS rotation.
function pointerAngle(knob, event) {
  const box = knob.getBoundingClientRect();
  const dx = event.clientX - (box.left + box.width / 2);
  const dy = event.clientY - (box.top + box.height / 2);
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

function nearestDetent(angle, count) {
  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i < count; i += 1) {
    const gap = Math.abs(angle - knobAngle(i, count));
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}

function wireKnob(group) {
  const knob = document.querySelector('[data-knob="' + group + '"]');
  if (!knob) return;

  drawKnobTicks(knob, group);

  let dragging = false;
  let moved = false;

  // Capture keeps a drag alive if the pointer leaves the knob. It can throw
  // when there is no live pointer for the id -- a stale or synthetic event --
  // and an exception here would take the whole drag down with it.
  const capture = (event, take) => {
    try {
      if (take) knob.setPointerCapture(event.pointerId);
      else if (knob.hasPointerCapture(event.pointerId)) {
        knob.releasePointerCapture(event.pointerId);
      }
    } catch (ignored) {
      /* dragging still works without capture */
    }
  };

  knob.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = false;
    capture(event, true);
    event.preventDefault();
  });

  knob.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const count = knobRadios(group).length;
    const angle = pointerAngle(knob, event);
    // Ignore the first few degrees so a plain click doesn't register as a
    // drag and snap somewhere the user didn't intend.
    if (!moved) {
      const resting = knobAngle(currentKnobIndex(group), count);
      if (Math.abs(angle - resting) < KNOB_DRAG_SLOP) return;
      moved = true;
    }
    setKnobIndex(group, nearestDetent(angle, count));
  });

  const release = (event) => {
    if (!dragging) return;
    dragging = false;
    capture(event, false);
    // A click, not a drag: step to the next position and wrap.
    if (!moved) {
      const count = knobRadios(group).length;
      setKnobIndex(group, (currentKnobIndex(group) + 1) % count);
    }
  };

  knob.addEventListener("pointerup", release);
  knob.addEventListener("pointercancel", release);

  knob.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      setKnobIndex(
        group,
        currentKnobIndex(group) + (event.deltaY > 0 ? 1 : -1),
      );
    },
    { passive: false },
  );
}

/* ---------------------------------------------------------
   The port strip
   --------------------------------------------------------- */

// Kept in step with the transition on .bay by hand: the drawer has to be
// shut before it is hidden, and there is no way to say that in CSS.
const BAY_SLIDE_MS = 220;

function openBay(name) {
  document.querySelectorAll("[data-bay]").forEach((bay) => {
    if (bay.getAttribute("data-bay") === name) {
      bay.hidden = false;
      // Flush the shut state first, or there is nothing to slide from.
      // Reading a layout property is what forces that, deliberately --
      // waiting for a frame does not work in a tab nobody is looking at.
      void bay.offsetHeight;
      bay.classList.add("is-open");
      return;
    }

    if (bay.hidden) return;
    bay.classList.remove("is-open");

    // Hidden once it has finished closing, so nothing inside stays in the
    // tab order behind a shut drawer. On a timer rather than transitionend
    // because that event can simply never arrive -- a backgrounded tab
    // does not run transitions -- and a drawer stuck half-open in the tab
    // order is worse than one that closes a frame early.
    window.setTimeout(
      () => {
        if (!bay.classList.contains("is-open")) bay.hidden = true;
      },
      prefersReducedMotion ? 0 : BAY_SLIDE_MS,
    );
  });
  document.querySelectorAll("[data-port]").forEach((port) => {
    const own = port.getAttribute("data-port");
    if (port.tagName === "BUTTON") {
      port.setAttribute("aria-expanded", own === name ? "true" : "false");
    }
  });
}

function wirePorts() {
  document.querySelectorAll("button[data-port]").forEach((port) => {
    port.addEventListener("click", () => {
      const name = port.getAttribute("data-port");
      const open = port.getAttribute("aria-expanded") === "true";
      openBay(open ? null : name);
    });
  });
}

/* ---------------------------------------------------------
   INPUT -- five seed dials

   An endless encoder per channel rather than a switch: there is no list
   of positions to choose from, only a value to walk. Each dial keeps an
   anchor (the seed the channel held when dialling began) and an offset
   either side of it, so the sequence is reversible -- turn back and the
   character you just passed comes back exactly.

   The anchor re-takes itself whenever the channel's seed changes by some
   other route: a roll, a take, a serial off the address bar. Nothing has
   to tell the dial that happened; it notices.
   --------------------------------------------------------- */

const DIAL_STEP_DEGREES = 30;
const dials = {};

function dialFor(channel) {
  const dial = dials[channel];
  // Anchored to a seed the channel no longer holds, so something else
  // moved it and this dial starts again from where it is now.
  if (
    !dial ||
    seedFromDial(dial.anchor, dial.offset) !== state.seeds[channel]
  ) {
    dials[channel] = { anchor: state.seeds[channel], offset: 0 };
  }
  return dials[channel];
}

function stepDial(channel, delta) {
  const dial = dialFor(channel);
  dial.offset += delta;

  // A dialled species is a species change as far as a held name is
  // concerned, exactly as a rolled one would be.
  pinNameFor([channel]);

  state.seeds[channel] = seedFromDial(dial.anchor, dial.offset);
  state.patched[channel] = dial.offset !== 0;

  // Dialling holds the channel, so the next roll leaves it alone -- the
  // same bargain the panel already makes for anything set by hand.
  const dip = document.querySelector('[data-hold="' + channel + '"]');
  if (dial.offset !== 0) {
    state.holds[channel] = true;
    if (dip) dip.checked = true;
  }

  // No animation and no take: a spin would otherwise scramble the display
  // once per detent and bury the reel sixteen deep. The dial undoes
  // itself by turning the other way.
  takes.suppressed = true;
  commit(false);
  takes.suppressed = false;

  syncDials();
  status(channel + " — " + state.seeds[channel]);
}

function syncDials() {
  document.querySelectorAll("[data-dial]").forEach((knob) => {
    const channel = knob.getAttribute("data-dial");
    const dial = dials[channel];
    const offset = dial ? dial.offset : 0;
    const seed = state.seeds[channel];

    const face = knob.querySelector("[data-knob-dial]");
    if (face) {
      face.style.transform = "rotate(" + offset * DIAL_STEP_DEGREES + "deg)";
    }

    knob.setAttribute("aria-valuenow", String(offset));
    knob.setAttribute("aria-valuetext", "seed " + seed);

    const readout = document.querySelector(
      '[data-dial-seed="' + channel + '"]',
    );
    if (readout) readout.textContent = seed;

    const row = knob.parentNode;
    if (row) row.classList.toggle("is-dialled", offset !== 0);
  });
}

function wireDials() {
  document.querySelectorAll("[data-dial]").forEach((knob) => {
    const channel = knob.getAttribute("data-dial");

    // The ticks are drawn once, evenly, and spin past the pointer: an
    // endless encoder has no detent to sit on.
    const holder = knob.querySelector("[data-knob-ticks]");
    if (holder) {
      holder.textContent = "";
      for (let i = 0; i < 12; i += 1) {
        const tick = document.createElement("span");
        tick.className = "knob__tick";
        tick.style.transform = "rotate(" + i * DIAL_STEP_DEGREES + "deg)";
        holder.appendChild(tick);
      }
    }

    let dragging = false;
    let moved = false;
    let last = 0;

    knob.addEventListener("pointerdown", (event) => {
      dragging = true;
      moved = false;
      last = pointerAngle(knob, event);
      try {
        knob.setPointerCapture(event.pointerId);
      } catch (error) {
        // No live pointer for this id; the drag still works without it.
      }
    });

    knob.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const angle = pointerAngle(knob, event);
      let delta = angle - last;
      // Crossing the top wraps from +180 to -180; unwrap it so a slow
      // turn past twelve o'clock does not fly back the other way.
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      if (Math.abs(delta) >= DIAL_STEP_DEGREES) {
        const steps = Math.trunc(delta / DIAL_STEP_DEGREES);
        last = angle;
        moved = true;
        stepDial(channel, steps);
      }
    });

    const release = () => {
      if (dragging && !moved) stepDial(channel, 1);
      dragging = false;
    };
    knob.addEventListener("pointerup", release);
    knob.addEventListener("pointercancel", () => {
      dragging = false;
    });

    knob.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        stepDial(channel, event.deltaY > 0 ? 1 : -1);
      },
      { passive: false },
    );

    knob.addEventListener("keydown", (event) => {
      const forward = event.key === "ArrowRight" || event.key === "ArrowUp";
      const back = event.key === "ArrowLeft" || event.key === "ArrowDown";
      if (!forward && !back) return;
      event.preventDefault();
      stepDial(channel, forward ? 1 : -1);
    });
  });

  syncDials();
}

// A serial off the address bar is a different character, so every dial
// lets go of its anchor and the channels stop reading as dialled.
function clearPatches() {
  state.patched = {};
  Object.keys(dials).forEach((channel) => {
    delete dials[channel];
  });
}

function wireCartridge() {
  document.querySelectorAll('[name="cartridge"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.cartridge = radio.value;
      syncKnob("cartridge");
      setText("cartridge-note", cartridgeFor(state.cartridge).note);
      status(cartridgeFor(state.cartridge).label);
      // A cartridge changes what the seeds mean, so this really is a new
      // character even though nothing was re-rolled.
      commit(true);
    });
  });

  wireKnob("cartridge");
  syncKnob("cartridge");
  setText("cartridge-note", cartridgeFor(state.cartridge).note);
}

function wireFlourish() {
  document.querySelectorAll('[name="flourish"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.flourish = radio.value;
      syncKnob("flourish");
      status(flourishFor(state.flourish).label + " names");
      // The knob changes what the name seed produces, so the name on the
      // sheet really can change -- that is a re-commit, not a re-skin.
      commit(true);
    });
  });

  wireKnob("flourish");
  syncKnob("flourish");
}

function wireParty() {
  const size = byId("party-size");
  if (!size) return;

  const readout = byId("party-readout");
  const describe = (n) => (n > 1 ? "party of " + n : "solo");

  size.addEventListener("input", () => {
    const clamped = Math.max(1, Math.min(PARTY_MAX, Number(size.value) || 1));
    state.party = clamped;
    if (readout) readout.textContent = describe(clamped);
    size.setAttribute("aria-valuetext", describe(clamped));
    status(describe(clamped));
    // The character on the sheet does not change when the party grows --
    // it is member one either way -- so nothing here is re-rolled.
    commit(false);
  });
  size.setAttribute("aria-valuetext", describe(state.party));
}

/* ---------------------------------------------------------
   Audition -- hold to preview, roll to keep

   A momentary key, the most pocket-operator gesture there is: while it
   is down the display shows a phantom roll of the open channels, and
   nothing else on the page knows. Release discards it; pressing roll
   (or r) while holding keeps it.
   --------------------------------------------------------- */

let audition = null;

function startAudition() {
  if (audition) return;

  const open = CHANNELS.filter((channel) => !state.holds[channel]);
  if (open.length === 0) {
    status("all channels held");
    return;
  }

  const seeds = Object.assign({}, state.seeds);
  open.forEach((channel) => {
    seeds[channel] = randomSeed();
  });

  audition = { seeds: seeds, open: open };
  renderDisplay(buildCharacter(Object.assign({}, state, { seeds: seeds })));
  byId("audition").setAttribute("aria-pressed", "true");
  status("auditioning — release to discard, roll to keep");
}

function endAudition() {
  if (!audition) return;
  audition = null;
  renderDisplay(buildCharacter(state));
  byId("audition").setAttribute("aria-pressed", "false");
  status("audition discarded");
}

function keepAudition() {
  const held = audition;
  audition = null;
  byId("audition").setAttribute("aria-pressed", "false");

  pinNameFor(held.open);
  held.open.forEach((channel) => {
    state.seeds[channel] = held.seeds[channel];
  });
  status("kept the audition");
  commit(true);
}

function wireAudition() {
  const key = byId("audition");
  key.addEventListener("pointerdown", startAudition);
  key.addEventListener("pointerup", endAudition);
  key.addEventListener("pointerleave", endAudition);
  key.addEventListener("pointercancel", endAudition);

  // Space held down is the keyboard version of a held key. keydown
  // repeats while held; startAudition already ignores the repeats.
  key.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    startAudition();
  });
  key.addEventListener("keyup", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    endAudition();
  });
}

/* ---------------------------------------------------------
   Transport -- the machine rolls itself

   A latching play key and a three-detent tempo knob. Every tick rolls
   the open channels through the same path a hand-roll takes, so each
   one commits a real serial and lands on the take reel. Reduced motion
   turns the transport off entirely, and says so on the key.
   --------------------------------------------------------- */

const TEMPOS = { slow: 6000, medium: 3000, fast: 1500 };
const transport = { timer: null, tempo: "medium" };

function transportRunning() {
  return transport.timer !== null;
}

function stopTransport(quiet) {
  if (!transportRunning()) return;
  window.clearInterval(transport.timer);
  transport.timer = null;
  byId("play").setAttribute("aria-pressed", "false");
  if (!quiet) status("transport stopped");
}

function startTransport() {
  if (prefersReducedMotion) {
    status("transport off — reduced motion");
    return;
  }

  window.clearInterval(transport.timer);
  transport.timer = window.setInterval(() => {
    const open = CHANNELS.filter((channel) => !state.holds[channel]);
    if (open.length === 0) {
      stopTransport();
      status("all channels held — transport stopped");
      return;
    }
    rollChannels(open, true);
  }, TEMPOS[transport.tempo]);

  byId("play").setAttribute("aria-pressed", "true");
  status("transport running — " + transport.tempo);
}

function wireTransport() {
  const play = byId("play");

  if (prefersReducedMotion) {
    play.disabled = true;
    const sub = play.querySelector(".key__sub");
    if (sub) sub.textContent = "off — reduced motion";
  }

  play.addEventListener("click", () => {
    if (transportRunning()) {
      stopTransport();
    } else {
      startTransport();
    }
  });

  document.querySelectorAll('[name="tempo"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      transport.tempo = radio.value;
      syncKnob("tempo");
      syncLamps();
      status("tempo — " + radio.value);
      // A new tempo takes hold immediately if the reel is running.
      if (transportRunning()) startTransport();
    });
  });

  wireKnob("tempo");
  syncKnob("tempo");
}

function wireControls() {
  byId("roll").addEventListener("click", () => {
    // Rolling while auditioning keeps the audition -- the phantom on the
    // display is exactly what you are asking for.
    if (audition) {
      stopTransport(true);
      keepAudition();
      return;
    }

    stopTransport(true);
    const open = CHANNELS.filter((channel) => !state.holds[channel]);
    if (open.length === 0) {
      status("all channels held");
      return;
    }
    status("rolled " + open.length + " of 5 channels");
    rollChannels(open, true);
  });

  byId("take-back").addEventListener("click", () => {
    stopTransport(true);
    stepTake(-1);
  });
  byId("take-forward").addEventListener("click", () => {
    stopTransport(true);
    stepTake(1);
  });
  wireAudition();
  wireTransport();

  // GLOW is a feel control and deliberately stateless: a reload is a
  // power cycle, and the fader comes back up at its detent.
  const glow = byId("glow");
  if (glow) {
    glow.addEventListener("input", () => {
      const display = document.querySelector(".unit__display");
      if (display) display.style.setProperty("--glow", glow.value / 100);
    });
  }

  document.querySelectorAll("[data-channel]").forEach((pad) => {
    pad.addEventListener("click", () => {
      stopTransport(true);
      const channel = pad.getAttribute("data-channel");
      status("re-rolled " + channel);
      rollChannels([channel], true);
    });
  });

  document.querySelectorAll("[data-hold]").forEach((dip) => {
    dip.addEventListener("change", () => {
      const channel = dip.getAttribute("data-hold");
      state.holds[channel] = dip.checked;
      // A hold changes no seed, so there is nothing to re-commit -- the
      // lamp is the only thing on the display that moves.
      syncLamps();
      status(channel + (dip.checked ? " held" : " released"));
    });
  });

  document.querySelectorAll('[name="method"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.method = radio.value;
      syncKnob("method");
      status(
        radio.value === "array"
          ? "standard array 15/14/13/12/10/8"
          : "4d6 drop lowest",
      );
      commit(true);
    });
  });

  document.querySelectorAll('[name="setting"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.setting = radio.value;
      syncKnob("setting");
      applySetting();
      status(settingFor(state.setting).label + " panel");
      // The setting does not reach buildCharacter yet, so the sheet is the
      // same character either way. Re-running the "searching" animation
      // would imply a re-roll that did not happen.
      commit(false);
    });
  });

  wireKnob("method");
  wireKnob("setting");
  syncKnob("method");
  syncKnob("setting");

  wirePorts();
  wireDials();
  wireCartridge();
  wireFlourish();
  wireParty();
  byId("midi-connect").addEventListener("click", connectMidi);

  byId("copy").addEventListener("click", copySheet);
  byId("export-pdf").addEventListener("click", exportSheet);
  byId("export-json").addEventListener("click", exportJson);

  // One shortcut, and only when nothing else wants the key.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "r" && event.key !== "R") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const active = document.activeElement;
    const tag = active && active.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    // r on a focused button would double-fire -- except on the audition
    // key, where r-while-holding is exactly how a keep is played.
    if (tag === "BUTTON" && !(audition && active.id === "audition")) return;
    byId("roll").click();
  });
}

// Load a parsed serial into the panel. The knob is synced explicitly because
// setting .checked in script does not fire a change event.
function applySerial(parsed) {
  state.seeds = parsed.seeds;
  state.method = parsed.method;
  state.setting = parsed.setting;
  state.cartridge = parsed.cartridge;
  state.flourish = parsed.flourish;
  state.party = parsed.party;
  state.nameSpecies = parsed.nameSpecies;

  clearPatches();

  const size = byId("party-size");
  if (size) size.value = String(state.party);
  const readout = byId("party-readout");
  if (readout) {
    readout.textContent = state.party > 1 ? "party of " + state.party : "solo";
  }
  setText("cartridge-note", cartridgeFor(state.cartridge).note);

  [
    ["method", state.method],
    ["setting", state.setting],
    ["cartridge", state.cartridge],
    ["flourish", state.flourish],
  ].forEach((pair) => {
    const radio = document.querySelector(
      '[name="' + pair[0] + '"][value="' + pair[1] + '"]',
    );
    if (radio) radio.checked = true;
    syncKnob(pair[0]);
  });

  applySetting();
}

// Paste a serial into the address bar of an open tab and it should rebuild
// that character, the same as opening the link fresh. commit() writes the
// hash with history.replaceState, which does not fire hashchange, so this
// only ever runs for a change the reader made.
function wireHashChange() {
  window.addEventListener("hashchange", () => {
    const parsed = parseSerial(window.location.hash);

    if (!parsed) {
      // Not a serial. Put ours back rather than let the address bar sit there
      // describing a character that isn't on screen.
      window.history.replaceState(null, "", "#" + serialOf(state));
      status("serial not recognised");
      return;
    }

    if (serialOf(parsed) === serialOf(state)) return;

    // A pasted link is a new session: the reel starts over and anything
    // the machine was doing on its own stops.
    stopTransport(true);
    endAudition();
    resetTakes();
    applySerial(parsed);
    status("loaded from serial");
    commit(true);
  });
}

function init() {
  const fromHash = parseSerial(window.location.hash);
  if (fromHash) {
    applySerial(fromHash);
    status("loaded from serial");
  } else {
    status("ready");
  }

  // Generic reads from the base tokens, but stamp the attribute anyway so
  // the panel's skin is always stated rather than implied by its absence.
  applySetting();

  wireControls();
  wireHashChange();
  commit(false);
}

init();
