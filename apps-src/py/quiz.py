# Quiz game: add your own questions to the list
QUESTIONS = [
    ("What is the capital of India?", ["Mumbai", "New Delhi", "Chennai", "Kolkata"], 2),
    ("How many planets are in the solar system?", ["7", "8", "9", "10"], 2),
    ("What is 12 x 12?", ["124", "144", "132", "156"], 2),
    ("Which gas do plants take in?", ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], 3),
]

score = 0
for number, (question, options, answer) in enumerate(QUESTIONS, 1):
    print(f"\nQ{number}. {question}")
    for i, option in enumerate(options, 1):
        print(f"  {i}) {option}")
    choice = input("Your answer (1-4): ").strip()
    if choice == str(answer):
        print("✅ Correct!")
        score += 1
    else:
        print(f"❌ The answer was {options[answer - 1]}")

print(f"\nYou scored {score} out of {len(QUESTIONS)} ({score * 100 // len(QUESTIONS)}%)")
