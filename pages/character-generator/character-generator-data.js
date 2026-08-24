// CG-20 reference data: the SRD 5.2.1 tables (species, classes,
// backgrounds, weapons, armor, spells, name banks) plus the
// settings/cartridges/flourishes that configure what a roll can produce.
//
// Loaded before character-generator-engine.js, which consumes these
// tables. Pure data and small "look up by id" accessors only -- no
// randomness, no character assembly. See character-generator.js for an
// overview of the whole machine.

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
    hpPerLevel: 1,
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
  {
    id: "half-dwarf",
    name: "Half-Dwarf",
    settings: ["dark-sun"],
    size: ["Medium"],
    speed: 30,
    hpPerLevel: 1,
    traits: [
      "Darkvision 60 ft.",
      "Powerful Build — advantage on Grappled saves, count as Large for carry",
      "Sinewed — +1 Hit Point per level",
      "Tireless — a Long Rest takes 4 hours",
    ],
  },
  {
    id: "roadkin",
    name: "Roadkin",
    settings: ["dragonlance"],
    size: ["Small"],
    speed: 30,
    traits: [
      "Fearless — advantage on saves against the Frightened condition",
      "Nimble — move through the space of larger creatures",
      "Unbothered — you have never once been talked out of anything",
    ],
    keenSenses: ["Investigation", "Perception", "Sleight of Hand"],
    keenSenseLabel: "Curious Hands",
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
  "half-dwarf": {
    given: [
      ["Gar", "Mek", "Thal", "Rud", "Sen", "Kav", "Bru", "Ort"],
      ["ak", "en", "ir", "us", "and", "ek", "om", "ar"],
    ],
    family: [
      ["Sun", "Salt", "Ash", "Slag", "Grit", "Kiln", "Brine", "Scour"],
      ["broken", "bearer", "hand", "back", "born", "struck", "worn", "cast"],
    ],
  },
  roadkin: {
    given: [
      ["Tam", "Pib", "Nell", "Jory", "Sil", "Wick", "Bree", "Ond"],
      ["kin", "ra", "ow", "et", "by", "le", "na", "ick"],
    ],
    family: [
      ["Nine", "Far", "Pocket", "Ever", "Half", "Long", "Quick", "Odd"],
      [
        "pockets",
        "whistle",
        "step",
        "wander",
        "penny",
        "road",
        "latch",
        "spoon",
      ],
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

// Campaign settings. A table like CARTRIDGES: every field past the first
// three is optional, and every one falls back, so generic can carry none
// of them and stay the absence of a setting rather than one of five.
//
//   name             what the sheet prints; `label` is the panel's
//   species/classes  filters, same signature as a cartridge's
//   names            per-species syllable banks, overriding NAME_BANKS
//   epithets         overriding EPITHETS
//   regions          where someone is from; no regions means no homeland
//   subclasses       renames a class's subclass, by class id
//
// Nothing here restats an SRD entry. The place names, epithets, syllables
// and subclass names are all written here -- the SRD has no such tables,
// and the published settings these are named after are not ours to copy.
//
// The code letter is what goes in the serial. Generic is deliberately
// letterless -- see serialOf.
const SETTINGS = [
  {
    id: "generic",
    name: "Generic",
    code: "G",
    label: "generic",
    note: "the whole book, no world attached.",
  },
  {
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
  },
  {
    id: "greyhawk",
    name: "Greyhawk",
    code: "H",
    label: "greyhawk",
    note: "older and colder. a narrower roster, a longer memory.",
    species: (list) =>
      list.filter(
        (entry) => entry.id !== "dragonborn" && entry.id !== "goliath",
      ),
    names: {
      human: {
        given: [
          ["Ald", "Cuth", "Erly", "Gwyn", "Hal", "Osric", "Ren", "Wilm"],
          ["ric", "mund", "a", "eth", "win", "gar", "ild", "ot"],
        ],
        family: [
          ["Grey", "Marsh", "Kettle", "Black", "Stand", "Old", "Rook", "Bram"],
          [
            "ward",
            "field",
            "stone",
            "rush",
            "gate",
            "barrow",
            "mill",
            "hollow",
          ],
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
  },
  {
    id: "dark-sun",
    name: "Dark Sun",
    code: "D",
    label: "dark sun",
    note: "no gods, no water, and no going back.",
    // A thinner bestiary and an emptier sky: the gods are gone, which is
    // what takes the cleric and the paladin with them. The goliath stays
    // as the big folk, and the half-dwarf is native here and nowhere else.
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
          [
            "Deep",
            "Stone",
            "Salt",
            "Furrow",
            "Iron",
            "Kiln",
            "Sand",
            "Cistern",
          ],
          [
            "keeper",
            "tender",
            "oath",
            "delve",
            "warden",
            "brand",
            "hold",
            "vow",
          ],
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
    ],
    subclasses: {
      druid: "Circle of the Last Water",
      fighter: "Arena Champion",
      ranger: "Flats-Walker",
      wizard: "the Ashen Art",
    },
  },
  {
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
          [
            "Silver",
            "Moon",
            "Bright",
            "Iron",
            "Lance",
            "Storm",
            "White",
            "Ever",
          ],
          [
            "blade",
            "watch",
            "banner",
            "field",
            "moor",
            "vale",
            "oath",
            "light",
          ],
        ],
      },
      gnome: {
        given: [
          ["Cog", "Bell", "Pyr", "Nim", "Tock", "Ves", "Wim", "Zan"],
          ["ric", "itt", "ora", "ex", "ple", "adin", "us", "ick"],
        ],
        family: [
          [
            "Over",
            "Under",
            "Cross",
            "Back",
            "Fore",
            "Counter",
            "Half",
            "Double",
          ],
          [
            "thread",
            "wound",
            "spring",
            "gauge",
            "flange",
            "ratchet",
            "bearing",
          ],
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
    ],
    subclasses: {
      bard: "College of the Long Road",
      cleric: "Restored Faith Domain",
      paladin: "Oath of the Broken Lance",
      wizard: "Order of the Crimson Moon",
    },
  },
];

function settingFor(id) {
  return SETTINGS.find((entry) => entry.id === id) || SETTINGS[0];
}

// Everything a setting can override falls back to the generic table, so a
// setting only has to write down the parts that differ.
function nameBankFor(speciesId, settingId) {
  const names = settingFor(settingId).names;
  return (names && names[speciesId]) || NAME_BANKS[speciesId];
}

function epithetsFor(settingId) {
  return settingFor(settingId).epithets || EPITHETS;
}

function subclassFor(cls, settingId) {
  const named = settingFor(settingId).subclasses;
  return (named && named[cls.id]) || cls.subclass;
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
    // Anyone who is only ever Small. Tested by size rather than by a list
    // of ids so that a setting's own small folk are caught too, without
    // this entry having to know they exist.
    species: (list) =>
      list.filter(
        (entry) => entry.size.length === 1 && entry.size[0] === "Small",
      ),
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

// Which species exist in a world at all. An entry with no `settings` list
// exists everywhere, which is what all nine SRD entries are -- so generic
// filters down to exactly those nine, in their original order, and every
// character rolled without a setting letter still rolls the same.
function nativeSpecies(settingId) {
  return SPECIES.filter(
    (entry) => !entry.settings || entry.settings.indexOf(settingId) !== -1,
  );
}

// Belonging first, then what the world refuses, then what the machine was
// told. Both clamps keep the empty-result fallback, so a cross like small
// folk against dark sun narrows rather than breaking.
function speciesListFor(cartridgeId, settingId) {
  const world = clampList(
    nativeSpecies(settingId),
    settingFor(settingId).species,
  );
  return clampList(world, cartridgeFor(cartridgeId).species);
}

function classListFor(cartridgeId, settingId) {
  const world = clampList(CLASSES, settingFor(settingId).classes);
  return clampList(world, cartridgeFor(cartridgeId).classes);
}

// How many characters one serial can describe.
const PARTY_MAX = 6;

const CHANNELS = ["name", "species", "class", "background", "stats"];
const SEED_LENGTH = 4;
