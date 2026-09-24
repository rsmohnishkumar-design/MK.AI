# To-do list that saves to a file (todo.json), so tasks are kept between runs
import json
import os

FILE = "todo.json"
tasks = json.load(open(FILE)) if os.path.exists(FILE) else []


def save():
    with open(FILE, "w") as f:
        json.dump(tasks, f, indent=2)


def show():
    if not tasks:
        print("  (nothing to do 🎉)")
    for i, t in enumerate(tasks, 1):
        print(f"  {i}. [{'x' if t['done'] else ' '}] {t['text']}")


print("Commands: add <task>, done <number>, del <number>, list, quit")
while True:
    cmd = input("> ").strip()
    if cmd in ("quit", "q"):
        break
    if cmd.startswith("add "):
        tasks.append({"text": cmd[4:], "done": False})
        save()
    elif cmd.startswith(("done ", "del ")):
        try:
            i = int(cmd.split()[1]) - 1
            if cmd.startswith("done"):
                tasks[i]["done"] = True
            else:
                tasks.pop(i)
            save()
        except (ValueError, IndexError):
            print("No task with that number.")
    show()
