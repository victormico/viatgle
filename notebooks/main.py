import json

# Load game data from JSON file
def load_game_data(file_path):
    with open(file_path, "r") as f:
        return json.load(f)

# Save game data to JSON file
def save_game_data(file_path, data):
    with open(file_path, "w") as f:
        json.dump(data, f, indent=4)

# Initialize game state
def initialize_game(game_data):
    return {
        "start": game_data["start"],
        "end": game_data["end"],
        "shortests_paths": game_data["shortests_paths"],
        "remaining_guesses": len(game_data["shortests_paths"][0]) + 3,
        "guesses": [],
        "guesses_status": [],
        "progress": {idx: path.copy() for idx, path in enumerate(game_data["shortests_paths"])},
        "game_running": True,
        "guesses_icons": {
            "optimal": "✅",
            "good": "🟩",
            "pretty_good": "🟧",
            "bad": "🟥"
        }
    }

# Get a valid user guess
def get_user_guess(guesses, comarques_list):
    while True:
        guess = input("Please enter a comarca id (or type 'exit' to quit): ").strip().lower()
        if guess == "exit":
            return None
        elif guess not in comarques_list:
            print("Guess is not a comarca id")
        elif guess in guesses:
            print(f"You have already guessed this comarca: {guess}")
        else:
            return guess

# Evaluate the guess
def evaluate_guess(guess, progress, comarques_adjacents, guesses_icons):
    optimal, good, pretty_good = False, False, False
    for path in progress.values():
        if path:
            if guess == path[0]:  # Optimal guess
                optimal = True
                path.pop(0)
            elif guess in path:  # Good guess
                good = True
                path.pop(path.index(guess))
            elif any(guess in comarques_adjacents[c] for c in path):  # Pretty good guess
                pretty_good = True

    if optimal:
        return guesses_icons['optimal'], "Guess is optimal! You're one step closer."
    elif good:
        return guesses_icons['good'], "Guess is good. This guess is on the shortest path, but it's not the next comarca to go through."
    elif pretty_good:
        return guesses_icons['pretty_good'], "Guess is pretty good. This comarca is close, but doesn't get you closer."
    else:
        return guesses_icons['bad'], "Guess is not great. This comarca is a significant detour."

# Main game loop
def play_game(game_state, comarques_list, comarques_adjacents):
    print(f"I want to go from {game_state['start']} to {game_state['end']}")
    while game_state["game_running"] and game_state["remaining_guesses"] > 0:
        print(f"Number of guesses remaining: {game_state['remaining_guesses']}")
        guess = get_user_guess(game_state["guesses"], comarques_list)
        if guess is None:
            print("You have chosen to exit the game. Goodbye!")
            game_state["game_running"] = False
            break

        game_state["guesses"].append(guess)
        guess_icon, guess_status = evaluate_guess(
            guess, 
            game_state["progress"], 
            comarques_adjacents, 
            game_state["guesses_icons"]
        )
        print(guess_status)
        game_state["guesses_status"].append(guess_icon)

        if any(len(path) == 0 for path in game_state["progress"].values()):
            print("You have won!")
            game_state["game_running"] = False

        game_state["remaining_guesses"] -= 1

    if not any(len(path) == 0 for path in game_state["progress"].values()):
        print("Game over! You have run out of guesses.")

# Example usage
if __name__ == "__main__":
    # Load game data
    game_file = "game.json"
    adjacents_file = "comarques_limitrofes.json"
    game_data = load_game_data(game_file)
    comarques_adjacents = load_game_data(adjacents_file)

    # List of valid comarca IDs
    comarques_list = list(comarques_adjacents.keys())

    # Initialize game state
    game_state = initialize_game(game_data)

    # Play the game
    play_game(game_state, comarques_list, comarques_adjacents)
