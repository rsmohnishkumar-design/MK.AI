# Calculator with a window (Tkinter comes with Python)
import tkinter as tk

root = tk.Tk()
root.title("Calculator")
expr = tk.StringVar()

entry = tk.Entry(root, textvariable=expr, font=("Arial", 24), justify="right", bd=8)
entry.grid(row=0, column=0, columnspan=4, sticky="nsew")


def press(key):
    if key == "C":
        expr.set("")
    elif key == "=":
        text = expr.get()
        # allow only numbers and + - * / . ( )
        if text and all(c in "0123456789+-*/.() " for c in text):
            try:
                expr.set(str(eval(text)))
            except Exception:
                expr.set("Error")
    else:
        expr.set(expr.get() + key)


keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "C", "0", "=", "+"]
for i, key in enumerate(keys):
    tk.Button(root, text=key, font=("Arial", 20), width=4, height=2,
              command=lambda k=key: press(k)).grid(row=1 + i // 4, column=i % 4, sticky="nsew")

root.mainloop()
