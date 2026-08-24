// CG-20 engine: seeded randomness plus buildCharacter(), which turns five
// seeds and a method/setting/cartridge/level/flourish into a character.
//
// Reads the tables in character-generator-data.js (loaded first) and has
// no DOM dependency of its own -- it can be called from a console with
// nothing rendered. See character-generator.js for an overview of the
// whole machine.

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

/* ---------------------------------------------------------
   Levels 1-5

   The machine used to be a level 1 machine and said so in a constant.
   These tables are what a level knob needs. Everything here is the 2024
   rules as published in SRD 5.2.1.

   !! NOT YET PROOFREAD AGAINST THE SRD !! Every other number in this
   file was diffed against the document (see NOTES) and five real errors
   fell out of that pass. These tables have not had it: the fetch was
   blocked when they were written. Treat levels 2-5 as unverified until
   somebody runs the same check. The level 1 column is the old data and
   is proofread.
   --------------------------------------------------------- */

const MAX_LEVEL = 5;

// Proficiency bonus is +2 through level 4 and +3 at 5.
function proficiencyBonus(level) {
  return 2 + Math.floor((Math.min(level, 20) - 1) / 4);
}

// Level 1 is a full hit die; every level after takes the fixed average,
// which is the option the rules give for not rolling.
function hitPointsFor(cls, conMod, level) {
  const perLevel = Math.floor(cls.hitDie / 2) + 1 + conMod;
  return cls.hitDie + conMod + Math.max(0, level - 1) * perLevel;
}

// Slots by caster kind, indexed by level, each entry [1st, 2nd, 3rd].
const SPELL_SLOTS = {
  full: [[2], [3], [4, 2], [4, 3], [4, 3, 2]],
  half: [[2], [2], [3], [3], [4, 2]],
};

// Warlock counts its own slots, and they are all the same level at once.
const PACT_MAGIC = [
  { slots: 1, level: 1 },
  { slots: 2, level: 1 },
  { slots: 2, level: 2 },
  { slots: 2, level: 2 },
  { slots: 2, level: 3 },
];

// Cantrips and prepared spells per class, per level 1-5.
const CASTER_PROGRESSION = {
  bard: { kind: "full", cantrips: [2, 2, 2, 3, 3], prepared: [4, 5, 6, 7, 9] },
  cleric: {
    kind: "full",
    cantrips: [3, 3, 3, 4, 4],
    prepared: [4, 5, 6, 7, 9],
  },
  druid: { kind: "full", cantrips: [2, 2, 2, 3, 3], prepared: [4, 5, 6, 7, 9] },
  sorcerer: {
    kind: "full",
    cantrips: [4, 4, 4, 5, 5],
    prepared: [2, 4, 6, 7, 9],
  },
  wizard: {
    kind: "full",
    cantrips: [3, 3, 3, 4, 4],
    prepared: [4, 5, 6, 7, 9],
  },
  paladin: {
    kind: "half",
    cantrips: [0, 0, 0, 0, 0],
    prepared: [2, 3, 4, 5, 6],
  },
  ranger: {
    kind: "half",
    cantrips: [0, 0, 0, 0, 0],
    prepared: [2, 3, 4, 5, 6],
  },
  warlock: {
    kind: "pact",
    cantrips: [2, 2, 2, 3, 3],
    prepared: [2, 3, 4, 5, 6],
  },
};

// What each class gains at 2-5. Level 1 stays on the class entry itself.
// A subclass arrives at 3 for every 2024 class, so it is not repeated here.
const LEVEL_FEATURES = {
  barbarian: {
    2: ["Danger Sense", "Reckless Attack"],
    3: ["Primal Knowledge"],
    5: ["Extra Attack", "Fast Movement"],
  },
  bard: {
    2: ["Expertise", "Jack of All Trades"],
    5: ["Font of Inspiration"],
  },
  cleric: { 2: ["Channel Divinity"], 5: ["Sear Undead"] },
  druid: { 2: ["Wild Shape", "Wild Companion"], 5: ["Wild Resurgence"] },
  fighter: {
    2: ["Action Surge", "Tactical Mind"],
    5: ["Extra Attack", "Tactical Shift"],
  },
  monk: {
    2: ["Monk's Focus", "Unarmored Movement", "Uncanny Metabolism"],
    3: ["Deflect Attacks"],
    4: ["Slow Fall"],
    5: ["Extra Attack", "Stunning Strike"],
  },
  paladin: {
    2: ["Fighting Style", "Paladin's Smite"],
    3: ["Channel Divinity"],
    5: ["Extra Attack", "Faithful Steed"],
  },
  ranger: {
    2: ["Deft Explorer", "Fighting Style"],
    5: ["Extra Attack"],
  },
  rogue: {
    2: ["Cunning Action"],
    3: ["Steady Aim"],
    5: ["Cunning Strike", "Uncanny Dodge"],
  },
  sorcerer: { 2: ["Font of Magic", "Metamagic"] },
  warlock: { 2: ["Magical Cunning"] },
  wizard: { 2: ["Scholar"], 5: ["Memorize Spell"] },
};

// The level 4 feat. The panel spends it the way it spends everything
// else -- on what the class wants most -- and says so on the sheet.
const ASI_LEVEL = 4;

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

