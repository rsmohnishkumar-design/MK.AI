from common import save
def code(lang, src): return f"```{lang}\n{src.strip()}\n```"
PY = lambda s: code("python", s)
JS = lambda s: code("javascript", s)
C = []
def add(q, a, alts): C.append((q, a, alts))

# ---------- Python basics ----------
add("How do I print in Python?", "Use print():\n" + PY('''
print("Hello, world!")
name = "Asha"
print("Hi", name)            # Hi Asha
print(f"Hi {name}, 2+3 = {2+3}")   # f-string
'''), ["print in python","hello world in python","python hello world","how to print hello world in python","first python program"])
add("How do I take input in Python?", "input() always gives text, so convert numbers with int() or float():\n" + PY('''
name = input("Your name: ")
age = int(input("Your age: "))
print(f"{name}, next year you'll be {age + 1}")
'''), ["input in python","python input","user input python","read input in python","take a number as input python"])
add("How do variables work in Python?", "A variable is a name for a value. No need to declare a type:\n" + PY('''
name = "Ravi"      # str (text)
age = 17           # int (whole number)
height = 1.72      # float (decimal)
is_student = True  # bool
print(type(age))   # <class 'int'>
'''), ["variables in python","python variables","data types in python","python data types"])
add("How do I write an if else in Python?", "Indentation (4 spaces) shows what's inside the if:\n" + PY('''
marks = 72
if marks >= 90:
    print("A+")
elif marks >= 60:
    print("Pass with merit")
else:
    print("Keep trying")
'''), ["if else in python","python if statement","elif in python","conditional statements in python","if elif else python"])
add("How do loops work in Python?", "A for loop goes over a sequence; a while loop repeats while a condition is true:\n" + PY('''
for i in range(1, 6):        # 1 to 5
    print(i, "x 7 =", i * 7)

count = 3
while count > 0:
    print(count)
    count -= 1
print("Go!")
'''), ["loops in python","for loop in python","while loop in python","python for loop","python while loop","range in python"])
add("How do I write a function in Python?", "Use def, give parameters, and return a result:\n" + PY('''
def area_of_circle(r):
    return 3.14159 * r * r

def greet(name="friend"):     # default value
    return f"Hello, {name}!"

print(area_of_circle(5))   # 78.53975
print(greet())             # Hello, friend!
'''), ["functions in python","python function","def in python","how to define a function in python","return in python"])
add("How do lists work in Python?", "A list is an ordered, changeable collection:\n" + PY('''
fruits = ["apple", "mango", "banana"]
fruits.append("grape")     # add at end
fruits.remove("apple")     # remove by value
print(fruits[0])           # mango (index starts at 0)
print(len(fruits))         # 3
fruits.sort()
for f in fruits:
    print(f)
'''), ["lists in python","python list","array in python","python arrays","list methods python"])
add("How do dictionaries work in Python?", "A dictionary stores key: value pairs:\n" + PY('''
student = {"name": "Priya", "age": 16, "marks": 92}
print(student["name"])          # Priya
student["city"] = "Chennai"     # add
for key, value in student.items():
    print(key, "=", value)
print(student.get("phone", "not given"))
'''), ["dictionary in python","python dictionary","dict in python","key value in python","python dict"])
add("What are tuples and sets in Python?", "A tuple is an ordered list that can't change; a set holds unique items with no order:\n" + PY('''
point = (3, 4)           # tuple
x, y = point             # unpacking
colours = {"red", "blue", "red"}
print(colours)           # {'red', 'blue'} — duplicates removed
print("red" in colours)  # True
'''), ["tuple in python","set in python","python tuple","python set","difference between list and tuple"])
add("How do string methods work in Python?", PY('''
s = "  Hello World  "
print(s.strip())          # "Hello World"
print(s.lower(), s.upper())
print("World" in s)       # True
print(s.replace("World", "India"))
words = "a,b,c".split(",")    # ['a', 'b', 'c']
print("-".join(words))        # a-b-c
print("python"[::-1])         # nohtyp (reverse)
print(len("hello"))           # 5
'''), ["string methods python","strings in python","python string functions","split and join in python","string slicing python"])
add("How do I reverse a string in Python?", PY('''
text = "hello"
print(text[::-1])                 # olleh
print("".join(reversed(text)))    # olleh
'''), ["reverse a string in python","python reverse string","reverse string python"])
add("How do I check if a string is a palindrome?", PY('''
def is_palindrome(text):
    clean = "".join(ch.lower() for ch in text if ch.isalnum())
    return clean == clean[::-1]

print(is_palindrome("Madam"))                          # True
print(is_palindrome("A man, a plan, a canal: Panama")) # True
'''), ["palindrome program in python","check palindrome python","palindrome in python","palindrome program"])
add("How do I check if a number is prime in Python?", PY('''
def is_prime(n):
    if n < 2:
        return False
    i = 2
    while i * i <= n:        # only need to check up to √n
        if n % i == 0:
            return False
        i += 1
    return True

print([n for n in range(1, 30) if is_prime(n)])
'''), ["prime number program in python","check prime in python","prime program python","python prime number"])
add("How do I find the factorial in Python?", PY('''
def factorial(n):            # loop version
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

def factorial_rec(n):        # recursive version
    return 1 if n <= 1 else n * factorial_rec(n - 1)

import math
print(factorial(5), factorial_rec(5), math.factorial(5))   # 120 120 120
'''), ["factorial program in python","factorial in python","python factorial","write a program to find factorial","factorial program"])
add("How do I print the Fibonacci series in Python?", PY('''
def fibonacci(n):
    a, b = 0, 1
    series = []
    for _ in range(n):
        series.append(a)
        a, b = b, a + b
    return series

print(fibonacci(10))   # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
'''), ["fibonacci program in python","fibonacci series in python","python fibonacci","fibonacci program"])
add("How do I check if a number is even or odd in Python?", PY('''
n = int(input("Number: "))
print("Even" if n % 2 == 0 else "Odd")
'''), ["even or odd program in python","even odd python","odd even program"])
add("How do I find the largest of three numbers in Python?", PY('''
a, b, c = 12, 45, 7
print(max(a, b, c))        # 45

# without max():
largest = a
if b > largest: largest = b
if c > largest: largest = c
print(largest)
'''), ["largest of three numbers python","biggest of three numbers","maximum of three numbers python"])
add("How do I check a leap year in Python?", PY('''
def is_leap(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

print(is_leap(2024), is_leap(1900), is_leap(2000))   # True False True
'''), ["leap year program in python","leap year python","check leap year program"])
add("How do I swap two numbers in Python?", PY('''
a, b = 5, 9
a, b = b, a
print(a, b)    # 9 5
'''), ["swap two numbers in python","swap variables python","swapping program"])
add("How do I sum a list in Python?", PY('''
numbers = [4, 8, 15, 16, 23, 42]
print(sum(numbers))                 # 108
print(sum(numbers) / len(numbers))  # average: 18.0
print(max(numbers), min(numbers))   # 42 4
'''), ["sum of list in python","average of list python","sum of numbers python","sum of array python"])
add("How do I count words in a sentence in Python?", PY('''
text = "the cat and the hat"
words = text.split()
print(len(words))               # 5
from collections import Counter
print(Counter(words))           # Counter({'the': 2, 'cat': 1, 'and': 1, 'hat': 1})
'''), ["count words in python","word count program python","count frequency of words python"])
add("How do I sort a list in Python?", PY('''
nums = [5, 2, 9, 1]
nums.sort()                      # changes the list: [1, 2, 5, 9]
print(sorted(nums, reverse=True))  # new list: [9, 5, 2, 1]
names = ["banana", "Apple", "cherry"]
print(sorted(names, key=str.lower))
students = [("Ravi", 72), ("Asha", 91)]
print(sorted(students, key=lambda s: s[1], reverse=True))  # by marks
'''), ["sort a list in python","sorting in python","python sort","sort list python"])
add("What is list comprehension in Python?", "A short way to build a list from a loop:\n" + PY('''
squares = [n * n for n in range(1, 6)]          # [1, 4, 9, 16, 25]
evens = [n for n in range(20) if n % 2 == 0]
upper = [w.upper() for w in ["hi", "there"]]
'''), ["list comprehension","list comprehension in python","python list comprehension"])
add("How do I read and write files in Python?", PY('''
# write (creates or overwrites)
with open("notes.txt", "w") as f:
    f.write("First line\\n")

# append
with open("notes.txt", "a") as f:
    f.write("Another line\\n")

# read
with open("notes.txt") as f:
    for line in f:
        print(line.strip())
'''), ["file handling in python","read file in python","write file in python","python file handling","open file python"])
add("How do I handle errors in Python?", "Use try/except so the program doesn't crash:\n" + PY('''
try:
    n = int(input("Number: "))
    print(100 / n)
except ValueError:
    print("That's not a number")
except ZeroDivisionError:
    print("Can't divide by zero")
finally:
    print("Done")
'''), ["try except in python","exception handling in python","python error handling","python try catch"])
add("How do classes and objects work in Python?", "A class is a blueprint; an object is one thing made from it:\n" + PY('''
class Dog:
    def __init__(self, name, age):      # runs when an object is made
        self.name = name
        self.age = age

    def bark(self):
        return f"{self.name} says Woof!"

class Puppy(Dog):                       # inheritance
    def bark(self):                     # overriding (polymorphism)
        return f"{self.name} says Yip!"

d = Dog("Tommy", 5)
p = Puppy("Bruno", 1)
print(d.bark(), p.bark())
'''), ["classes in python","oop in python","class and object in python","python class","object oriented programming python","inheritance in python"])
add("What is a lambda function in Python?", "A small one-line function without a name:\n" + PY('''
square = lambda x: x * x
print(square(6))                                  # 36
nums = [1, 2, 3, 4]
print(list(map(lambda x: x * 10, nums)))          # [10, 20, 30, 40]
print(list(filter(lambda x: x % 2 == 0, nums)))   # [2, 4]
'''), ["lambda in python","python lambda","map and filter in python","anonymous function python"])
add("How do I generate random numbers in Python?", PY('''
import random
print(random.randint(1, 6))           # dice roll
print(random.random())                # 0.0 to 1.0
print(random.choice(["a", "b", "c"])) # pick one
cards = [1, 2, 3, 4, 5]
random.shuffle(cards)
'''), ["random number in python","random module python","python random"])
add("How do I install packages in Python?", "Use pip in the terminal (Command Prompt on Windows):\n" + code("bash", '''
pip install requests
pip install numpy pandas
pip list              # see what's installed
''') + "\nThen `import requests` in your code. On Windows, if pip isn't found, try `py -m pip install requests`.", ["pip install","how to install python packages","pip in python","install library in python"])
add("How do I install Python?", "Go to python.org → Downloads, install Python 3, and on Windows tick **\"Add Python to PATH\"**. Check it by typing `python --version` in Command Prompt. For an editor, VS Code (free) with the Python extension is great. On an Android tablet, use the Pydroid 3 app.", ["install python","how to download python","setup python","python on android","python ide"])
add("How do I make a GUI in Python?", "Tkinter comes with Python:\n" + PY('''
import tkinter as tk

root = tk.Tk()
root.title("Hello")
label = tk.Label(root, text="Type your name:", font=("Arial", 14))
label.pack(pady=5)
entry = tk.Entry(root, font=("Arial", 14))
entry.pack()
tk.Button(root, text="Greet", command=lambda: label.config(text=f"Hello {entry.get()}!")).pack(pady=5)
root.mainloop()
'''), ["tkinter","gui in python","python gui","tkinter example","window in python"])
add("How do I call an API in Python?", PY('''
import requests      # pip install requests

res = requests.get("https://api.open-meteo.com/v1/forecast",
                   params={"latitude": 13.08, "longitude": 80.27, "current": "temperature_2m"})
data = res.json()
print("Chennai temperature:", data["current"]["temperature_2m"], "°C")
'''), ["api in python","requests in python","python requests","fetch data from api python","http request python"])
add("How do I use pandas in Python?", PY('''
import pandas as pd      # pip install pandas

df = pd.DataFrame({"name": ["Asha", "Ravi", "Priya"], "marks": [91, 72, 85]})
print(df.describe())            # count, mean, min, max…
print(df[df.marks > 80])        # filter rows
print(df.sort_values("marks", ascending=False))
# df = pd.read_csv("data.csv")  # read a CSV file
'''), ["pandas","pandas tutorial","dataframe in python","read csv in python"])
add("How do I make a graph in Python?", PY('''
import matplotlib.pyplot as plt   # pip install matplotlib

months = ["Jan", "Feb", "Mar", "Apr"]
sales = [120, 150, 90, 180]
plt.plot(months, sales, marker="o")
plt.title("Sales")
plt.xlabel("Month"); plt.ylabel("Units")
plt.show()
'''), ["matplotlib","plot graph in python","chart in python","python graph"])

