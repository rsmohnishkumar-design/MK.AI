# Simple calculator: keeps going until you type q
def calculate(a, op, b):
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op in ("*", "x"):
        return a * b
    if op == "/":
        if b == 0:
            raise ZeroDivisionError("can't divide by zero")
        return a / b
    if op == "%":
        return a % b
    if op in ("^", "**"):
        return a ** b
    raise ValueError(f"unknown operator {op}")


print("Calculator — type a sum like: 12 * 7   (q to quit)")
while True:
    text = input("> ").strip()
    if text.lower() in ("q", "quit", "exit"):
        print("Bye!")
        break
    try:
        a, op, b = text.split()
        result = calculate(float(a), op, float(b))
        print("=", int(result) if result == int(result) else round(result, 10))
    except ZeroDivisionError as err:
        print("Error:", err)
    except ValueError:
        print("Please type: number operator number, e.g. 5 + 3")
