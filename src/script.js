let adjacencyMap = {}; // Store the adjacency map for the comarques
let game_state = {}; // Initialize game state
let panzoom = null; // Pan/zoom API for the map
let focusRegion = null; // Padded bbox framing the start and end comarques

const maxIncorrectGuesses = 5;
const STORAGE_KEY = "viatgle-progress";
const STATS_KEY = "viatgle-stats";
const THEME_KEY = "viatgle-theme";
const GAME_URL = "https://victormico.github.io/viatgle";

// ---- Light / dark theme (#42) ----

// The active theme: an explicit choice if stored, otherwise the system
// preference. A tiny script in <head> applies the stored choice before
// first paint to avoid a flash.
function effectiveTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeIcon(theme) {
  // Show the icon of the mode the button switches TO
  document.getElementById("btn-theme").textContent = theme === "dark" ? "☀️" : "🌙";
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeIcon(theme);
  applyMapTheme();
}

function setupTheme() {
  updateThemeIcon(effectiveTheme());
  document.getElementById("btn-theme").addEventListener("click", () => {
    setTheme(effectiveTheme() === "dark" ? "light" : "dark");
  });
  // Follow the system while the player hasn't made an explicit choice
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      updateThemeIcon(e.matches ? "dark" : "light");
      applyMapTheme();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();
  setupTheme();
  // Load the map
  fetch("master.svg")
    .then(response => response.text())
    .then(svgContent => {
      document.getElementById("map-container").innerHTML = svgContent;
      initializeGame();
    })
    .catch(err => console.error("Error loading SVG:", err));
});

async function initializeGame() {
  // Set the start date (local midnight, so the puzzle changes at the
  // player's local midnight regardless of timezone)
  const startDate = new Date(2024, 11, 16);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Calculate the difference in days (rounded to absorb DST shifts)
  const diffDays = Math.round((today - startDate) / (1000 * 60 * 60 * 24));
  const todayNumber = diffDays + 1; // games are 1-indexed for players

  // Load the precomputed pairs
  const responsePairs = await fetch("pairs.json");
  const pairs = await responsePairs.json();
  const pairCount = Object.keys(pairs).length;

  // A game number may come from the URL (/viatgle/{id}). Clamp to
  // [1, today] so future games can never be reached (#35).
  const route = readGameRoute();
  const gameNumber = route.id || todayNumber;
  if (gameNumber < 1 || gameNumber > todayNumber) {
    window.location.replace(gameUrl(todayNumber, todayNumber, route.base));
    return;
  }
  const dayIndex = gameNumber - 1;
  const pair = pairs[dayIndex % pairCount];

  // Load the all_shortest_paths.json
  const responsePaths = await fetch("all_shortest_paths.json");
  const allShortestPaths = await responsePaths.json();

  const shortestPaths = allShortestPaths[pair.start][pair.end];

  // Remove start and end comarca from each shortest path
  for (let path of shortestPaths) {
    if (path[0] === pair.start) {
      path.shift(); // Remove start comarca
    }
    if (path[path.length - 1] === pair.end) {
      path.pop(); // Remove end comarca
    }
  }

  const response = await fetch("comarques_limitrofes.json");
  adjacencyMap = await response.json();

  // Initialize game state
  game_state = {
    day: dayIndex,
    number: gameNumber,
    today_number: todayNumber,
    is_today: gameNumber === todayNumber,
    base: route.base,
    start: pair.start,
    end: pair.end,
    shortests_paths: shortestPaths,
    original_paths: shortestPaths.map(path => [...path]),
    shortest_path_length: shortestPaths[0].length,
    max_guesses: shortestPaths[0].length + maxIncorrectGuesses,
    guessed_ids: [],
    guesses_status: [],
    events: [],
    incorrect_guesses: 0,
    hints_used: 0,
    game_running: true,
    guesses_icons: {
      optimal: "✅",
      good: "🟩",
      pretty_good: "🟧",
      bad: "🟥"
    }
  };

  const svgElement = document.querySelector("svg");
  svgElement.querySelectorAll("g").forEach(group => {
    if (group.id === game_state.start) {
      setSvgFill(group, getComputedStyle(document.documentElement).getPropertyValue('--start-color'));
      addPinHalo(group, "--start-color");
    } else if (group.id === game_state.end) {
      setSvgFill(group, getComputedStyle(document.documentElement).getPropertyValue('--end-color'));
      addPinHalo(group, "--end-color");
    } else {
      ghostComarca(group);
    }
  });
  document.getElementById("map-container").classList.add("ready");

  populateDropdown(svgElement);
  panzoom = initPanZoom(svgElement, document.getElementById("map-container"));
  focusRegion = endpointsRegion(svgElement);
  focusMap();
  setupKeyboardHandling();
  setGameTitle(getComarcaName(game_state.start, svgElement), getComarcaName(game_state.end, svgElement));
  setupGameNav();

  restoreProgress(svgElement);
  updateGuessButton();
  updateHintButton();
  renderJourney();
}

