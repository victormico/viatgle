// Fetch JSON dynamically
function loadComarquesMap() {
    fetch('comarques_limitrofes.json') // Replace with your actual path
      .then(response => response.json())
      .then(data => {
        comarquesMap = data;
        initGame(); // Start the game after loading the map
      })
      .catch(error => console.error('Error loading comarques map:', error));
  }
  
  // Current game state
  let startComarca = "alt_camp"; // Example
  let endComarca = "tarragones"; // Example
  let shortestPath = [];
  let currentGuesses = [];
  
  // Load JSON Map
  function findShortestPath(start, end, map) {
    let queue = [[start]];
    let visited = new Set();
  
    while (queue.length > 0) {
      let path = queue.shift();
      let node = path[path.length - 1];
  
      if (node === end) return path;
  
      if (!visited.has(node)) {
        visited.add(node);
  
        for (let neighbor of map[node] || []) {
          let newPath = [...path, neighbor];
          queue.push(newPath);
        }
      }
    }
    return null;
  }
  
  // Initialize the game
  function initGame() {
    // Reset guesses
    currentGuesses = [];
    document.getElementById("feedback").innerText = "";
    document.getElementById("path-display").innerText = "";
  
    // Set start and end comarca
    startComarca = "alt_camp"; // Randomize later
    endComarca = "tarragones"; // Randomize later
    shortestPath = findShortestPath(startComarca, endComarca, comarquesMap);
  
    document.getElementById("start-comarca").innerText = startComarca;
    document.getElementById("end-comarca").innerText = endComarca;
  
    // Load SVGs
    loadSVG("start-svg", `svg/${startComarca}.svg`);
    loadSVG("end-svg", `svg/${endComarca}.svg`);
  }
  
  // Load an SVG into a container
  function loadSVG(containerId, svgPath) {
    fetch(svgPath)
      .then((response) => response.text())
      .then((svgContent) => {
        document.getElementById(containerId).innerHTML = svgContent;
      })
      .catch((error) => console.error("Error loading SVG:", error));
  }
  
  // Handle user guesses
  function handleGuess() {
    const guess = document.getElementById("guess-input").value.trim();
    document.getElementById("guess-input").value = "";
  
    if (!comarquesMap[guess]) {
      document.getElementById("feedback").innerText = "Invalid comarca. Try again.";
      return;
    }
  
    if (shortestPath.includes(guess) && !currentGuesses.includes(guess)) {
      currentGuesses.push(guess);
      document.getElementById("path-display").innerText = currentGuesses.join(" → ");
  
      if (arraysEqual(currentGuesses.sort(), shortestPath.slice(1, -1).sort())) {
        document.getElementById("feedback").innerText = "You found the shortest path!";
      } else {
        document.getElementById("feedback").innerText = "Correct! Keep going.";
      }
    } else {
      document.getElementById("feedback").innerText = "Incorrect or already guessed. Try again.";
    }
  }
  
  // Utility to compare arrays
  function arraysEqual(arr1, arr2) {
    return JSON.stringify(arr1) === JSON.stringify(arr2);
  }
  
  // Event listeners
  document.getElementById("guess-button").addEventListener("click", handleGuess);
  document.getElementById("restart-button").addEventListener("click", initGame);
  
  // Start the game
  loadComarquesMap();
  