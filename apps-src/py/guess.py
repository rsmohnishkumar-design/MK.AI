# Number guessing game
import random

secret = random.randint(1, 100)
tries = 0
print("I'm thinking of a number between 1 and 100.")

while True:
    try:
        guess = int(input("Your guess: "))
    except ValueError:
        print("Please type a whole number.")
        continue
    tries += 1
    if guess < secret:
        print("Higher ⬆️")
    elif guess > secret:
        print("Lower ⬇️")
    else:
        print(f"🎉 Correct! It was {secret}. You took {tries} tries.")
        break