// The start and end can be small and far apart; frame them (with generous
// surrounding context) instead of showing the whole map, which matters most
// on phones (#42 mobile pass)
function endpointsRegion(svgElement) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  [game_state.start, game_state.end].forEach(id => {
    comarcaShapes(svgElement.querySelector(`g#${id}`)).forEach(shape => {
      const b = shape.getBBox();
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.width);
      y1 = Math.max(y1, b.y + b.height);
    });
  });
  const w = x1 - x0;
  const h = y1 - y0;
  const margin = Math.max(w, h) * 0.7; // show neighbouring comarques too
  return { x: x0 - margin, y: y0 - margin, w: w + margin * 2, h: h + margin * 2 };
}

function focusMap() {
  if (panzoom && focusRegion) {
    panzoom.fit(focusRegion.x, focusRegion.y, focusRegion.w, focusRegion.h);
  }
}

// On phones the on-screen keyboard covers most of the map. Shrinking it
// (via a body class) keeps the framed endpoints visible above the keyboard,
// and we re-fit after the layout settles so nothing is cut off.
function setupKeyboardHandling() {
  const input = document.getElementById("comarques-input");
  input.addEventListener("focus", () => {
    document.body.classList.add("input-focused");
    setTimeout(focusMap, 300);
  });
  input.addEventListener("blur", () => {
    document.body.classList.remove("input-focused");
    setTimeout(focusMap, 300);
  });
}

// ---- Previous-game navigation (#35) ----

// Read a game number from the path (/viatgle/{id}); returns the number
// (or null) and the base path to build sibling URLs from.
function readGameRoute() {
  const match = window.location.pathname.match(/\/(\d+)\/?$/);
  if (match) {
    return { id: parseInt(match[1], 10), base: window.location.pathname.slice(0, match.index + 1) };
  }
  let base = window.location.pathname;
  if (!base.endsWith("/")) {
    base += "/";
  }
  return { id: null, base: base };
}

// Today's game lives at the clean base URL; past games at base + number.
function gameUrl(number, todayNumber, base) {
  return number >= todayNumber ? base : base + number;
}

function setupGameNav() {
  const prev = document.getElementById("btn-prev");
  const next = document.getElementById("btn-next");
  document.getElementById("game-number").textContent = "#" + game_state.number;
  prev.hidden = game_state.number <= 1;
  next.hidden = game_state.number >= game_state.today_number;
  prev.onclick = () => {
    window.location.href = gameUrl(game_state.number - 1, game_state.today_number, game_state.base);
  };
  next.onclick = () => {
    window.location.href = gameUrl(game_state.number + 1, game_state.today_number, game_state.base);
  };
}

// The itinerary strip: how many steps of the shortest route are done.
// Progress follows the most advanced remaining path, since any of them
// can become the winning one.
function renderJourney() {
  const total = game_state.shortest_path_length;
  const done = total - Math.min(...game_state.shortests_paths.map(path => path.length));
  let html = '<span class="journey-node journey-start"></span>';
  for (let i = 0; i < total; i++) {
    html += `<span class="journey-step${i < done ? " done" : ""}"></span>`;
  }
  html += '<span class="journey-node journey-end"></span>';
  document.getElementById("journey").innerHTML = html;
}

