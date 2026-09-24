# Builds data/apps.json from the tested app templates in html/ and py/.
# Run after editing a template: python3 apps-src/bundle.py
import json, os
D = os.path.dirname(os.path.abspath(__file__))
# id, file, title, names people use, what it does, how to use
H = [
 ("calculator","calculator.html","Calculator",["calculator","calc"],"A calculator with + − × ÷ and %, a backspace key and keyboard support."),
 ("todo","todo.html","To-Do List",["to do","todo","to-do","task list","task manager","checklist","task app"],"Add tasks, tap to tick them off, delete them. Tasks are saved in the browser."),
 ("stopwatch","stopwatch.html","Stopwatch",["stopwatch","stop watch","lap timer"],"Start, pause, lap and reset, accurate to 1/100 s."),
 ("clock","clock.html","Digital Clock",["clock","digital clock","time display"],"Shows the time, date and a greeting, updating every second."),
 ("countdown","countdown.html","Countdown Timer",["countdown","timer","count down","alarm timer"],"Set minutes and seconds; it beeps when time's up."),
 ("quiz","quiz.html","Quiz App",["quiz","mcq","trivia","question and answer game","exam app"],"Multiple-choice questions with scoring. Edit the questions list to make your own quiz."),
 ("tictactoe","tictactoe.html","Tic-Tac-Toe",["tic tac toe","tictactoe","noughts and crosses","x and o","xo game"],"Play against a friend or a computer that blocks and wins."),
 ("guess","guess.html","Number Guessing Game",["guessing game","guess the number","number guessing","guess game"],"Guess a number from 1 to 100 with higher/lower hints."),
 ("rps","rps.html","Rock Paper Scissors",["rock paper scissors","rock paper scissor","stone paper scissors"],"Play against the computer and keep score."),
 ("bmi","bmi.html","BMI Calculator",["bmi","body mass index"],"Enter weight and height to get BMI and category."),
 ("notes","notes.html","Notes App",["notes","note taking","notepad","note app","diary","journal"],"Write, search and delete notes, saved in the browser."),
 ("snake","snake.html","Snake Game",["snake"],"The classic snake game with keyboard, buttons and swipe controls."),
 ("memory","memory.html","Memory Card Game",["memory game","matching game","card matching","memory card","concentration game"],"Flip cards to find matching pairs in as few moves as you can."),
 ("password","password.html","Password Generator",["password generator","password maker","random password","strong password"],"Makes strong random passwords with a length slider and options."),
 ("converter","converter.html","Unit Converter",["unit converter","converter","conversion app","measurement converter"],"Converts length, weight, time, volume and temperature."),
 ("expenses","expenses.html","Expense Tracker",["expense tracker","expense","budget","money tracker","spending tracker","finance tracker","income and expense"],"Track income and spending in ₹ with a running balance."),
 ("portfolio","portfolio.html","Portfolio Website",["portfolio","personal website","resume website","my website","personal site","profile page"],"A personal website with about, skills, projects and contact sections."),
 ("landing","landing.html","Landing Page",["landing page","product page","startup website","business website","home page for my product","marketing page"],"A product landing page with a hero, features and a sign-up section."),
 ("weather","weather.html","Weather App",["weather"],"Search any city for live weather using the free Open-Meteo service (no key needed)."),
 ("dice","dice.html","Dice Roller",["dice","die roller","roll dice"],"Roll 1 to 3 dice with an animation and total."),
 ("typing","typing.html","Typing Speed Test",["typing test","typing speed","typing game","wpm test","typing practice"],"Measures words per minute and accuracy as you type."),
 ("counter","counter.html","Counter App",["counter","click counter","tally counter"],"Plus, minus and reset buttons with a coloured count."),
 ("drawing","drawing.html","Drawing App",["drawing","paint","sketch","whiteboard","draw app","painting"],"Draw with mouse, finger or stylus; choose colours, eraser, and save as a picture."),
 ("age","age.html","Age Calculator",["age calculator","age finder","birthday calculator"],"Works out your exact age and days to your next birthday."),
 ("flashcards","flashcards.html","Flashcards",["flashcards","flash cards","study cards","revision cards"],"Tap cards to flip them; add your own questions."),
 ("colors","colors.html","Color Palette Generator",["color palette","colour palette","color generator","colour generator","random color","random colour"],"Makes random 5-colour palettes; tap to copy a colour code."),
 ("login","login.html","Login Page",["login","log in","sign in","signin","login form","login page"],"A login form with validation and show-password (connect Firebase Auth for real logins)."),
 ("tables","tables.html","Multiplication Tables",["multiplication table","times table","tables app","maths tables"],"Shows any times table and quizzes you."),
 ("piano","piano.html","Piano",["piano","keyboard instrument","music keyboard"],"A playable piano with sound (tap or use your keyboard)."),
 ("pomodoro","pomodoro.html","Pomodoro Study Timer",["pomodoro","study timer","focus timer"],"25-minute focus sessions with 5- and 15-minute breaks."),
 ("hangman","hangman.html","Hangman",["hangman","word guessing","guess the word"],"Guess the word letter by letter with 6 lives."),
 ("goldengate","goldengate.html","Oracle GoldenGate Simulator",["goldengate","golden gate","oracle golden gate","oracle goldengate","ogg","replication simulator","database replication","cdc simulator","change data capture"],"Simulates Oracle GoldenGate replication: change rows in a source database and watch Extract → Data Pump → Replicat copy them to the target, with a GGSCI console (INFO ALL, START/STOP, STATS, LAG) and an out-of-sync ABEND you can fix with SKIPTRANSACTION."),
 ("starter","_starter.html","Starter App",[],"A starter app with a dashboard, an item list and an activity log."),
 ("webpage","webpage.html","Simple Web Page",["web page","webpage","html page","website","basic website","simple website","first website","html website"],"A starter page showing headings, a list, a table, a link and a button."),
]
P = [
 ("calculator","calculator.py","Python Calculator",["calculator","calc"],"A terminal calculator that handles + − × ÷ % and powers, and errors like dividing by zero."),
 ("guess","guess.py","Python Number Guessing Game",["guessing game","guess the number","number guessing","guess game"],"Guess a random number with higher/lower hints."),
 ("rps","rps.py","Python Rock Paper Scissors",["rock paper scissors","rock paper scissor","stone paper scissors"],"Play against the computer and keep score."),
 ("tictactoe","tictactoe.py","Python Tic-Tac-Toe",["tic tac toe","tictactoe","noughts and crosses","x and o","xo game"],"Two players take turns in the terminal."),
 ("todo","todo.py","Python To-Do List",["to do","todo","to-do","task list","task manager"],"A to-do list saved to todo.json between runs."),
 ("password","password.py","Python Password Generator",["password generator","password maker","random password","strong password"],"Strong passwords using the secrets module."),
 ("hangman","hangman.py","Python Hangman",["hangman","word guessing","guess the word"],"Guess the word letter by letter."),
 ("quiz","quiz.py","Python Quiz",["quiz","mcq","trivia"],"Multiple-choice quiz with a final score."),
 ("bank","bank.py","Python Bank Account (OOP)",["bank","bank account","atm","banking system","oop example","class example"],"Classes, inheritance and errors with deposit, withdraw and interest."),
 ("grades","grades.py","Python Student Marks Manager",["student marks","grade calculator","student management","marks","report card","student grades"],"Averages, grades and the topper for a class."),
 ("contacts","contacts.py","Python Contact Book",["contact book","phone book","contacts","address book","phonebook"],"Add, search, list and delete contacts, saved to a file."),
 ("tk_calculator","tk_calculator.py","Python Calculator with a Window (Tkinter)",["gui calculator","tkinter calculator","calculator gui","window calculator"],"A clickable calculator window using Tkinter."),
 ("temperature","temperature.py","Python Temperature Converter",["temperature converter","celsius to fahrenheit","fahrenheit to celsius"],"Converts between Celsius and Fahrenheit."),
]
out = []
for lang, rows, sub in [("html", H, "html"), ("python", P, "py")]:
    for id_, f, title, names, about in rows:
        code = open(os.path.join(D, sub, f)).read().rstrip() + "\n"
        out.append({"id": id_, "lang": lang, "title": title, "names": names, "about": about, "file": f, "code": code})
dest = os.path.join(D, "..", "data", "apps.json")
json.dump({"apps": out}, open(dest, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "apps,", os.path.getsize(dest)//1024, "KB")
