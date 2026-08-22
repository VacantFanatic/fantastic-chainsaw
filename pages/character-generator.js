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

function randomSeed() {
  let seed = "";
  for (let i = 0; i < SEED_LENGTH; i += 1) {
    seed += Math.floor(Math.random() * 36).toString(36);
  }
  return seed.toUpperCase();
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

function buildName(rng, speciesId) {
  const bank = NAME_BANKS[speciesId];
  const given = pick(rng, bank.given[0]) + pick(rng, bank.given[1]);
  const family = bank.family[1]
    ? pick(rng, bank.family[0]) + pick(rng, bank.family[1])
    : pick(rng, bank.family[0]);
  const name = given + " " + family;
  return rng() < 0.28 ? name + ", " + pick(rng, EPITHETS) : name;
}

function rollAbilityScores(rng, method) {
  if (method === "array") return STANDARD_ARRAY.slice();

  const scores = [];
  for (let i = 0; i < 6; i += 1) {
    const dice = [
      rollDie(rng, 6),
      rollDie(rng, 6),
      rollDie(rng, 6),
      rollDie(rng, 6),
    ].sort((a, b) => b - a);
    scores.push(dice[0] + dice[1] + dice[2]);
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

function buildCharacter(state) {
  const speciesRng = makeRng("species/" + state.seeds.species);
  const classRng = makeRng("class/" + state.seeds.class);
  const backgroundRng = makeRng("background/" + state.seeds.background);
  const statsRng = makeRng("stats/" + state.seeds.stats + "/" + state.method);

  const species = pick(speciesRng, SPECIES);
  const lineage = species.lineage
    ? pick(speciesRng, species.lineage.options)
    : null;
  const size = pick(speciesRng, species.size);
  const speed = (lineage && lineage.speed) || species.speed;

  const cls = pick(classRng, CLASSES);
  const background = pick(backgroundRng, BACKGROUNDS);
  const priority = ABILITY_PRIORITY[cls.id];

  const nameRng = makeRng("name/" + state.seeds.name + "/" + species.id);
  const name = buildName(nameRng, species.id);

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
    const bonus =
      character.mods[skill.ability] +
      (proficient ? PROFICIENCY_BONUS : 0) +
      (expert ? PROFICIENCY_BONUS : 0);

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

  setText("lcd-name", character.name);
  setText(
    "lcd-build",
    character.species.name + " " + character.cls.name + " · level 1",
  );
  setBars(character.scores);

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
   Panel state, serial numbers, and controls
   --------------------------------------------------------- */

const state = {
  seeds: {},
  holds: {},
  method: "array",
};

CHANNELS.forEach((channel) => {
  state.seeds[channel] = randomSeed();
  state.holds[channel] = false;
});

function serialOf(current) {
  const groups = CHANNELS.map((channel) => current.seeds[channel]);
  groups.push(current.method === "array" ? "A" : "R");
  return groups.join("-");
}

function parseSerial(text) {
  const groups = text.replace(/^#/, "").toUpperCase().split("-");
  if (groups.length !== CHANNELS.length + 1) return null;

  const methodGroup = groups.pop();
  if (methodGroup !== "A" && methodGroup !== "R") return null;
  if (!groups.every((group) => /^[A-Z0-9]{4}$/.test(group))) return null;

  const seeds = {};
  CHANNELS.forEach((channel, index) => {
    seeds[channel] = groups[index];
  });
  return { seeds: seeds, method: methodGroup === "A" ? "array" : "dice" };
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

function commit(animated) {
  const character = buildCharacter(state);
  const serial = serialOf(state);

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

function rollChannels(channels, animated) {
  channels.forEach((channel) => {
    state.seeds[channel] = randomSeed();
  });
  commit(animated);
}

function status(message) {
  setText("lcd-status", message);
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
   The ability-score knob

   A rotary switch over the method radios. The radios stay the real
   control -- they hold the value, take focus, and answer to the arrow
   keys -- and the dial is turned to match. Everything here is a second
   way to drive them, never the only way.
   --------------------------------------------------------- */

// How far the dial swings from centre, in degrees. The detents are spread
// evenly across it, so adding a third method needs no change here.
const KNOB_SPREAD = 38;

// A drag shorter than this is treated as a click on the knob, which steps
// to the next position the way a real rotary switch does.
const KNOB_DRAG_SLOP = 4;

function methodRadios() {
  return Array.prototype.slice.call(
    document.querySelectorAll('[name="method"]'),
  );
}

function knobAngle(index, count) {
  if (count < 2) return 0;
  return -KNOB_SPREAD + (index / (count - 1)) * KNOB_SPREAD * 2;
}

function syncKnob() {
  const knob = document.querySelector("[data-knob]");
  if (!knob) return;
  const radios = methodRadios();
  const index = radios.findIndex((radio) => radio.checked);
  if (index === -1) return;

  const dial = knob.querySelector("[data-knob-dial]");
  if (dial) {
    dial.style.transform = "rotate(" + knobAngle(index, radios.length) + "deg)";
  }
  knob.setAttribute("data-position", String(index));
}

// Select by index and let the existing radio handler do the rest, so the
// knob and the keyboard end up on exactly one code path.
function setMethodIndex(index) {
  const radios = methodRadios();
  const clamped = Math.max(0, Math.min(radios.length - 1, index));
  const radio = radios[clamped];
  if (!radio || radio.checked) return;
  radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles: true }));
}

function currentMethodIndex() {
  return methodRadios().findIndex((radio) => radio.checked);
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

function wireKnob() {
  const knob = document.querySelector("[data-knob]");
  if (!knob) return;

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
    const count = methodRadios().length;
    const angle = pointerAngle(knob, event);
    // Ignore the first few degrees so a plain click doesn't register as a
    // drag and snap somewhere the user didn't intend.
    if (!moved) {
      const resting = knobAngle(currentMethodIndex(), count);
      if (Math.abs(angle - resting) < KNOB_DRAG_SLOP) return;
      moved = true;
    }
    setMethodIndex(nearestDetent(angle, count));
  });

  const release = (event) => {
    if (!dragging) return;
    dragging = false;
    capture(event, false);
    // A click, not a drag: step to the next position and wrap.
    if (!moved) {
      const count = methodRadios().length;
      setMethodIndex((currentMethodIndex() + 1) % count);
    }
  };

  knob.addEventListener("pointerup", release);
  knob.addEventListener("pointercancel", release);

  knob.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      setMethodIndex(currentMethodIndex() + (event.deltaY > 0 ? 1 : -1));
    },
    { passive: false },
  );
}

function wireControls() {
  byId("roll").addEventListener("click", () => {
    const open = CHANNELS.filter((channel) => !state.holds[channel]);
    if (open.length === 0) {
      status("all channels held");
      return;
    }
    status("rolled " + open.length + " of 5 channels");
    rollChannels(open, true);
  });

  document.querySelectorAll("[data-channel]").forEach((pad) => {
    pad.addEventListener("click", () => {
      const channel = pad.getAttribute("data-channel");
      status("re-rolled " + channel);
      rollChannels([channel], true);
    });
  });

  document.querySelectorAll("[data-hold]").forEach((dip) => {
    dip.addEventListener("change", () => {
      const channel = dip.getAttribute("data-hold");
      state.holds[channel] = dip.checked;
      status(channel + (dip.checked ? " held" : " released"));
    });
  });

  document.querySelectorAll('[name="method"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.method = radio.value;
      syncKnob();
      status(
        radio.value === "array"
          ? "standard array 15/14/13/12/10/8"
          : "4d6 drop lowest",
      );
      commit(true);
    });
  });

  wireKnob();
  syncKnob();

  byId("copy").addEventListener("click", copySheet);

  // One shortcut, and only when nothing else wants the key.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "r" && event.key !== "R") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    byId("roll").click();
  });
}

// Load a parsed serial into the panel. The knob is synced explicitly because
// setting .checked in script does not fire a change event.
function applySerial(parsed) {
  state.seeds = parsed.seeds;
  state.method = parsed.method;
  const radio = document.querySelector(
    '[name="method"][value="' + state.method + '"]',
  );
  if (radio) radio.checked = true;
  syncKnob();
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

  wireControls();
  wireHashChange();
  commit(false);
}

init();