// Progress is keyed per day so playing a previous game doesn't clobber
// today's (#35)
function progressKey() {
  return STORAGE_KEY + "-" + game_state.day;
}

function saveProgress() {
  try {
    localStorage.setItem(progressKey(), JSON.stringify({
      day: game_state.day,
      events: game_state.events
    }));
  } catch (err) {
    // Storage unavailable (private mode, quota); the game still works, it
    // just won't survive a reload
  }
}

function restoreProgress(svgElement) {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(progressKey()));
    // Migrate the old single-key format (only ever held today's game)
    if (!saved) {
      const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (legacy && legacy.day === game_state.day) {
        saved = legacy;
      }
    }
  } catch (err) {
    return;
  }
  if (!saved || saved.day !== game_state.day) {
    return;
  }
  // Older saves stored a plain list of guessed ids; convert to events
  const events = Array.isArray(saved.events)
    ? saved.events
    : Array.isArray(saved.guessed_ids)
      ? saved.guessed_ids.map(id => ({ t: "g", id: id }))
      : null;
  if (!events) {
    return;
  }
  for (const event of events) {
    if (!game_state.game_running) {
      break;
    }
    if (event.t === "h") {
      applyHint(false);
    } else if (event.t === "g" && /^[a-z_]+$/.test(event.id)) {
      const comarca = svgElement.querySelector(`g#${event.id}`);
      if (comarca) {
        applyGuess(comarca, false);
      }
    }
  }
}

// Accent-insensitive comparison: "emporda" must match "Empordà"
function normalizeText(text) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const MAX_SUGGESTIONS = 8;

function populateDropdown(svgElement) {
  const dropdown = document.getElementById("autocomplete-list");
  const input = document.getElementById("comarques-input");
  // The start and end are already shown on the map, so they must not be
  // offered as guesses (issue #36)
  const comarques = Array.from(svgElement.querySelectorAll("g"))
    .filter(group => group.id !== game_state.start && group.id !== game_state.end)
    .map(group => ({
      id: group.id,
      name: group.getAttribute("data-comarca"),
      normalized: normalizeText(group.getAttribute("data-comarca")),
    }));
  let activeIndex = -1;

  function renderSuggestions() {
    const query = normalizeText(input.value.trim());
    activeIndex = -1;
    if (!query) {
      dropdown.innerHTML = "";
      return;
    }
    dropdown.innerHTML = comarques
      .filter(c => c.normalized.includes(query))
      .slice(0, MAX_SUGGESTIONS)
      .map(c => `<button type="button" class="dropdown-item" data-id="${c.id}">${c.name}</button>`)
      .join("");
  }

  input.addEventListener("input", renderSuggestions);

  // One delegated listener instead of re-binding on every keystroke
  dropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".dropdown-item");
    if (item) {
      input.value = item.textContent;
      dropdown.innerHTML = "";
      input.focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    const items = [...dropdown.querySelectorAll(".dropdown-item")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) {
        return;
      }
      e.preventDefault();
      activeIndex = e.key === "ArrowDown"
        ? (activeIndex + 1) % items.length
        : (activeIndex - 1 + items.length) % items.length;
      items.forEach((item, i) => item.classList.toggle("active", i === activeIndex));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // A highlighted (or single) suggestion autocompletes, then submits
      const pick = activeIndex >= 0 ? items[activeIndex] : items.length === 1 ? items[0] : null;
      if (pick) {
        input.value = pick.textContent;
        dropdown.innerHTML = "";
        activeIndex = -1;
      }
      submitGuess();
    } else if (e.key === "Escape") {
      dropdown.innerHTML = "";
      activeIndex = -1;
    }
  });
}

// Tooltip handling logic by BinariEM
const mapa = document.getElementById("map-container");
const tooltip = document.getElementById("tooltip");