# ---------- JavaScript ----------
add("How do variables work in JavaScript?", "Use const for values that don't change and let for ones that do (avoid the old var):\n" + JS('''
const name = "Asha";
let score = 0;
score = score + 10;
console.log(`${name} has ${score} points`);
'''), ["let const var","javascript variables","let vs const","difference between let and var"])
add("How do arrays work in JavaScript?", JS('''
const nums = [4, 8, 15, 16];
nums.push(23);                          // add to end
console.log(nums.length);               // 5
console.log(nums.map((n) => n * 2));    // [8, 16, 30, 32, 46]
console.log(nums.filter((n) => n > 10)); // [15, 16, 23]
console.log(nums.reduce((a, b) => a + b, 0)); // 66
console.log(nums.includes(8));          // true
'''), ["javascript arrays","array methods javascript","map filter reduce","js array"])
add("What is an arrow function in JavaScript?", "A shorter way to write functions:\n" + JS('''
function add(a, b) { return a + b; }     // normal
const add2 = (a, b) => a + b;            // arrow
const square = (x) => x * x;
console.log(add(2, 3), add2(2, 3), square(4));
'''), ["arrow functions","javascript arrow function","functions in javascript","javascript function"])
add("What are objects in JavaScript?", JS('''
const student = { name: "Priya", age: 16, subjects: ["maths", "science"] };
console.log(student.name);            // Priya
student.city = "Chennai";             // add a property
for (const [key, value] of Object.entries(student)) console.log(key, value);
const json = JSON.stringify(student); // to text
const back = JSON.parse(json);        // from text
'''), ["javascript objects","objects in javascript","json in javascript","json stringify parse"])
add("How do I change a web page with JavaScript (the DOM)?", "The DOM lets JavaScript read and change the page:\n" + code("html", '''
<p id="msg">Hello</p>
<button id="btn">Change</button>
<script>
  const msg = document.getElementById("msg");
  document.getElementById("btn").addEventListener("click", () => {
    msg.textContent = "You clicked!";
    msg.style.color = "green";
  });
</script>
'''), ["dom manipulation","what is dom","javascript dom","document getelementbyid","change html with javascript","queryselector"])
add("How do I fetch data from an API in JavaScript?", JS('''
async function getWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=13.08&longitude=80.27&current=temperature_2m");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    console.log("Chennai:", data.current.temperature_2m, "°C");
  } catch (err) {
    console.error("Failed:", err);
  }
}
getWeather();
'''), ["fetch api","fetch in javascript","async await","async await javascript","promises in javascript","javascript api call"])
add("How do I use localStorage in JavaScript?", "localStorage keeps small data in the browser, even after closing it (text only, so use JSON for lists):\n" + JS('''
const tasks = ["study", "play"];
localStorage.setItem("tasks", JSON.stringify(tasks));
const saved = JSON.parse(localStorage.getItem("tasks") || "[]");
localStorage.removeItem("tasks");
'''), ["localstorage","local storage javascript","save data in browser","sessionstorage"])
add("How do I use setTimeout and setInterval?", JS('''
setTimeout(() => console.log("after 2 seconds"), 2000);   // once
const id = setInterval(() => console.log("every second"), 1000);
setTimeout(() => clearInterval(id), 5000);                 // stop after 5 s
'''), ["settimeout","setinterval","timer in javascript","delay in javascript"])
add("How do I loop in JavaScript?", JS('''
for (let i = 1; i <= 5; i++) console.log(i);
const fruits = ["apple", "mango"];
for (const f of fruits) console.log(f);        // values
fruits.forEach((f, i) => console.log(i, f));   // with index
let n = 3;
while (n > 0) n--;
'''), ["for loop in javascript","loops in javascript","foreach javascript","while loop javascript"])
add("How do I handle a form in JavaScript?", code("html", '''
<form id="form">
  <input id="email" type="email" placeholder="Email" required>
  <button>Send</button>
</form>
<p id="out"></p>
<script>
  document.getElementById("form").addEventListener("submit", (e) => {
    e.preventDefault();                   // stop the page reloading
    const email = document.getElementById("email").value;
    document.getElementById("out").textContent = "Thanks, " + email;
  });
</script>
'''), ["form in javascript","form validation javascript","html form javascript","submit form javascript"])
add("What is the difference between == and === in JavaScript?", "`===` checks value AND type; `==` converts types first, which causes surprises. Always use `===`.\n" + JS('''
console.log(5 == "5");    // true  (converted)
console.log(5 === "5");   // false (number vs string)
console.log(null == undefined);  // true
'''), ["== vs ===","double equals vs triple equals","strict equality"])
add("What is Node.js?", "Node.js runs JavaScript outside the browser, on a computer or server. It's used for web servers, tools and APIs. Install it from nodejs.org, then run a file with `node app.js`; npm installs packages (`npm install express`).", ["nodejs","node js","what is npm","npm"])
add("What is React?", "React is a JavaScript library (by Meta) for building user interfaces from components. Each component is a function that returns what to show and updates when its state changes:\n" + code("jsx", '''
import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
}
''') + "\nStart a project with `npm create vite@latest my-app -- --template react`.", ["react js","reactjs","react tutorial","what is jsx","react component"])

