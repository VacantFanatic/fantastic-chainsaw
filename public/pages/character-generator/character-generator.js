// CG–20 — a levels 1-5 D&D character generator, wired to a fake front panel.
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
//
// This file: rendering, panel state, the serial format, and the UI wiring
// (knobs, dials, MIDI, transport). It runs last, after
// character-generator-data.js, character-generator-engine.js, and
// character-generator-export.js have all loaded -- init(), at the bottom,
// depends on all three.

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

function status(message) {
  setText("lcd-status", message);
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
  setLamp("setting", setting.id !== DEFAULT_SETTING_ID);
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

// The bar meter's scale: an ability score of ABILITY_BAR_MIN sits at the
// empty end, ABILITY_BAR_MIN + ABILITY_BAR_RANGE at the full end. The
// shuffle animation's noise (in commit()) draws from the same range so the
// bars read as plausible scores while they're still searching.
const ABILITY_BAR_MIN = 6;
const ABILITY_BAR_RANGE = 14;

function setBars(values) {
  ABILITIES.forEach((ability) => {
    const bar = document.querySelector('[data-bar="' + ability + '"]');
    if (!bar) return;
    const level = Math.max(
      0,
      Math.min(1, (values[ability] - ABILITY_BAR_MIN) / ABILITY_BAR_RANGE),
    );
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
      character.mods[ability] + (proficient ? character.proficiency : 0);

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
  setText("spell-slots", casting.slotTable);
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
    character.species.name +
      " " +
      character.cls.name +
      " · level " +
      character.level,
  );
  setBars(character.scores);
}

function render(character) {
  setText("sheet-name", character.name);
  setText("sheet-class", character.cls.name);
  setText("sheet-subclass", character.subclass);
  setText(
    "sheet-species",
    character.lineage
      ? character.species.name + " (" + character.lineage.name + ")"
      : character.species.name,
  );
  setText("sheet-background", character.background.name);
  setText("sheet-alignment", character.alignment);
  setText("sheet-setting", character.setting.name);
  setText("sheet-homeland", character.homeland || "—");
  setText("sheet-level", String(character.level));

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
  setText("prof-bonus", signed(character.proficiency));
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
    character.cls.features.concat(character.levelFeatures),
  );
  fillList("species-traits", character.traits);
  fillList("feats", character.feats);
  fillList("equipment", character.equipment);

  renderSpells(character);

  renderDisplay(character);

  setText(
    "announce",
    character.name +
      ", a level " +
      character.level +
      " " +
      character.species.name +
      " " +
      character.cls.name +
      ", " +
      character.background.name +
      " background" +
      (character.setting.id === "generic"
        ? ""
        : ", " +
          character.setting.name +
          (character.homeland ? ", from " + character.homeland : "")) +
      ". Sheet updated.",
  );
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
  level: 1,
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
  if (setting.id !== DEFAULT_SETTING_ID) groups.push(setting.code);

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

  // Level 1 writes nothing, so every serial minted before the knob
  // existed still spells the same character.
  if (current.level > 1) groups.push("L" + current.level);

  const pinned = current.nameSpecies;
  if (
    pinned &&
    pinned !==
      speciesFor(current.seeds.species, current.cartridge, current.setting).id
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
  L: {
    key: "level",
    read: (value) => (value >= 1 && value <= MAX_LEVEL ? value : null),
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
    level: 1,
  };
  const seen = {};

  while (groups.length) {
    const match = /^([PXNFL])(\d{1,2})$/.exec(groups[groups.length - 1]);
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

  let setting = DEFAULT_SETTING_ID;
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
    level: tail.level,
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

// The "searching" shuffle in commit(): how long the name/build readouts
// scramble for, and how fast.
const SHUFFLE_NAME_LENGTH = 14;
const SHUFFLE_BUILD_LENGTH = 22;
const SHUFFLE_TICK_COUNT = 9;
const SHUFFLE_TICK_MS = 55;

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
    setText("lcd-name", scramble(SHUFFLE_NAME_LENGTH));
    setText("lcd-build", scramble(SHUFFLE_BUILD_LENGTH));
    const noise = {};
    ABILITIES.forEach((ability) => {
      noise[ability] =
        ABILITY_BAR_MIN + Math.floor(Math.random() * ABILITY_BAR_RANGE);
    });
    setBars(noise);

    ticks += 1;
    if (ticks >= SHUFFLE_TICK_COUNT) {
      window.clearInterval(shuffleTimer);
      panel.classList.remove("is-busy");
      render(character);
    }
  }, SHUFFLE_TICK_MS);
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
    state.nameSpecies = speciesFor(
      state.seeds.species,
      state.cartridge,
      state.setting,
    ).id;
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
    level: current.level,
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

// Pointer angle measured from a knob's centre: 0 at the top, positive
// clockwise, which is the same convention as the CSS rotation. Takes the
// knob's rect rather than the knob itself so a drag can measure it once
// on pointerdown instead of forcing a layout read on every pointermove.
function pointerAngle(box, event) {
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
  let dragRect = null;

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
    // Measured once per drag rather than on every pointermove -- the knob
    // doesn't move or resize mid-drag, so there's nothing to re-measure.
    dragRect = knob.getBoundingClientRect();
    capture(event, true);
    event.preventDefault();
  });

  knob.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const count = knobRadios(group).length;
    const angle = pointerAngle(dragRect, event);
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
    let dragRect = null;

    knob.addEventListener("pointerdown", (event) => {
      dragging = true;
      moved = false;
      // Measured once per drag rather than on every pointermove -- the knob
      // doesn't move or resize mid-drag, so there's nothing to re-measure.
      dragRect = knob.getBoundingClientRect();
      last = pointerAngle(dragRect, event);
      try {
        knob.setPointerCapture(event.pointerId);
      } catch (error) {
        // No live pointer for this id; the drag still works without it.
      }
    });

    knob.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const angle = pointerAngle(dragRect, event);
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

function wireLevel() {
  document.querySelectorAll('[name="level"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.level = Number(radio.value);
      syncKnob("level");
      setText("level-readout", String(state.level));
      status("level " + state.level);
      // A level changes hit points, proficiency and half the sheet, so
      // this is a new character even though no seed moved.
      commit(true);
    });
  });

  wireKnob("level");
  syncKnob("level");
  setText("level-readout", String(state.level));
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
      status(settingFor(state.setting).note);
      // The setting reaches buildCharacter now, so the sheet below really
      // is a different character and the "searching" animation is telling
      // the truth about it.
      commit(true);
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
  wireLevel();
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
  state.level = parsed.level;
  state.party = parsed.party;
  state.nameSpecies = parsed.nameSpecies;

  clearPatches();

  const size = byId("party-size");
  if (size) size.value = String(state.party);
  const readout = byId("party-readout");
  if (readout) {
    readout.textContent = state.party > 1 ? "party of " + state.party : "solo";
  }
  setText("level-readout", String(state.level));

  [
    ["method", state.method],
    ["setting", state.setting],
    ["cartridge", state.cartridge],
    ["flourish", state.flourish],
    ["level", String(state.level)],
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