mapa.addEventListener("mouseover", (e) => {
  const dataComarca = e.target.getAttribute("data-comarca");
  const group = e.target.closest ? e.target.closest("g") : null;
  // Ghosted (unguessed) comarques keep their names secret: hovering the
  // fog of war must not become a free hint
  if (dataComarca && group && !group.classList.contains("ghost")) {
    tooltip.innerHTML = "<span class='triangle'></span>" + "<div>" + dataComarca + "</div>";
    tooltip.style.display = "block";
  } else {
    tooltip.style.display = "none";
  }
});

mapa.addEventListener("mouseleave", () => {
  tooltip.style.display = "none";
});

mapa.addEventListener("mousemove", (e) => {
  tooltip.style.left = (e.pageX + 20) + "px";
  tooltip.style.top = (e.pageY - 20) + "px";
});

// Guess handling logic update
function submitGuess() {
  if (!game_state.game_running) {
      return;
  }

  const input = document.getElementById("comarques-input");
  const guess = input.value.trim();
  if (!guess) {
      return;
  }
  const svgElement = document.querySelector("svg");
  const comarca = Array.from(svgElement.querySelectorAll("g")).find(
      g => normalizeText(g.getAttribute("data-comarca")) === normalizeText(guess)
  );

  if (!comarca) {
      showFeedback(t("invalid_comarca"), "red");
      return;
  }

  // The start and end are given; typing them manually must not cost a
  // guess (issue #36)
  if (comarca.id === game_state.start || comarca.id === game_state.end) {
      showFeedback(t("endpoint_guess"), "orange");
      return;
  }

  if (game_state.guessed_ids.includes(comarca.id)) {
      showFeedback(t("already_guessed"), "orange");
      return;
  }

  showFeedback("", "");
  input.value = "";
  document.getElementById("autocomplete-list").innerHTML = "";
  applyGuess(comarca);
}

document.getElementById("btn-guess").addEventListener("click", submitGuess);

function applyGuess(comarca, save = true) {
  // Reveal comarca and apply color based on correctness
  clearHintMarks(comarca);
  unghostComarca(comarca);
  comarca.classList.add("revealed");
  const guessIcon = checkGuess(comarca.id);
  game_state.guessed_ids.push(comarca.id);
  game_state.guesses_status.push(guessIcon);
  game_state.events.push({ t: "g", id: comarca.id });
  updateGuessHistory(comarca.getAttribute("data-comarca"), guessIcon);
  if (save) {
    saveProgress();
  }

  // Handle incorrect guess
  if (guessIcon === game_state.guesses_icons.bad) {
      game_state.incorrect_guesses++;
      if (game_state.incorrect_guesses >= maxIncorrectGuesses) {
          endGame(t("lost"), "red", save);
          return;
      }
  } else if (game_state.shortests_paths.some(path => path.length === 0)) {
    endGame(t("won"), "green", save);
    return;
  }

  checkOutOfGuesses(save);
  updateGuessButton();
  renderJourney();
}

// Progressive hints (issue #17): each hint costs one guess slot.
// Level 1 outlines the next optimal comarca, level 2 outlines every
// comarca still on a shortest path, level 3 adds their initials.
const maxHints = 3;

function applyHint(save = true) {
  if (!game_state.game_running || game_state.hints_used >= maxHints) {
    return;
  }
  const svgElement = document.querySelector("svg");
  game_state.hints_used++;

  let description;
  if (game_state.hints_used === 1) {
    outlineComarca(svgElement.querySelector(`g#${game_state.shortests_paths[0][0]}`));
    description = t("hint_next_outline");
  } else if (game_state.hints_used === 2) {
    remainingPathIds().forEach(id => outlineComarca(svgElement.querySelector(`g#${id}`)));
    description = t("hint_all_outlines");
  } else {
    remainingPathIds().forEach(id => {
      const group = svgElement.querySelector(`g#${id}`);
      outlineComarca(group);
      addInitials(group);
    });
    description = t("hint_initials");
  }

  game_state.guesses_status.push("💡");
  game_state.events.push({ t: "h" });
  updateGuessHistory(description, "💡");
  if (save) {
    saveProgress();
  }

  updateHintButton();
  checkOutOfGuesses(save);
  updateGuessButton();
  renderJourney();
}

