# Contact book saved in contacts.json
import json
import os

FILE = "contacts.json"
contacts = json.load(open(FILE)) if os.path.exists(FILE) else {}


def save():
    with open(FILE, "w") as f:
        json.dump(contacts, f, indent=2)


while True:
    print("\n1) Add  2) Search  3) Show all  4) Delete  5) Quit")
    choice = input("Choose: ").strip()
    if choice == "1":
        name = input("Name: ").strip()
        contacts[name] = input("Phone: ").strip()
        save()
        print("Saved ✅")
    elif choice == "2":
        find = input("Search: ").strip().lower()
        matches = {n: p for n, p in contacts.items() if find in n.lower()}
        for n, p in matches.items():
            print(f"{n}: {p}")
        if not matches:
            print("No match.")
    elif choice == "3":
        for n in sorted(contacts):
            print(f"{n}: {contacts[n]}")
    elif choice == "4":
        name = input("Name to delete: ").strip()
        if contacts.pop(name, None):
            save()
            print("Deleted.")
        else:
            print("Not found.")
    elif choice == "5":
        break