function buildName(rng, speciesId, flourishId, settingId) {
  const bank = nameBankFor(speciesId, settingId);
  const given = pick(rng, bank.given[0]) + pick(rng, bank.given[1]);
  const family = bank.family[1]
    ? pick(rng, bank.family[0]) + pick(rng, bank.family[1])
    : pick(rng, bank.family[0]);
  const name = given + " " + family;
  const chance = flourishFor(flourishId).chance;
  return rng() < chance
    ? name + ", " + pick(rng, epithetsFor(settingId))
    : name;
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

function attackEntry(name, dice, damageType, abilityMod, notes, proficiency) {
  return {
    name: name,
    bonus: signed(abilityMod + proficiency),
    damage: dice + " " + signed(abilityMod) + " " + damageType,
    notes: notes,
  };
}

function buildAttacks(cls, mods, spellcasting, proficiency) {
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
        proficiency,
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
        proficiency,
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

// The SRD offers a flat GP sum in place of a class's starting equipment
// package; this generator always takes it (see NOTES.md).
const BACKGROUND_GOLD = 50;

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
  items.push(
    background.name +
      " background: " +
      BACKGROUND_GOLD +
      " GP in place of the kit",
  );
  return items;
}

// The species a seed produces, without rolling the rest of the character.
// buildCharacter draws the same value as the first pick off its own
// species stream -- these two have to agree, so they read the same.
function speciesFor(seed, cartridgeId, settingId) {
  return pick(
    makeRng("species/" + seed),
    speciesListFor(cartridgeId, settingId),
  );
}

function buildCharacter(state) {
  const level = Math.max(1, Math.min(MAX_LEVEL, state.level || 1));
  const proficiency = proficiencyBonus(level);
  const setting = settingFor(state.setting);
  const speciesRng = makeRng("species/" + state.seeds.species);
  const speciesList = speciesListFor(state.cartridge, state.setting);
  const classList = classListFor(state.cartridge, state.setting);
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
  const subclass = subclassFor(cls, state.setting);
  const background = pick(backgroundRng, BACKGROUNDS);
  const priority = ABILITY_PRIORITY[cls.id];

  // Where someone is from. Drawn from a stream of its own rather than
  // appended to backgroundRng, which would have shifted the alignment draw
  // that follows it and rewritten every character rolled before this.
  const homeland = setting.regions
    ? pick(
        makeRng("home/" + state.seeds.name + "/" + setting.id),
        setting.regions,
      )
    : null;

  // A held name keeps the species it was named for, so re-rolling species
  // cannot quietly rename a character the panel says is held. The pin
  // rides in the serial (see serialOf), so the link still rebuilds this.
  const namedFor = state.nameSpecies || species.id;
  const nameRng = makeRng("name/" + state.seeds.name + "/" + namedFor);
  const name = buildName(nameRng, namedFor, state.flourish, state.setting);

  const pool = rollAbilityScores(statsRng, state.method);
  const boosted = applyBackgroundBoosts(
    assignScores(pool, priority),
    background,
    priority,
  );
  const scores = boosted.scores;

  // The level 4 feat, spent the way the panel spends everything else: on
  // what the class wants most, capped at 20 like any other increase.
  if (level >= ASI_LEVEL) {
    const first = priority[0];
    scores[first] = Math.min(20, scores[first] + 2);
  }

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
  if (level >= ASI_LEVEL) feats.push("Ability Score Improvement");
  const traits = species.traits.slice();

  if (species.keenSenses) {
    const sense = pick(speciesRng, species.keenSenses);
    traits.push(
      (species.keenSenseLabel || "Keen Senses") + " — proficiency in " + sense,
    );
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

  let maxHp = hitPointsFor(cls, mods.con, level);
  if (species.hpPerLevel) maxHp += species.hpPerLevel * level;
  if (feats.indexOf("Tough") !== -1) maxHp += level * 2;

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
  const initiative = mods.dex + (hasAlert ? proficiency : 0);

  let spellcasting = null;
  if (cls.casting) {
    const list = SPELL_LISTS[cls.id];
    const spellRng = makeRng("spells/" + state.seeds.class + "/" + cls.id);
    const ability = cls.casting.ability;
    const track = CASTER_PROGRESSION[cls.id];
    const row = level - 1;

    // Spell lists only go to first level, so higher slots are reported
    // as slots and the prepared list stays first-level. Said out loud on
    // the sheet rather than quietly padded with spells we don't have.
    const pact = track.kind === "pact" ? PACT_MAGIC[row] : null;
    const slots = pact ? null : SPELL_SLOTS[track.kind][row];

    spellcasting = {
      label: cls.casting.label || "Spellcasting",
      ability: ability,
      mod: signed(mods[ability]),
      dc: 8 + proficiency + mods[ability],
      attack: signed(proficiency + mods[ability]),
      slots: pact ? pact.slots : slots[0],
      slotTable: pact
        ? pact.slots + " × level " + pact.level
        : slots
            .map((count, index) => count + " × level " + (index + 1))
            .join(", "),
      cantrips: pickMany(spellRng, list.cantrips, track.cantrips[row]),
      prepared: pickMany(spellRng, list.first, track.prepared[row]),
      book: cls.casting.book || null,
    };
    if (cls.id === "ranger") spellcasting.prepared.unshift("Hunter's Mark");
  }

  // Everything the class picks up between 2 and this level, in order.
  const gained = [];
  const table = LEVEL_FEATURES[cls.id] || {};
  for (let step = 2; step <= level; step += 1) {
    // Every 2024 class takes its subclass at 3.
    if (step === 3) gained.push("Subclass: " + subclass);
    (table[step] || []).forEach((feature) => gained.push(feature));
  }

  return {
    name: name,
    level: level,
    proficiency: proficiency,
    levelFeatures: gained,
    alignment: pick(backgroundRng, ALIGNMENTS),
    species: species,
    lineage: lineage,
    size: size,
    speed: speed,
    cls: cls,
    subclass: subclass,
    setting: setting,
    homeland: homeland,
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
    attacks: buildAttacks(cls, mods, spellcasting, proficiency),
    equipment: buildEquipment(cls, background),
    gold: cls.kit.gp + BACKGROUND_GOLD,
    heroicInspiration: species.id === "human",
  };
}