// ---- Fog of war: unguessed comarques show as pale ghosts ----

// Read a CSS custom property so the map follows the active light/dark theme
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function ghostComarca(group) {
  const fill = cssVar("--land-ghost");
  const stroke = cssVar("--land-ghost-stroke");
  comarcaShapes(group).forEach(shape => {
    if (!shape.dataset.ghost) {
      shape.dataset.ghost = "true";
      shape.dataset.ghostPrevFill = shape.style.fill;
      shape.dataset.ghostPrevStroke = shape.style.stroke;
    }
    shape.style.fill = fill;
    shape.style.stroke = stroke;
  });
  group.classList.add("ghost");
}

// Re-tint the ghosted land when the theme changes at runtime
function applyMapTheme() {
  const svgElement = document.querySelector("svg");
  if (!svgElement) {
    return;
  }
  const fill = cssVar("--land-ghost");
  const stroke = cssVar("--land-ghost-stroke");
  svgElement.querySelectorAll("g.ghost").forEach(group => {
    comarcaShapes(group).forEach(shape => {
      if (shape.dataset.ghost) {
        shape.style.fill = fill;
        shape.style.stroke = stroke;
      }
    });
  });
}

function unghostComarca(group) {
  comarcaShapes(group).forEach(shape => {
    if (shape.dataset.ghost) {
      shape.style.fill = shape.dataset.ghostPrevFill;
      shape.style.stroke = shape.dataset.ghostPrevStroke;
      delete shape.dataset.ghost;
      delete shape.dataset.ghostPrevFill;
      delete shape.dataset.ghostPrevStroke;
    }
  });
  group.classList.remove("ghost");
}

function comarcaCenter(group) {
  const shape = group.querySelector("polygon") || group.querySelector("path");
  const bbox = shape.getBBox();
  return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
}

function addPinHalo(group, colorVar) {
  const center = comarcaCenter(group);
  const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  halo.setAttribute("cx", center.x);
  halo.setAttribute("cy", center.y);
  halo.setAttribute("r", 12);
  halo.setAttribute("class", "pin-halo");
  halo.style.fill = getComputedStyle(document.documentElement).getPropertyValue(colorVar);
  group.appendChild(halo);
}

// Draw the completed (or missed) route through the comarca centers
function drawRouteLine(won, animate) {
  const svgElement = document.querySelector("svg");
  const previous = svgElement.querySelector(".route-line");
  if (previous) {
    previous.remove();
  }
  const path = won
    ? game_state.original_paths.find(p => p.every(id => game_state.guessed_ids.includes(id))) || game_state.original_paths[0]
    : game_state.original_paths[0];
  const points = [game_state.start, ...path, game_state.end]
    .map(id => {
      const center = comarcaCenter(svgElement.querySelector(`g#${id}`));
      return `${center.x},${center.y}`;
    })
    .join(" ");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", points);
  line.setAttribute("class", "route-line");
  line.style.stroke = won ? "#ffffff" : "#777777";
  line.style.opacity = "0.9";
  if (!won) {
    line.style.strokeDasharray = "6 4";
  }
  svgElement.appendChild(line);
  if (animate && won) {
    const length = line.getTotalLength();
    line.style.strokeDasharray = length;
    line.style.strokeDashoffset = length;
    line.getBoundingClientRect(); // flush so the transition animates
    line.style.transition = "stroke-dashoffset 1.5s ease";
    line.style.strokeDashoffset = "0";
  }
}

// Every comarca still left on any shortest path (guessed ones are
// spliced out by checkGuess)
function remainingPathIds() {
  return [...new Set(game_state.shortests_paths.flat())];
}

function outlineComarca(group) {
  comarcaShapes(group).forEach(shape => {
    if (!shape.dataset.hintOutlined) {
      // The original fill lives in the shape's inline style attribute, so
      // remember it to restore when the comarca is guessed
      shape.dataset.hintOutlined = "true";
      shape.dataset.prevFill = shape.style.fill;
      shape.dataset.prevStroke = shape.style.stroke;
      shape.style.fill = "none";
      shape.style.stroke = "#555555";
      shape.style.strokeDasharray = "3 2";
    }
  });
}

