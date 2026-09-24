# Tic-tac-toe for two players in the terminal
board = [" "] * 9
LINES = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]


def show():
    for r in range(3):
        print(" " + " | ".join(board[r * 3:r * 3 + 3]))
        if r < 2:
            print("---+---+---")


def winner():
    for a, b, c in LINES:
        if board[a] != " " and board[a] == board[b] == board[c]:
            return board[a]
    return None


player = "X"
print("Squares are numbered 1-9, left to right, top to bottom.")
for turn in range(9):
    show()
    while True:
        try:
            move = int(input(f"Player {player}, choose a square (1-9): ")) - 1
            if 0 <= move < 9 and board[move] == " ":
                break
        except ValueError:
            pass
        print("That square isn't free — try again.")
    board[move] = player
    if winner():
        show()
        print(f"🎉 Player {player} wins!")
        break
    player = "O" if player == "X" else "X"
else:
    show()
    print("It's a draw 🤝")
