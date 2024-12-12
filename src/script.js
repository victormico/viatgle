let startComarca = "ports"; // Example start
let endComarca = "alt_emporda"; // Example end
let guessedPath = [];
let incorrectGuesses = 0;
let shortestPaths = []; // Store the computed shortest path

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
  // Load the game data in games/game.json
  const responseGame = await fetch("games/game.json");
  const gameInfo = await responseGame.json();


  startComarca = gameInfo.start;
  endComarca = gameInfo.end;
  shortestPaths = gameInfo.shortests_paths;

  const response = await fetch("comarques_limitrofes.json");
  const adjacencyMap = await response.json();

  // print the first shortest path
  console.log("First shortest paths:", shortestPaths[0]);

  const svgElement = document.querySelector("svg");
  svgElement.querySelectorAll("g").forEach(group => {
    if (group.id === startComarca) {
      group.querySelector("polygon").style.fill = getComputedStyle(document.documentElement)
        .getPropertyValue('--start-color');
    } else if (group.id === endComarca) {
      group.querySelector("polygon").style.fill = getComputedStyle(document.documentElement)
        .getPropertyValue('--end-color');
    } else {
      group.style.display = "none";
    }
  });

  // zoomToComarques(svgElement, [startComarca, endComarca]);
  populateDropdown(svgElement);
  document.getElementById("start-comarca").textContent = getComarcaName(startComarca, svgElement);
  document.getElementById("end-comarca").textContent = getComarcaName(endComarca, svgElement);

  guessedPath = [];
  incorrectGuesses = 0;
  //document.getElementById("feedback").textContent = "";
  //document.getElementById("path-display").textContent = "";
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

// Guess handling
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

  // Reveal comarca and check correctness
  comarca.style.display = "inline";
  const correct = checkGuess(comarca.id);
  comarca.querySelector("polygon").style.fill = correct ? "green" : "orange";
  guessedPath.push(comarca.id);

  // Handle incorrect guess
  if (!correct) {
    incorrectGuesses++;
    if (incorrectGuesses >= maxIncorrectGuesses) {
      showFeedback("You lost! Try again tomorrow.", "red");
      return;
    }
  }

  updateGuessButton();
});

function showFeedback(message, color) {
  const feedback = document.getElementById("feedback");
  feedback.textContent = message;
  feedback.style.color = color;
}

function updateGuessButton() {
  document.getElementById("btn-guess").textContent = `Guess (${incorrectGuesses}/${maxIncorrectGuesses})`;
}

function getComarcaName(comarcaId, svgElement) {
  return svgElement.querySelector(`#${comarcaId}`).getAttribute("data-comarca");
}

function checkGuess(comarcaId) {
  return (
    shortestPath.includes(comarcaId) &&
    comarcaId !== startComarca &&
    comarcaId !== endComarca
  );
}