function addInitials(group) {
  if (group.querySelector("text.hint-initials")) {
    return;
  }
  const shape = group.querySelector("polygon") || group.querySelector("path");
  const bbox = shape.getBBox();
  const initials = group.getAttribute("data-comarca")
    .split(/\s+/)
    .map(word => word[0].toUpperCase())
    .join("");
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", bbox.x + bbox.width / 2);
  text.setAttribute("y", bbox.y + bbox.height / 2);
  text.setAttribute("class", "hint-initials");
  text.textContent = initials;
  group.appendChild(text);
}

// Undo hint styling once the comarca is actually guessed
function clearHintMarks(comarca) {
  comarcaShapes(comarca).forEach(shape => {
    if (shape.dataset.hintOutlined) {
      shape.style.fill = shape.dataset.prevFill;
      shape.style.stroke = shape.dataset.prevStroke;
      shape.style.strokeDasharray = "";
      delete shape.dataset.hintOutlined;
      delete shape.dataset.prevFill;
      delete shape.dataset.prevStroke;
    }
  });
  const initials = comarca.querySelector("text.hint-initials");
  if (initials) {
    initials.remove();
  }
}

function usedGuesses() {
  return game_state.guessed_ids.length + game_state.hints_used;
}

function checkOutOfGuesses(live = true) {
  if (game_state.game_running && usedGuesses() >= game_state.max_guesses) {
    endGame(t("out_of_guesses"), "red", live);
  }
}

document.getElementById("btn-hint").addEventListener("click", () => applyHint());

function updateHintButton() {
  const button = document.getElementById("btn-hint");
  const hintsLeft = maxHints - game_state.hints_used;
  button.textContent = `💡 (${hintsLeft})`;
  button.disabled = hintsLeft === 0 || !game_state.game_running;
}

function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.getElementById("comarques-input").placeholder = t("input_placeholder");
  document.getElementById("btn-hint").title = t("hint_button_title");
  document.getElementById("btn-stats").title = t("stats_title");
  document.getElementById("btn-share").textContent = t("share_button");
  document.getElementById("btn-theme").setAttribute("aria-label", t("toggle_theme"));
  document.getElementById("btn-theme").title = t("toggle_theme");
  document.getElementById("btn-prev").title = t("prev_game");
  document.getElementById("btn-prev").setAttribute("aria-label", t("prev_game"));
  document.getElementById("btn-next").title = t("next_game_nav");
  document.getElementById("btn-next").setAttribute("aria-label", t("next_game_nav"));

  const langSelect = document.getElementById("lang-select");
  langSelect.value = currentLang;
  langSelect.addEventListener("change", () => {
    localStorage.setItem(LANG_KEY, langSelect.value);
    location.reload(); // game progress survives via viatgle-progress
  });
}

// The title keeps the colored start/end spans, so build it from the
// translated template. Each place gets its language-specific preposition +
// article prefix (de la / al / de l' / from ...) with the name in a span.
function setGameTitle(startName, endName) {
  const fromHtml = articlePrefix("de", game_state.start, startName) + '<span id="start-comarca"></span>';
  const toHtml = articlePrefix("a", game_state.end, endName) + '<span id="end-comarca"></span>';
  document.getElementById("game-title").innerHTML = t("title")
    .replace("{from}", fromHtml)
    .replace("{to}", toHtml);
  document.getElementById("start-comarca").textContent = startName;
  document.getElementById("end-comarca").textContent = endName;
}

function showFeedback(message, color) {
  const feedback = document.getElementById("feedback");
  feedback.textContent = message;
  feedback.style.color = color;
}