# ---------- HTML & CSS ----------
add("What is the basic structure of an HTML page?", code("html", '''
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello!</h1>
  <p>My first page.</p>
  <script src="app.js"></script>
</body>
</html>
'''), ["html structure","basic html page","html boilerplate","html template","html page structure"])
add("What are the common HTML tags?", "Common tags: `<h1>`–`<h6>` headings, `<p>` paragraph, `<a href>` link, `<img src alt>` image, `<ul>/<ol>/<li>` lists, `<table>/<tr>/<td>` tables, `<div>` and `<span>` containers, `<form>/<input>/<button>` forms, `<header>/<nav>/<main>/<section>/<footer>` page sections.\n" + code("html", '''
<a href="https://example.com" target="_blank">Visit</a>
<img src="photo.jpg" alt="My photo" width="200">
<ul><li>One</li><li>Two</li></ul>
'''), ["html tags","list of html tags","html elements","common html tags"])
add("How do I make a table in HTML?", code("html", '''
<table border="1">
  <tr><th>Name</th><th>Marks</th></tr>
  <tr><td>Asha</td><td>91</td></tr>
  <tr><td>Ravi</td><td>72</td></tr>
</table>
'''), ["table in html","html table","create table in html"])
add("How do I make a form in HTML?", code("html", '''
<form>
  <label>Name <input type="text" name="name" required></label>
  <label>Email <input type="email" name="email"></label>
  <label>Class
    <select name="class"><option>10</option><option>11</option><option>12</option></select>
  </label>
  <label><input type="checkbox" name="agree"> I agree</label>
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Send</button>
</form>
'''), ["form in html","html form","input types html","html input"])
add("How do I center a div in CSS?", "The easiest way is flexbox (or grid) on the parent:\n" + code("css", '''
.parent {
  display: flex;
  justify-content: center;   /* horizontal */
  align-items: center;       /* vertical */
  min-height: 100vh;
}
/* or: .parent { display: grid; place-items: center; } */
/* just horizontally: .box { margin: 0 auto; width: 300px; } */
'''), ["center a div","center div css","how to center in css","center text css","align center css"])
add("What is flexbox in CSS?", "Flexbox lays items out in a row or column:\n" + code("css", '''
.row {
  display: flex;
  flex-direction: row;          /* or column */
  justify-content: space-between; /* along the main axis */
  align-items: center;          /* across */
  gap: 12px;
  flex-wrap: wrap;              /* wrap on small screens */
}
.item { flex: 1; }              /* share space equally */
'''), ["flexbox","css flexbox","display flex","flex in css"])
add("What is CSS grid?", "Grid lays items out in rows and columns:\n" + code("css", '''
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));  /* responsive columns */
  gap: 16px;
}
.wide { grid-column: span 2; }
'''), ["css grid","grid layout","display grid","grid in css"])
add("How do I make a website responsive?", "1) Add `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">`. 2) Use flexbox/grid and percentages or `min()` instead of fixed widths. 3) Use media queries:\n" + code("css", '''
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 700px) {
  .cards { grid-template-columns: 1fr; }   /* one column on phones */
}
img { max-width: 100%; height: auto; }
'''), ["responsive design","media queries","media query css","mobile friendly website","responsive website"])
add("How do I add CSS to HTML?", "Three ways: a separate file (best), a `<style>` block, or inline:\n" + code("html", '''
<link rel="stylesheet" href="style.css">          <!-- 1. external file -->
<style> h1 { color: teal; } </style>             <!-- 2. in the page -->
<p style="color: red;">Hello</p>                  <!-- 3. inline -->
'''), ["add css to html","link css to html","css in html","how to use css"])
add("What are CSS selectors?", code("css", '''
p { }                 /* every <p> */
.card { }             /* class="card" */
#header { }           /* id="header" */
nav a { }             /* <a> inside <nav> */
button:hover { }      /* when hovered */
li:nth-child(odd) { } /* every other item */
input[type="email"] { }
'''), ["css selectors","class vs id css","css class","hover in css"])
add("How do I make a CSS animation?", code("css", '''
@keyframes pop {
  from { transform: scale(0.8); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
.box { animation: pop 0.5s ease-out; }
.btn { transition: background 0.3s; }
.btn:hover { background: gold; }
'''), ["css animation","animation in css","keyframes css","css transition"])
add("What is the CSS box model?", "Every element is a box: **content**, then **padding** (space inside the border), the **border**, and **margin** (space outside). Add `* { box-sizing: border-box; }` so width includes padding and border, which makes layouts much easier.", ["box model","css box model","margin vs padding","difference between margin and padding"])

# ---------- Java, C, C++ ----------
add("How do I write Hello World in Java?", code("java", '''
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
''') + "\nSave as Main.java, then run `javac Main.java` and `java Main`.", ["hello world in java","java hello world","first java program","java program"])
add("How do I take input in Java?", code("java", '''
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Your name: ");
        String name = sc.nextLine();
        System.out.print("Your age: ");
        int age = sc.nextInt();
        System.out.println("Hi " + name + ", next year you'll be " + (age + 1));
    }
}
'''), ["input in java","scanner in java","java scanner","java user input"])
add("How do classes work in Java?", code("java", '''
class Animal {
    String name;
    Animal(String name) { this.name = name; }       // constructor
    String sound() { return "..."; }
}
class Dog extends Animal {                          // inheritance
    Dog(String name) { super(name); }
    @Override String sound() { return "Woof"; }     // polymorphism
}
public class Main {
    public static void main(String[] args) {
        Animal a = new Dog("Tommy");
        System.out.println(a.name + " says " + a.sound());
    }
}
'''), ["oop in java","java class","classes in java","inheritance in java","object oriented programming java"])
add("How do I write a calculator in Java?", code("java", '''
import java.util.Scanner;

public class Calculator {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("First number: ");  double a = sc.nextDouble();
        System.out.print("Operator (+ - * /): "); char op = sc.next().charAt(0);
        System.out.print("Second number: "); double b = sc.nextDouble();
        switch (op) {
            case '+' -> System.out.println(a + b);
            case '-' -> System.out.println(a - b);
            case '*' -> System.out.println(a * b);
            case '/' -> System.out.println(b == 0 ? "Can't divide by zero" : a / b);
            default -> System.out.println("Unknown operator");
        }
    }
}
'''), ["calculator in java","java calculator program","calculator program in java","simple calculator java"])
add("How do I write Hello World in C?", code("c", '''
#include <stdio.h>

int main(void) {
    printf("Hello, World!\\n");
    return 0;
}
''') + "\nCompile and run: `gcc hello.c -o hello` then `./hello`.", ["hello world in c","c program","first c program","c hello world"])
add("How do I take input in C?", code("c", '''
#include <stdio.h>

int main(void) {
    int a, b;
    printf("Enter two numbers: ");
    scanf("%d %d", &a, &b);
    printf("Sum = %d\\n", a + b);
    return 0;
}
'''), ["scanf in c","input in c","sum of two numbers in c","c program to add two numbers"])
add("What are pointers in C?", "A pointer stores the memory address of a variable:\n" + code("c", '''
#include <stdio.h>

void swap(int *x, int *y) {     // gets addresses, so it can change the originals
    int t = *x; *x = *y; *y = t;
}
int main(void) {
    int a = 5, b = 9;
    int *p = &a;                // p holds a's address
    printf("%d\\n", *p);         // 5 (the value at that address)
    swap(&a, &b);
    printf("%d %d\\n", a, b);    // 9 5
    return 0;
}
'''), ["pointers in c","c pointers","what is a pointer"])
add("How do I write a calculator in C?", code("c", '''
#include <stdio.h>

int main(void) {
    double a, b;
    char op;
    printf("Enter: number operator number (e.g. 5 * 3): ");
    scanf("%lf %c %lf", &a, &op, &b);
    switch (op) {
        case '+': printf("= %g\\n", a + b); break;
        case '-': printf("= %g\\n", a - b); break;
        case '*': printf("= %g\\n", a * b); break;
        case '/': b != 0 ? printf("= %g\\n", a / b) : printf("Can't divide by zero\\n"); break;
        default: printf("Unknown operator\\n");
    }
    return 0;
}
'''), ["calculator in c","c calculator program","calculator program in c","simple calculator in c"])
add("How do I write Hello World in C++?", code("cpp", '''
#include <iostream>
using namespace std;

int main() {
    string name;
    cout << "Your name: ";
    cin >> name;
    cout << "Hello, " << name << "!" << endl;
    return 0;
}
''') + "\nCompile: `g++ hello.cpp -o hello`.", ["hello world in c++","c++ program","first c++ program","cpp hello world","input in c++"])
add("How do vectors work in C++?", code("cpp", '''
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v = {5, 2, 9};
    v.push_back(1);
    sort(v.begin(), v.end());
    for (int x : v) cout << x << " ";   // 1 2 5 9
    cout << "\\nsize " << v.size() << endl;
}
'''), ["vector in c++","c++ vector","stl in c++","c++ array"])

# ---------- SQL ----------
add("What are the basic SQL commands?", code("sql", '''
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, marks INTEGER);
INSERT INTO students (name, marks) VALUES ('Asha', 91), ('Ravi', 72);
SELECT * FROM students;
SELECT name FROM students WHERE marks > 80 ORDER BY marks DESC;
UPDATE students SET marks = 75 WHERE name = 'Ravi';
DELETE FROM students WHERE id = 2;
'''), ["sql commands","sql basics","sql queries","select query","basic sql","what is sql"])
add("How do SQL joins work?", "A JOIN combines rows from tables using a matching column:\n" + code("sql", '''
-- students(id, name), marks(student_id, subject, score)
SELECT s.name, m.subject, m.score
FROM students s
INNER JOIN marks m ON m.student_id = s.id;     -- only matching rows

SELECT s.name, m.score
FROM students s
LEFT JOIN marks m ON m.student_id = s.id;      -- every student, even with no marks
''') + "\nINNER = only matches; LEFT = all from the left table; RIGHT = all from the right; FULL = all from both.", ["sql join","joins in sql","inner join","left join","types of joins"])
add("How does GROUP BY work in SQL?", code("sql", '''
SELECT class, COUNT(*) AS students, AVG(marks) AS average
FROM students
GROUP BY class
HAVING AVG(marks) > 60        -- filter groups (WHERE filters rows)
ORDER BY average DESC;
'''), ["group by in sql","sql group by","having vs where","aggregate functions sql"])
add("What is the difference between SQL and NoSQL?", "SQL databases (MySQL, PostgreSQL, SQLite) store data in tables with fixed columns and use SQL queries and joins. NoSQL databases (Firestore, MongoDB) store flexible documents or key–value data, scale easily, and suit changing data. MK.ai uses Firestore, a NoSQL database.", ["sql vs nosql","nosql","what is mongodb","relational database"])

# ---------- Git ----------
add("What are the basic git commands?", code("bash", '''
git init                      # start a repository
git clone <url>               # copy one from GitHub
git status                    # what changed
git add .                     # stage all changes
git commit -m "Add login page"
git push                      # upload to GitHub
git pull                      # download others' changes
git branch feature            # new branch
git checkout feature          # switch (or: git switch feature)
git merge feature             # merge into current branch
git log --oneline             # history
'''), ["git commands","basic git commands","git tutorial","how to use git","git push","git commit"])
add("How do I host a website for free on GitHub Pages?", "Use GitHub Pages: 1) Create a repository on github.com and upload your `index.html` (Add file → Upload files). 2) Go to Settings → Pages. 3) Under \"Branch\", pick `main` and `/ (root)`, then Save. 4) After a minute your site is live at `https://<your-username>.github.io/<repo-name>/`. That's exactly how MK.ai is hosted!", ["github pages","host website free","deploy website","publish website","how to host a website","free website hosting"])

# ---------- Concepts, DSA ----------
add("What is recursion?", "Recursion is when a function calls itself on a smaller version of the problem, with a base case to stop:\n" + PY('''
def countdown(n):
    if n == 0:          # base case
        print("Go!")
        return
    print(n)
    countdown(n - 1)    # smaller problem

def power(x, n):
    return 1 if n == 0 else x * power(x, n - 1)
'''), ["define recursion","recursion in programming","recursive function","recursion example"])
add("What are the four pillars of OOP?", "The four pillars of object-oriented programming:\n- **Encapsulation**: keeping data and the code that uses it together, and hiding details (private fields).\n- **Abstraction**: showing only what's needed (a `send()` method, not how it works inside).\n- **Inheritance**: a class reusing another (a `Dog` is an `Animal`).\n- **Polymorphism**: the same method name behaving differently per class (`speak()` barks or meows).", ["oops concepts","pillars of oop","object oriented programming","what is oop","encapsulation abstraction inheritance polymorphism","oops"])
add("What is Big O notation?", "Big O describes how an algorithm's time (or memory) grows with input size n:\n- O(1) constant: array index\n- O(log n): binary search\n- O(n): a single loop\n- O(n log n): merge sort, quick sort (average)\n- O(n²): nested loops, bubble sort\n- O(2ⁿ): trying every subset\nSmaller growth means faster for big inputs.", ["big o","time complexity","big o notation","space complexity","complexity of algorithms"])
add("How does binary search work?", "Binary search finds an item in a **sorted** list by halving the search range each time: O(log n).\n" + PY('''
def binary_search(items, target):
    lo, hi = 0, len(items) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1

print(binary_search([2, 5, 8, 12, 16, 23, 38], 23))   # 5
'''), ["binary search","binary search algorithm","binary search in python"])
add("How does bubble sort work?", "Bubble sort repeatedly swaps neighbours that are in the wrong order; the biggest 'bubbles' to the end each pass. It's O(n²).\n" + PY('''
def bubble_sort(a):
    n = len(a)
    for i in range(n - 1):
        swapped = False
        for j in range(n - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break
    return a

print(bubble_sort([5, 1, 4, 2, 8]))   # [1, 2, 4, 5, 8]
'''), ["bubble sort","bubble sort algorithm","bubble sort in python","sorting algorithms"])
add("How does merge sort work?", "Merge sort splits the list in half, sorts each half, then merges them: O(n log n).\n" + PY('''
def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    left, right = merge_sort(a[:mid]), merge_sort(a[mid:])
    out, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            out.append(left[i]); i += 1
        else:
            out.append(right[j]); j += 1
    return out + left[i:] + right[j:]

print(merge_sort([38, 27, 43, 3, 9, 82, 10]))
'''), ["merge sort","merge sort algorithm","merge sort in python"])
add("How does quick sort work?", "Quick sort picks a pivot, puts smaller items left and bigger right, then sorts each side: O(n log n) on average.\n" + PY('''
def quick_sort(a):
    if len(a) <= 1:
        return a
    pivot = a[len(a) // 2]
    return (quick_sort([x for x in a if x < pivot])
            + [x for x in a if x == pivot]
            + quick_sort([x for x in a if x > pivot]))

print(quick_sort([10, 7, 8, 9, 1, 5]))
'''), ["quick sort","quicksort","quick sort algorithm","quick sort in python"])
add("What is a stack and a queue?", "A **stack** is Last-In-First-Out (like plates): push and pop from the top. A **queue** is First-In-First-Out (like a line): add at the back, remove from the front.\n" + PY('''
stack = []
stack.append(1); stack.append(2)
print(stack.pop())        # 2

from collections import deque
queue = deque()
queue.append("a"); queue.append("b")
print(queue.popleft())    # a
'''), ["stack data structure","queue data structure","stack and queue","lifo and fifo","stack vs queue"])
add("What is a linked list?", "A linked list is a chain of nodes, each holding a value and a link to the next. Adding/removing at the front is O(1), but finding an item is O(n).\n" + PY('''
class Node:
    def __init__(self, value, next=None):
        self.value, self.next = value, next

head = Node(1, Node(2, Node(3)))
node = head
while node:
    print(node.value)
    node = node.next
'''), ["linked list","linked list in python","singly linked list"])
add("What is a binary tree?", "A binary tree is a structure where each node has up to two children (left and right). In a binary search tree, left < node < right, so searching is fast (O(log n) when balanced). Traversals: inorder (left, node, right), preorder and postorder.", ["binary tree","binary search tree","bst","tree data structure","tree traversal"])
add("What is a hash table?", "A hash table (Python dict, JavaScript object/Map) stores key–value pairs, using a hash function to jump straight to a key's slot, so lookups are O(1) on average.", ["hash table","hashmap","hash map","hashing"])
add("What is a graph in data structures?", "A graph is nodes (vertices) connected by edges, like cities and roads. Explore with BFS (level by level, using a queue; finds shortest paths in unweighted graphs) or DFS (go deep first, using a stack or recursion). Dijkstra's algorithm finds shortest paths with weights.", ["graph data structure","bfs and dfs","breadth first search","depth first search","dijkstra algorithm"])
add("What is dynamic programming?", "Dynamic programming solves a problem by breaking it into overlapping smaller problems and saving (memoising) their answers so each is solved once:\n" + PY('''
from functools import lru_cache

@lru_cache(None)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(100))   # instant, thanks to saved results
'''), ["dynamic programming","memoization","dp in programming"])
add("What are data structures and algorithms?", "Data structures are ways to organise data (arrays, linked lists, stacks, queues, hash tables, trees, graphs). Algorithms are step-by-step methods to solve problems with them (searching, sorting, graph traversal, dynamic programming). Together (DSA) they're the core of coding interviews.", ["dsa","data structures","what is dsa","data structures and algorithms"])

# ---------- General / career ----------
add("What is the difference between a compiler and an interpreter?", "A compiler translates the whole program into machine code before running (C, C++, Rust → fast programs). An interpreter runs the code line by line (Python, JavaScript → easy to try things). Java compiles to bytecode that the JVM runs.", ["compiler vs interpreter","compiler and interpreter","what is a compiler","what is an interpreter"])
add("Which programming language should I learn first?", "For most beginners: **Python** (simple, readable, used for AI, data and automation) or **JavaScript** (runs in every browser; needed for websites and apps). Learn HTML and CSS alongside JavaScript for web. Later: Java or Kotlin (Android), C/C++ (how computers work, competitive programming), SQL (databases). Try MK.ai's Code School to start!", ["best programming language","which language to learn first","best language for beginners","what language should i learn","how to start coding"])
add("What is the difference between Python and JavaScript?", "Python: simple syntax with indentation, great for AI, data science, scripts and back ends. JavaScript: runs in browsers, needed for interactive websites, and also servers (Node.js). Both are beginner-friendly and in high demand.", ["python vs javascript","javascript vs python"])
add("What is the difference between Java and JavaScript?", "Despite the name, they're different languages. Java is compiled, strictly typed and used for Android apps and big back-end systems. JavaScript is a scripting language for web pages and Node.js. The similar name was a 1990s marketing idea.", ["java vs javascript","javascript vs java","is java and javascript same"])
add("What is a REST API?", "A REST API lets programs talk over HTTP using URLs and methods: GET (read), POST (create), PUT/PATCH (update), DELETE (remove). Data usually travels as JSON. Common status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Server Error.", ["rest api","http methods","get and post","http status codes","what is 404","api methods"])
add("What is JSON?", "JSON (JavaScript Object Notation) is a text format for data that almost every language understands:\n" + code("json", '''
{
  "name": "Priya",
  "age": 16,
  "subjects": ["maths", "science"],
  "passed": true
}
'''), ["json format","what is json file","json example"])
add("How do I build an Android app?", "Options:\n1. **Web app (easiest)**: build it in HTML/CSS/JavaScript, host it on GitHub Pages, and 'Add to Home screen' — or make it a PWA like MK.ai. Ask me to \"make a to-do app\" to start.\n2. **Kotlin + Android Studio**: Google's official way (free at developer.android.com).\n3. **Flutter** (Dart): one code base for Android and iPhone.\n4. **React Native**: JavaScript apps for Android and iPhone.", ["android app development","how to make an android app","make a mobile app","mobile app development","how to create an app"])
add("What is a PWA?", "A Progressive Web App is a website that works like an installed app: it can be added to the home screen, open full-screen and work offline (using a service worker and a manifest file). MK.ai is a PWA!", ["progressive web app","pwa","service worker"])
add("How do I debug my code?", "Debugging steps: 1) Read the error message: it says what went wrong and the line number. 2) Print values (`print()` / `console.log()`) to see what the code is really doing. 3) Test small pieces separately. 4) Check the usual suspects: spelling, missing brackets or quotes, wrong indentation, off-by-one in loops, using a variable before setting it. 5) Use the browser DevTools (F12) or a debugger to step through. 6) Explain the code line by line (rubber-duck debugging).", ["debugging","how to fix errors in code","debug code","debugging tips"])
add("What does IndentationError mean in Python?", "Python uses indentation to group code. IndentationError means the spaces are wrong: a missing indent after `if`/`for`/`def` (they end with `:`), or mixing tabs and spaces. Use 4 spaces per level:\n" + PY('''
if True:
    print("indented with 4 spaces")   # correct
'''), ["indentationerror","indentation error python","expected an indented block"])
add("What does NameError mean in Python?", "NameError: a name isn't defined. Usually a typo (`pritn`), using a variable before giving it a value, or forgetting quotes around text (`print(hello)` instead of `print(\"hello\")`).", ["nameerror","name error python","is not defined python"])
add("What does TypeError mean?", "A TypeError means an operation got the wrong kind of value, e.g. adding text and a number in Python (`\"Age: \" + 5`). Fix it by converting: `\"Age: \" + str(5)` or use an f-string. In JavaScript, \"x is not a function\" means you called something that isn't a function (often a typo or a missing import).", ["typeerror","type error","is not a function","can only concatenate str"])
add("What does SyntaxError mean?", "A SyntaxError means the code breaks the language's grammar: a missing bracket, quote, colon or comma, or a misspelt keyword. Look at the line shown and the one just before it.", ["syntaxerror","syntax error","invalid syntax"])
add("What is undefined vs null in JavaScript?", "`undefined` means a variable has no value yet (or a property doesn't exist). `null` is set on purpose to mean 'nothing'. \"Cannot read properties of undefined\" means you used `.something` on a value that is undefined: check it exists first, e.g. `user?.name`.", ["undefined vs null","cannot read properties of undefined","null and undefined"])
add("What is an IDE?", "An IDE (integrated development environment) is an app for writing code with helpers like auto-complete, error highlighting and a debugger. Popular free ones: VS Code (any language), PyCharm Community (Python), IntelliJ IDEA Community / Android Studio (Java, Kotlin). On a tablet: Replit or Pydroid 3.", ["ide","best code editor","vs code","code editor","what is vs code"])
add("How can I practise coding?", "Great free places: MK.ai's Code School (learn.html), freeCodeCamp (web development), HackerRank and LeetCode (problems), CS50 by Harvard (free course), and building small projects: a to-do app, calculator, quiz or your own portfolio. Build something every week!", ["practice coding","where to learn coding","coding practice websites","learn programming free","coding websites"])
save("coding", "Coding and app development", C)
