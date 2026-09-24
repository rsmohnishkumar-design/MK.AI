# Strong password generator (uses the secrets module, made for passwords)
import secrets
import string

length = int(input("Password length (e.g. 16): ") or 16)
chars = string.ascii_letters + string.digits + "!@#$%^&*()-_=+?"

# make sure it has at least one lowercase, uppercase, digit and symbol
while True:
    password = "".join(secrets.choice(chars) for _ in range(length))
    if (any(c.islower() for c in password) and any(c.isupper() for c in password)
            and any(c.isdigit() for c in password) and any(not c.isalnum() for c in password)):
        break

print("Your password:", password)
