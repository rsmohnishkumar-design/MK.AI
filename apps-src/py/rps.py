# Rock, paper, scissors against the computer
import random

CHOICES = ["rock", "paper", "scissors"]
BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}
you = computer = 0

while True:
    mine = input("rock, paper or scissors? (q to quit): ").strip().lower()
    if mine == "q":
        break
    if mine not in CHOICES:
        print("Please type rock, paper or scissors.")
        continue
    theirs = random.choice(CHOICES)
    print("Computer chose", theirs)
    if mine == theirs:
        print("Draw 🤝")
    elif BEATS[mine] == theirs:
        print("You win! 🎉")
        you += 1
    else:
        print("Computer wins 🤖")
        computer += 1
    print(f"Score — you {you} : {computer} computer\n")

print(f"Final score — you {you} : {computer} computer")
