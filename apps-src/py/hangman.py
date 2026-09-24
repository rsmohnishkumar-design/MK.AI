# Hangman in the terminal
import random

WORDS = ["python", "computer", "elephant", "mango", "chennai", "rainbow"]
word = random.choice(WORDS)
guessed = set()
lives = 6

while lives > 0:
    shown = " ".join(c if c in guessed else "_" for c in word)
    print(f"\n{shown}   lives: {'♥' * lives}")
    if "_" not in shown:
        print("🎉 You got it!")
        break
    letter = input("Guess a letter: ").strip().lower()
    if len(letter) != 1 or not letter.isalpha():
        print("Type one letter.")
        continue
    if letter in guessed:
        print("You already tried that.")
        continue
    guessed.add(letter)
    if letter not in word:
        lives -= 1
        print("Nope!")
else:
    print(f"💀 Out of lives! The word was {word}.")
