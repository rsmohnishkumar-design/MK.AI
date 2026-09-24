# Student marks manager: average, grade and topper
students = {}

n = int(input("How many students? "))
for _ in range(n):
    name = input("Name: ").strip()
    marks = [float(m) for m in input("Marks separated by spaces: ").split()]
    students[name] = marks


def grade(avg):
    if avg >= 90:
        return "A+"
    if avg >= 75:
        return "A"
    if avg >= 60:
        return "B"
    if avg >= 40:
        return "C"
    return "Fail"


print(f"\n{'Name':<12}{'Average':>8}  Grade")
for name, marks in students.items():
    avg = sum(marks) / len(marks)
    print(f"{name:<12}{avg:>8.1f}  {grade(avg)}")

topper = max(students, key=lambda s: sum(students[s]) / len(students[s]))
print("\n🏆 Topper:", topper)
