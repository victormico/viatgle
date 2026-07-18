// Minimal i18n: translations inline (no extra request), Catalan default.
// The language is picked from localStorage ("viatgle-lang"), then the
// browser language, then Catalan.
const TRANSLATIONS = {
  ca: {
    title: "Avui m'agradaria anar {from} {to}.",
    input_placeholder: "Escriu una comarca...",
    guess_button: "Endevina ({n}/{max})",
    hint_button_title: "Fes servir una pista (costa una tirada)",
    share_button: "📋 Comparteix el resultat",
    invalid_comarca: "Aquesta comarca no existeix!",
    already_guessed: "Ja l'has dita!",
    endpoint_guess: "Aquest és el punt de sortida o d'arribada!",
    won: "Has guanyat! Enhorabona!",
    lost: "Has perdut! Torna-ho a provar demà.",
    out_of_guesses: "T'has quedat sense tirades! Torna demà.",
    copied: "Resultat copiat al porta-retalls!",
    hint_next_outline: "Contorn de la comarca següent",
    hint_all_outlines: "Contorn de les comarques del camí",
    hint_initials: "Inicials de les comarques del camí",
    zoom_in: "Amplia",
    zoom_out: "Redueix",
    zoom_reset: "Restableix el zoom",
    stats_title: "Estadístiques",
    stat_played: "Jugades",
    stat_win_pct: "% victòries",
    stat_streak: "Ratxa",
    stat_max_streak: "Ratxa màx.",
    dist_title: "Tirades de més",
    next_game: "Següent viatgle en",
    prev_game: "Joc anterior",
    next_game_nav: "Joc següent",
    toggle_theme: "Canvia el tema"
  },
  es: {
    title: "Hoy me gustaría ir {from} {to}.",
    input_placeholder: "Escribe una comarca...",
    guess_button: "Adivina ({n}/{max})",
    hint_button_title: "Usa una pista (cuesta un intento)",
    share_button: "📋 Comparte el resultado",
    invalid_comarca: "¡Esta comarca no existe!",
    already_guessed: "¡Ya la has dicho!",
    endpoint_guess: "¡Ese es el punto de salida o llegada!",
    won: "¡Has ganado! ¡Enhorabuena!",
    lost: "¡Has perdido! Vuelve a intentarlo mañana.",
    out_of_guesses: "¡Te has quedado sin intentos! Vuelve mañana.",
    copied: "¡Resultado copiado al portapapeles!",
    hint_next_outline: "Contorno de la siguiente comarca",
    hint_all_outlines: "Contorno de las comarcas del camino",
    hint_initials: "Iniciales de las comarcas del camino",
    zoom_in: "Ampliar",
    zoom_out: "Reducir",
    zoom_reset: "Restablecer el zoom",
    stats_title: "Estadísticas",
    stat_played: "Jugadas",
    stat_win_pct: "% victorias",
    stat_streak: "Racha",
    stat_max_streak: "Racha máx.",
    dist_title: "Intentos de más",
    next_game: "Siguiente viatgle en",
    prev_game: "Juego anterior",
    next_game_nav: "Juego siguiente",
    toggle_theme: "Cambiar el tema"
  },
  en: {
    title: "Today I'd like to go {from} {to}.",
    input_placeholder: "Enter a comarca...",
    guess_button: "Guess ({n}/{max})",
    hint_button_title: "Use a hint (costs one guess)",
    share_button: "📋 Share result",
    invalid_comarca: "Invalid comarca!",
    already_guessed: "Already guessed!",
    endpoint_guess: "That's the start or end!",
    won: "You won! Congratulations!",
    lost: "You lost! Try again tomorrow.",
    out_of_guesses: "Out of guesses! Try again tomorrow.",
    copied: "Result copied to clipboard!",
    hint_next_outline: "Next comarca outlined",
    hint_all_outlines: "Path comarques outlined",
    hint_initials: "Path initials shown",
    zoom_in: "Zoom in",
    zoom_out: "Zoom out",
    zoom_reset: "Reset zoom",
    stats_title: "Statistics",
    stat_played: "Played",
    stat_win_pct: "Win %",
    stat_streak: "Streak",
    stat_max_streak: "Max streak",
    dist_title: "Extra guesses",
    next_game: "Next viatgle in",
    prev_game: "Previous game",
    next_game_nav: "Next game",
    toggle_theme: "Toggle theme"
  }
};

const LANG_KEY = "viatgle-lang";