function endGame(message, color, live = true) {
  game_state.game_running = false;
  game_state.end_message = message;
  showFeedback(message, color);
  document.getElementById("comarques-input").disabled = true;
  document.getElementById("btn-guess").disabled = true;
  document.getElementById("btn-hint").disabled = true;

  const won = game_state.shortests_paths.some(path => path.length === 0);
  renderJourney();
  // Only the real daily game counts toward stats and streaks; replaying a
  // past game is practice (#35)
  if (game_state.is_today) {
    recordGameEnd(won);
  }
  drawRouteLine(won, live);
  if (live) {
    if (won) {
      launchConfetti();
    }
    // Auto-open the results only when finishing during play; on restore
    // or when browsing a finished past game the board just shows the
    // route, leaving the nav arrows reachable (stats stay one tap away)
    setTimeout(openStatsModal, won ? 1800 : 900);
  }
}

// ---- Stats, streaks and the end-game modal ----

function loadStats() {
  let stats = null;
  try {
    stats = JSON.parse(localStorage.getItem(STATS_KEY));
  } catch (err) {
    // fall through to defaults
  }
  return Object.assign({
    played: 0,
    wins: 0,
    current_streak: 0,
    max_streak: 0,
    last_recorded_day: null,
    last_won_day: null,
    distribution: {}
  }, stats || {});
}

// Idempotent per day: replaying a finished game on reload must not
// count it twice
function recordGameEnd(won) {
  const stats = loadStats();
  if (stats.last_recorded_day === game_state.day) {
    return stats;
  }
  stats.last_recorded_day = game_state.day;
  stats.played++;
  if (won) {
    stats.wins++;
    stats.current_streak = stats.last_won_day === game_state.day - 1 ? stats.current_streak + 1 : 1;
    stats.max_streak = Math.max(stats.max_streak, stats.current_streak);
    stats.last_won_day = game_state.day;
    const bucket = String(usedGuesses() - game_state.shortest_path_length);
    stats.distribution[bucket] = (stats.distribution[bucket] || 0) + 1;
  } else {
    stats.current_streak = 0;
    stats.distribution.X = (stats.distribution.X || 0) + 1;
  }
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    // Storage unavailable; stats just won't persist
  }
  return stats;
}

let countdownInterval = null;

function openStatsModal() {
  const stats = loadStats();
  document.getElementById("modal-title").textContent =
    game_state.game_running ? t("stats_title") : game_state.end_message;

  document.getElementById("stat-played").textContent = stats.played;
  document.getElementById("stat-winpct").textContent =
    stats.played ? Math.round((stats.wins / stats.played) * 100) + "%" : "-";
  document.getElementById("stat-streak").textContent = stats.current_streak;
  document.getElementById("stat-maxstreak").textContent = stats.max_streak;
  document.getElementById("label-played").textContent = t("stat_played");
  document.getElementById("label-winpct").textContent = t("stat_win_pct");
  document.getElementById("label-streak").textContent = t("stat_streak");
  document.getElementById("label-maxstreak").textContent = t("stat_max_streak");
  document.getElementById("dist-title").textContent = t("dist_title");
  renderDistribution(stats);

  document.getElementById("btn-share").hidden = game_state.game_running;
  document.getElementById("modal-feedback").textContent = "";
  // The "next viatgle" countdown only makes sense on today's game
  const countdown = document.querySelector(".countdown");
  if (game_state.is_today) {
    countdown.style.display = "";
    startCountdown();
  } else {
    countdown.style.display = "none";
  }
  document.getElementById("modal-overlay").hidden = false;
}

function closeStatsModal() {
  document.getElementById("modal-overlay").hidden = true;
  clearInterval(countdownInterval);
  countdownInterval = null;
}

function renderDistribution(stats) {
  const buckets = ["0", "1", "2", "3", "4", "5", "X"];
  const maxCount = Math.max(1, ...buckets.map(b => stats.distribution[b] || 0));
  document.getElementById("distribution").innerHTML = buckets.map(bucket => {
    const count = stats.distribution[bucket] || 0;
    const width = Math.max(8, Math.round((count / maxCount) * 100));
    const label = bucket === "X" ? "X" : "+" + bucket;
    return `<div class="dist-row"><span class="dist-label">${label}</span>` +
      `<div class="dist-bar${count ? "" : " dist-bar-empty"}" style="width:${width}%">${count}</div></div>`;
  }).join("");
}

