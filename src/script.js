let startComarca = ""; // Example start
let endComarca = ""; // Example end
let guessedPath = [];
let guesses = 1;
let incorrectGuesses = 0;
let shortestPaths = []; // Store the computed shortest path
let adjacencyMap = {}; // Store the adjacency map for the comarques
let maxGuesses = 0;
let game_state = {}; // Initialize game state

const maxIncorrectGuesses = 5;

document.addEventListener("DOMContentLoaded", () => {
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
  // Set the start date
  const startDate = new Date('2024-12-16');
  const currentDate = new Date();
  
  // Calculate the difference in days
  const diffTime = Math.abs(currentDate - startDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Load the precomputed pairs
  const responsePairs = await fetch("pairs.json");
  const pairs = await responsePairs.json();
  
  // Use the difference as an index to select the pair
  const pairIndex = diffDays % Object.keys(pairs).length;
  const pair = pairs[pairIndex];
  
  startComarca = pair.start;
  endComarca = pair.end;
  
  // Load the all_shortest_paths.json
  const responsePaths = await fetch("all_shortest_paths.json");
  const allShortestPaths = await responsePaths.json();
  
  shortestPaths = allShortestPaths[startComarca][endComarca];
  
  // Remove start and end comarca from each shortest path
  for (let path of shortestPaths) {
    if (path[0] === startComarca) {
      path.shift(); // Remove start comarca
    }
    if (path[path.length - 1] === endComarca) {
      path.pop(); // Remove end comarca
    }
  }
  const response = await fetch("comarques_limitrofes.json");
  adjacencyMap = await response.json();
  
  // Initialize game state
  game_state = {
    start: startComarca,
    end: endComarca,
    shortests_paths: shortestPaths,
    remaining_guesses: shortestPaths[0].length + maxIncorrectGuesses,
    guesses: [],
    guesses_status: [],
    game_running: true,
    guesses_icons: {
      optimal: "✅",
      good: "🟩",
      pretty_good: "🟧",
      bad: "🟥"
    }
  };
  
  // Print the first shortest path
  console.log("First shortest paths:", shortestPaths[0]);
  
  maxGuesses = shortestPaths[0].length + maxIncorrectGuesses;
  document.getElementById("max-guesses").textContent = `${maxGuesses}`;
  
  const svgElement = document.querySelector("svg");
  svgElement.querySelectorAll("g").forEach(group => {
    if (group.id === startComarca) {
      setSvgFill(group, getComputedStyle(document.documentElement).getPropertyValue('--start-color'));
    } else if (group.id === endComarca) {
      setSvgFill(group, getComputedStyle(document.documentElement).getPropertyValue('--end-color'));
    } else {
      group.style.display = "none";
    }
  });
  
  populateDropdown(svgElement);
  document.getElementById("start-comarca").textContent = getComarcaName(startComarca, svgElement);
  document.getElementById("end-comarca").textContent = getComarcaName(endComarca, svgElement);
  
  guessedPath = [];
  incorrectGuesses = 0;
}

function populateDropdown(svgElement) {
  const dropdown = document.getElementById("autocomplete-list");
  const comarques = Array.from(svgElement.querySelectorAll("g")).map(group => ({
    id: group.id,
    name: group.getAttribute("data-comarca"),
  }));

  const input = document.getElementById("comarques-input");
  input.addEventListener("input", () => {
    const query = input.value.toLowerCase();
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

// Guess handling logic update
document.getElementById("btn-guess").addEventListener("click", () => {
  const guess = document.getElementById("comarques-input").value.trim();
  const svgElement = document.querySelector("svg");
  const comarca = Array.from(svgElement.querySelectorAll("g")).find(
      g => g.getAttribute("data-comarca").toLowerCase() === guess.toLowerCase()
  );

  if (!comarca) {
      showFeedback("Invalid comarca!", "red");
      return;
  }

  if (guessedPath.includes(comarca.id)) {
      showFeedback("Already guessed!", "orange");
      return;
  }

  // Reveal comarca and apply color based on correctness
  comarca.style.display = "inline";
  const guessIcon = checkGuess(comarca.id);
  guessedPath.push(comarca.id);
  guesses++;
  updateGuessHistory(guess, guessIcon); // Update guess history

  // Handle incorrect guess
  if (guessIcon === game_state.guesses_icons.bad) {
      incorrectGuesses++;
      if (incorrectGuesses >= maxIncorrectGuesses) {
          showFeedback("You lost! Try again tomorrow.", "red");
          return;
      }
  } else if (shortestPaths.some(path => path.length === 0)) {
    showFeedback("You won! Congratulations!", "green");
    return;
  }

  updateGuessButton();

  // Clear the input box
  document.getElementById("comarques-input").value = "";
});

function showFeedback(message, color) {
  const feedback = document.getElementById("feedback");
  feedback.textContent = message;
  feedback.style.color = color;
}

function updateGuessButton() {
  document.getElementById("btn-guess").textContent = `Guess (${guesses}/${maxGuesses})`;
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