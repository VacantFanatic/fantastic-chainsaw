// CG-20 export: the sheet as plain text, a hand-rolled PDF, and JSON.
//
// See character-generator.js for an overview of the whole machine, and
// character-generator-engine.js for buildCharacter(), which every export
// here starts from.

// "Level 3 Elf (High Elf) Wizard — Order of Scribes" — shared by the plain
// text export and the PDF header, which print it identically.
function buildLine(character) {
  return (
    "Level " +
    character.level +
    " " +
    character.species.name +
    (character.lineage ? " (" + character.lineage.name + ")" : "") +
    " " +
    character.cls.name +
    " — " +
    character.subclass
  );
}

function asPlainText(character) {
  const lines = [];
  const rule = "----------------------------------------";

  lines.push(character.name);
  lines.push(buildLine(character));
  lines.push(
    "Background: " +
      character.background.name +
      " · Alignment: " +
      character.alignment,
  );
  if (character.setting.id !== "generic") {
    lines.push(
      "Setting: " +
        character.setting.name +
        (character.homeland ? " · From: " + character.homeland : ""),
    );
  }
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
      signed(character.proficiency),
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
   Export -- copy as text, PDF, and JSON

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
  pdfWrite(doc, buildLine(character), x, doc.y, { size: 10 });

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

  if (character.setting.id !== "generic") {
    doc.y -= 10;
    pdfWrite(
      doc,
      character.setting.name +
        (character.homeland ? " · " + character.homeland : ""),
      x,
      doc.y,
      { size: 8.6, gray: 0.35 },
    );
  }

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
    (proficient ? character.proficiency : 0) +
    (expert ? character.proficiency : 0)
  );
}

function passiveScore(character, skillId) {
  return (
    10 +
    skillBonus(
      character,
      SKILLS.find((skill) => skill.id === skillId),
    )
  );
}

function abilitiesSection(character) {
  const section = { title: "ability scores", rows: [] };
  ABILITIES.forEach((ability) => {
    section.rows.push({
      label: ABILITY_NAMES[ability],
      value: character.scores[ability] + "  " + signed(character.mods[ability]),
      bold: true,
    });

    const proficientSave = character.cls.saves.indexOf(ability) !== -1;
    section.rows.push({
      label: "saving throw",
      value: signed(
        character.mods[ability] + (proficientSave ? character.proficiency : 0),
      ),
      indent: 12,
      mark: proficientSave,
      faint: !proficientSave,
    });

    SKILLS.filter((skill) => skill.ability === ability).forEach((skill) => {
      const trained =
        character.skills.indexOf(skill.name) !== -1 ||
        character.expertise.indexOf(skill.name) !== -1;
      section.rows.push({
        label: skill.name,
        value: signed(skillBonus(character, skill)),
        indent: 12,
        mark: trained,
        faint: !trained,
      });
    });
  });
  return section;
}

function combatSection(character) {
  return {
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
      { label: "proficiency bonus", value: signed(character.proficiency) },
      {
        label: "passive perception",
        value: passiveScore(character, "perception"),
      },
      { label: "passive insight", value: passiveScore(character, "insight") },
      {
        label: "passive investigation",
        value: passiveScore(character, "investigation"),
      },
      {
        label: "heroic inspiration",
        value: character.heroicInspiration ? "yes" : "no",
      },
    ],
  };
}

function attacksSection(character) {
  return {
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
  };
}

function featuresSection(character) {
  return {
    title: "features & traits",
    rows: character.cls.features
      .concat("Subclass: " + character.subclass)
      .concat(character.traits)
      .concat(character.feats)
      .map((entry) => ({ label: entry })),
  };
}

function trainingSection(character) {
  return {
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
  };
}

function equipmentSection(character) {
  return {
    title: "equipment",
    rows: character.equipment
      .map((item) => ({ label: item }))
      .concat([{ label: "coin", value: character.gold + " GP", bold: true }]),
  };
}

function spellcastingSection(character) {
  if (!character.spellcasting) return null;
  const casting = character.spellcasting;
  return {
    title: casting.label,
    rows: [
      { label: "spellcasting ability", value: ABILITY_NAMES[casting.ability] },
      { label: "spell save DC", value: casting.dc },
      { label: "spell attack", value: casting.attack },
      { label: "spell slots", value: casting.slotTable },
      { label: "cantrips", bold: true },
      {
        label: casting.cantrips.length ? casting.cantrips.join(", ") : "none",
        indent: 12,
      },
      { label: "prepared", bold: true },
      { label: casting.prepared.join(", "), indent: 12 },
    ],
  };
}

// The same sheet the page shows, as data: one list of sections, each a
// list of rows. The layout above knows nothing about D&D, and this knows
// nothing about points and columns.
function sheetSections(character) {
  return [
    abilitiesSection(character),
    combatSection(character),
    attacksSection(character),
    featuresSection(character),
    trainingSection(character),
    equipmentSection(character),
    spellcastingSection(character),
  ].filter(Boolean);
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
      save: character.mods[ability] + (proficient ? character.proficiency : 0),
      proficientSave: proficient,
      backgroundBoost: character.boosts[ability] || 0,
    };
  });

  return {
    serial: serial,
    generator: "cg-20",
    rules: "SRD 5.2.1, © Wizards of the Coast LLC, CC BY 4.0",
    name: character.name,
    level: character.level,
    alignment: character.alignment,
    species: {
      name: character.species.name,
      lineage: character.lineage ? character.lineage.name : null,
      size: character.size,
      speed: character.speed,
    },
    class: {
      name: character.cls.name,
      subclass: character.subclass,
      hitDie: "1d" + character.cls.hitDie,
    },
    background: {
      name: character.background.name,
      tool: character.background.tool,
    },
    setting: {
      name: character.setting.name,
      homeland: character.homeland,
    },
    proficiencyBonus: character.proficiency,
    abilities: abilities,
    combat: {
      armorClass: character.armorClass,
      hitPoints: character.maxHp,
      initiative: character.initiative,
      heroicInspiration: character.heroicInspiration,
      passivePerception: passiveScore(character, "perception"),
      passiveInsight: passiveScore(character, "insight"),
      passiveInvestigation: passiveScore(character, "investigation"),
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
      class: character.cls.features.concat("Subclass: " + character.subclass),
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