function detectLanguage() {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && TRANSLATIONS[saved]) {
    return saved;
  }
  const browserLang = (navigator.language || "ca").slice(0, 2).toLowerCase();
  return TRANSLATIONS[browserLang] ? browserLang : "ca";
}

const currentLang = detectLanguage();

function t(key, params = {}) {
  let text = TRANSLATIONS[currentLang][key] || TRANSLATIONS.ca[key] || key;
  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{${name}}`, value);
  }
  return text;
}

// Grammatical article of each comarca, so the title reads
// "de la Costera al Camp de Túria" rather than "de Costera a Camp de Túria".
// Token: m = el/l' · f = la/l' · mp = els · fp = les · "" = no article
// (islands, countries and a few others). Same gender drives Catalan and
// Spanish; English ignores it (proper nouns take no article).
const COMARCA_ARTICLES = {
  alacanti: "m", alcalaten: "m", alcoia: "m", alt_camp: "m", alt_emporda: "m",
  alt_maestrat: "m", alt_millars: "m", alt_palancia: "m", alt_penedes: "m",
  alt_urgell: "m", alt_vinalopo: "m", alta_cerdanya: "f", alta_ribagorca: "f",
  andorra: "", anoia: "f", bages: "m", baix_camp: "m", baix_cinca: "m",
  baix_ebre: "m", baix_emporda: "m", baix_llobregat: "m", baix_maestrat: "m",
  baix_penedes: "m", baix_segura: "m", baix_vinalopo: "m", barcelones: "m",
  bergueda: "m", camp_de_morvedre: "m", camp_de_turia: "m", canal_de_navarres: "f",
  capcir: "m", carxe: "m", cerdanya: "f", comtat: "m", conca_de_barbera: "f",
  conflent: "m", costera: "f", eivissa: "", fenolleda: "f", foia_de_bunyol: "f",
  formentera: "", garraf: "m", garrigues: "fp", garrotxa: "f", girones: "m",
  horta: "f", l_alguer: "", llitera: "f", mallorca_occidental: "",
  mallorca_oriental: "", mallorca_septentrional: "", maresme: "m", marina_alta: "f",
  marina_baixa: "f", matarranya: "m", menorca: "", moianes: "m", montsia: "m",
  noguera: "f", osona: "", pallars_jussa: "m", pallars_sobira: "m", pla_d_urgell: "m",
  pla_de_l_estany: "m", plana_alta: "f", plana_baixa: "f", plana_d_utiel_requena: "f",
  ports: "mp", priorat: "m", raco_d_ademus: "m", ribagorca: "f", ribera_alta: "f",
  ribera_baixa: "f", ribera_d_ebre: "f", ripolles: "m", rossello: "m", safor: "f",
  segarra: "f", segria: "m", selva: "f", serrans: "f", solsones: "m",
  tarragones: "m", terra_alta: "f", urgell: "m", vall_d_albaida: "f", vall_d_aran: "f",
  vall_de_cofrents_aiora: "f", vallespir: "m", valls_del_vinalopo: "fp",
  valles_occidental: "m", valles_oriental: "m", vinalopo_mitja: "m"
};

function comarcaArticle(id) {
  return COMARCA_ARTICLES[id] || "";
}

function startsWithVowel(name) {
  return /^[aeiouhàèéíïòóúü]/i.test(name);
}

// The prefix that precedes the comarca name for a given preposition
// ("de" or "a") in the active language, e.g. "de la ", "al ", "de l'",
// "from ". Elision (l') abuts the name; other forms end with a space.
function articlePrefix(prep, id, name) {
  const article = comarcaArticle(id);
  const vowel = startsWithVowel(name);

  if (currentLang === "en") {
    return prep === "de" ? "from " : "to ";
  }

  if (currentLang === "es") {
    if (prep === "de") {
      return { m: "del ", f: "de la ", mp: "de los ", fp: "de las " }[article] || "de ";
    }
    return { m: "al ", f: "a la ", mp: "a los ", fp: "a las " }[article] || "a ";
  }

  // Catalan
  if (prep === "de") {
    if (article === "m") return vowel ? "de l'" : "del ";
    if (article === "f") return vowel ? "de l'" : "de la ";
    if (article === "mp") return "dels ";
    if (article === "fp") return "de les ";
    return vowel ? "d'" : "de ";
  }
  if (article === "m") return vowel ? "a l'" : "al ";
  if (article === "f") return vowel ? "a l'" : "a la ";
  if (article === "mp") return "als ";
  if (article === "fp") return "a les ";
  return "a "; // Catalan "a" does not elide before a vowel
}
