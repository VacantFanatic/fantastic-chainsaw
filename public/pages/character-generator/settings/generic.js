// CG-20 setting: the whole book, no world attached. This is DEFAULT_SETTING_ID and must exist -- settingFor() falls back to it.
//
// Registers itself into SETTINGS (declared in character-generator-data.js,
// which must load first) -- see the comment above that array for the
// registration pattern.

SETTINGS.push({
  id: "generic",
  name: "Generic",
  code: "G",
  label: "generic",
  note: "the whole book, no world attached.",
});
