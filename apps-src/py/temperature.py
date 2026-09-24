# Temperature converter
def c_to_f(c):
    return c * 9 / 5 + 32


def f_to_c(f):
    return (f - 32) * 5 / 9


choice = input("Convert (1) Celsius → Fahrenheit or (2) Fahrenheit → Celsius? ")
value = float(input("Temperature: "))
if choice == "1":
    print(f"{value}°C = {c_to_f(value):.2f}°F")
else:
    print(f"{value}°F = {f_to_c(value):.2f}°C")
