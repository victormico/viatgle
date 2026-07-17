// Minimal i18n: translations inline (no extra request), Catalan default.
// The language is picked from localStorage ("viatgle-lang"), then the
// browser language, then Catalan.
const TRANSLATIONS = {
  ca: {
    title: "Avui m'agradaria anar {de_start} a {end}.",
    input_placeholder: "Escriu una comarca...",
    guess_button: "Endevina ({n}/{max})",
    hint_button_title: "Fes servir una pista (costa una tirada)",
    share_button: "📋 Comparteix el resultat",
    invalid_comarca: "Aquesta comarca no existeix!",
    already_guessed: "Ja l'has dita!",
    won: "Has guanyat! Enhorabona!",
    lost: "Has perdut! Torna-ho a provar demà.",
    out_of_guesses: "T'has quedat sense tirades! Torna demà.",
    copied: "Resultat copiat al porta-retalls!",
    hint_next_outline: "Contorn de la comarca següent",
    hint_all_outlines: "Contorn de les comarques del camí",
    hint_initials: "Inicials de les comarques del camí",
    zoom_in: "Amplia",
    zoom_out: "Redueix",
    zoom_reset: "Restableix el zoom"
  },
  es: {
    title: "Hoy me gustaría ir de {start} a {end}.",
    input_placeholder: "Escribe una comarca...",
    guess_button: "Adivina ({n}/{max})",
    hint_button_title: "Usa una pista (cuesta un intento)",
    share_button: "📋 Comparte el resultado",
    invalid_comarca: "¡Esta comarca no existe!",
    already_guessed: "¡Ya la has dicho!",
    won: "¡Has ganado! ¡Enhorabuena!",
    lost: "¡Has perdido! Vuelve a intentarlo mañana.",
    out_of_guesses: "¡Te has quedado sin intentos! Vuelve mañana.",
    copied: "¡Resultado copiado al portapapeles!",
    hint_next_outline: "Contorno de la siguiente comarca",
    hint_all_outlines: "Contorno de las comarcas del camino",
    hint_initials: "Iniciales de las comarcas del camino",
    zoom_in: "Ampliar",
    zoom_out: "Reducir",
    zoom_reset: "Restablecer el zoom"
  },
  en: {
    title: "Today I'd like to go from {start} to {end}.",
    input_placeholder: "Enter a comarca...",
    guess_button: "Guess ({n}/{max})",
    hint_button_title: "Use a hint (costs one guess)",
    share_button: "📋 Share result",
    invalid_comarca: "Invalid comarca!",
    already_guessed: "Already guessed!",
    won: "You won! Congratulations!",
    lost: "You lost! Try again tomorrow.",
    out_of_guesses: "Out of guesses! Try again tomorrow.",
    copied: "Result copied to clipboard!",
    hint_next_outline: "Next comarca outlined",
    hint_all_outlines: "Path comarques outlined",
    hint_initials: "Path initials shown",
    zoom_in: "Zoom in",
    zoom_out: "Zoom out",
    zoom_reset: "Reset zoom"
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

// Catalan elides "de" before a vowel or h: "d'Osona", "de Garrotxa"
function caDeParticle(name) {
  return /^[aeiouhàèéíòóú]/i.test(name) ? "d'" : "de ";
}