function startCountdown() {
  document.getElementById("countdown-label").textContent = t("next_game");
  const value = document.getElementById("countdown-value");
  function tick() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ms = nextMidnight - now;
    const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
    const m = String(Math.floor(ms / 60000) % 60).padStart(2, "0");
    const s = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
    value.textContent = `${h}:${m}:${s}`;
  }
  tick();
  clearInterval(countdownInterval);
  countdownInterval = setInterval(tick, 1000);
}

function launchConfetti() {
  const colors = [
    getComputedStyle(document.documentElement).getPropertyValue("--start-color"),
    getComputedStyle(document.documentElement).getPropertyValue("--end-color"),
    "#4caf50", "#ffc107", "#03a9f4"
  ];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.8 + "s";
    piece.style.animationDuration = 2 + Math.random() * 2 + "s";
    document.body.appendChild(piece);
  }
  setTimeout(() => document.querySelectorAll(".confetti").forEach(p => p.remove()), 5000);
}

document.getElementById("btn-stats").addEventListener("click", openStatsModal);
document.getElementById("modal-close").addEventListener("click", closeStatsModal);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") {
    closeStatsModal();
  }
});

function buildShareText() {
  const gameNumber = game_state.day + 1;
  const won = game_state.shortests_paths.some(path => path.length === 0);
  const extraGuesses = usedGuesses() - game_state.shortest_path_length;
  const score = won ? `+${extraGuesses}` : "X";
  return `#viatgle #${gameNumber} ${score}\n${game_state.guesses_status.join("")}\n${GAME_URL}`;
}

document.getElementById("btn-share").addEventListener("click", async () => {
  const text = buildShareText();
  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      // The modal overlay covers the feedback line, so confirm inside it
      document.getElementById("modal-feedback").textContent = t("copied");
      showFeedback(t("copied"), "green");
    }
  } catch (err) {
    // Share sheet dismissed or clipboard unavailable; nothing to do
  }
});

function updateGuessButton() {
  if (!game_state.game_running) {
    return;
  }
  document.getElementById("btn-guess").textContent = t("guess_button", { n: usedGuesses() + 1, max: game_state.max_guesses });
}

function getComarcaName(comarcaId, svgElement) {
  return svgElement.querySelector(`#${comarcaId}`).getAttribute("data-comarca");
}

function checkGuess(comarcaId) {
  let isOptimal = false;
  let isGood = false;
  let isPrettyGood = false;

  // Check the comarca against the paths
  game_state.shortests_paths.forEach(path => {
      if (path.length > 0) {
          if (comarcaId === path[0]) {
              isOptimal = true;
              path.shift(); // Remove the guessed comarca from the path
          } else if (path.includes(comarcaId)) {
              isGood = true;
              path.splice(path.indexOf(comarcaId), 1); // Remove guessed comarca from path
          } else if (path.some(id => adjacencyMap[id].includes(comarcaId))) {
              isPrettyGood = true;
          }
      }
  });

  // Determine color and icon based on guess quality
  const svgElement = document.querySelector(`g#${comarcaId}`);
  if (isOptimal) {
      setSvgFill(svgElement, "green");
      return game_state.guesses_icons.optimal;
  } else if (isGood) {
      setSvgFill(svgElement, "green");
      return game_state.guesses_icons.good;
  } else if (isPrettyGood) {
      setSvgFill(svgElement, "yellow");
      return game_state.guesses_icons.pretty_good;
  } else {
      return game_state.guesses_icons.bad;
  }
}

// A comarca group can hold several shapes (e.g. l_alguer and
// camp_de_turia have exclaves), so always style all of them
function comarcaShapes(group) {
  return group.querySelectorAll("polygon, path");
}

function setSvgFill(element, color) {
  comarcaShapes(element).forEach(shape => {
    shape.style.fill = color;
  });
}

function updateGuessHistory(guess, icon) {
  const historyContainer = document.getElementById("guess-history");
  const guessElement = document.createElement("span");
  guessElement.className = "guess-box";
  guessElement.textContent = `${icon} ${guess}`;
  historyContainer.appendChild(guessElement);
}
