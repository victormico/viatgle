let adjacencyMap = {}; // Store the adjacency map for the comarques
let game_state = {}; // Initialize game state

const maxIncorrectGuesses = 5;
const STORAGE_KEY = "viatgle-progress";
const GAME_URL = "https://victormico.github.io/viatgle";

document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();
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

  // Load the precomputed pairs
  const responsePairs = await fetch("pairs.json");
  const pairs = await responsePairs.json();

  // Use the difference as an index to select the pair
  const pairIndex = diffDays % Object.keys(pairs).length;
  const pair = pairs[pairIndex];

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
    day: diffDays,
    start: pair.start,
    end: pair.end,
    shortests_paths: shortestPaths,
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
      group.style.display = "inline";
    } else if (group.id === game_state.end) {
      setSvgFill(group, getComputedStyle(document.documentElement).getPropertyValue('--end-color'));
      group.style.display = "inline";
    }
  });

  populateDropdown(svgElement);
  initPanZoom(svgElement, document.getElementById("map-container"));
  setGameTitle(getComarcaName(game_state.start, svgElement), getComarcaName(game_state.end, svgElement));

  restoreProgress(svgElement);
  updateGuessButton();
  updateHintButton();
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
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
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
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

function populateDropdown(svgElement) {
  const dropdown = document.getElementById("autocomplete-list");
  const comarques = Array.from(svgElement.querySelectorAll("g")).map(group => ({
    id: group.id,
    name: group.getAttribute("data-comarca"),
  }));

  const input = document.getElementById("comarques-input");
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      dropdown.innerHTML = "";
      return;
    }
    const suggestions = comarques
      .filter(c => c.name.toLowerCase().includes(query))
      .map(c => `<button type="button" class="dropdown-item" data-id="${c.id}">${c.name}</button>`)
      .join("");
    dropdown.innerHTML = suggestions;

    // Handle suggestion click
    dropdown.querySelectorAll(".dropdown-item").forEach(item => {
      item.addEventListener("click", () => {
        input.value = item.textContent;
        dropdown.innerHTML = "";
      });
    });
  });
}

// Tooltip handling logic by BinariEM
const mapa = document.getElementById("map-container");
const tooltip = document.getElementById("tooltip");

mapa.addEventListener("mouseover", (e) => {
  const dataComarca = e.target.getAttribute("data-comarca");
  if (dataComarca) {
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
document.getElementById("btn-guess").addEventListener("click", () => {
  if (!game_state.game_running) {
      return;
  }

  const input = document.getElementById("comarques-input");
  const guess = input.value.trim();
  const svgElement = document.querySelector("svg");
  const comarca = Array.from(svgElement.querySelectorAll("g")).find(
      g => g.getAttribute("data-comarca").toLowerCase() === guess.toLowerCase()
  );

  if (!comarca) {
      showFeedback(t("invalid_comarca"), "red");
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
});

function applyGuess(comarca, save = true) {
  // Reveal comarca and apply color based on correctness
  clearHintMarks(comarca);
  comarca.style.display = "inline";
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
          endGame(t("lost"), "red");
          return;
      }
  } else if (game_state.shortests_paths.some(path => path.length === 0)) {
    endGame(t("won"), "green");
    return;
  }

  checkOutOfGuesses();
  updateGuessButton();
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
  checkOutOfGuesses();
  updateGuessButton();
}

// Every comarca still left on any shortest path (guessed ones are
// spliced out by checkGuess)
function remainingPathIds() {
  return [...new Set(game_state.shortests_paths.flat())];
}

function outlineComarca(group) {
  const shape = group.querySelector("polygon") || group.querySelector("path");
  if (shape && !shape.dataset.hintOutlined) {
    // The original fill lives in the shape's inline style attribute, so
    // remember it to restore when the comarca is guessed
    shape.dataset.hintOutlined = "true";
    shape.dataset.prevFill = shape.style.fill;
    shape.style.fill = "none";
    shape.style.strokeDasharray = "3 2";
  }
  group.style.display = "inline";
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
  const shape = comarca.querySelector("polygon") || comarca.querySelector("path");
  if (shape && shape.dataset.hintOutlined) {
    shape.style.fill = shape.dataset.prevFill;
    shape.style.strokeDasharray = "";
    delete shape.dataset.hintOutlined;
    delete shape.dataset.prevFill;
  }
  const initials = comarca.querySelector("text.hint-initials");
  if (initials) {
    initials.remove();
  }
}

function usedGuesses() {
  return game_state.guessed_ids.length + game_state.hints_used;
}

function checkOutOfGuesses() {
  if (game_state.game_running && usedGuesses() >= game_state.max_guesses) {
    endGame(t("out_of_guesses"), "red");
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
  document.getElementById("btn-share").textContent = t("share_button");

  const langSelect = document.getElementById("lang-select");
  langSelect.value = currentLang;
  langSelect.addEventListener("change", () => {
    localStorage.setItem(LANG_KEY, langSelect.value);
    location.reload(); // game progress survives via viatgle-progress
  });
}

// The title keeps the colored start/end spans, so build it from the
// translated template with placeholders swapped for the spans.
// {de_start} (Catalan) resolves the elided particle first: d'Osona / de Garrotxa.
function setGameTitle(startName, endName) {
  document.getElementById("game-title").innerHTML = t("title")
    .replace("{de_start}", caDeParticle(startName) + "{start}")
    .replace("{start}", '<span id="start-comarca"></span>')
    .replace("{end}", '<span id="end-comarca"></span>');
  document.getElementById("start-comarca").textContent = startName;
  document.getElementById("end-comarca").textContent = endName;
}

function showFeedback(message, color) {
  const feedback = document.getElementById("feedback");
  feedback.textContent = message;
  feedback.style.color = color;
}

function endGame(message, color) {
  game_state.game_running = false;
  showFeedback(message, color);
  document.getElementById("comarques-input").disabled = true;
  document.getElementById("btn-guess").disabled = true;
  document.getElementById("btn-hint").disabled = true;
  document.getElementById("btn-share").hidden = false;
}

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

function setSvgFill(element, color) {
  // Try both polygon and path
  const shape = element.querySelector("polygon") || element.querySelector("path");
  if (shape) {
    shape.style.fill = color;
  }
}

function updateGuessHistory(guess, icon) {
  const historyContainer = document.getElementById("guess-history");
  const guessElement = document.createElement("span");
  guessElement.className = "guess-box";
  guessElement.textContent = `${icon} ${guess}`;
  historyContainer.appendChild(guessElement);
}
