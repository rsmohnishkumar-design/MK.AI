# Bank account with classes (object-oriented programming)
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance
        self.history = []

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("Deposit must be positive")
        self.balance += amount
        self.history.append(f"+{amount}")

    def withdraw(self, amount):
        if amount > self.balance:
            raise ValueError("Not enough money")
        self.balance -= amount
        self.history.append(f"-{amount}")

    def __str__(self):
        return f"{self.owner}'s account: ₹{self.balance}"


class SavingsAccount(BankAccount):          # inheritance: a savings account IS a bank account
    def __init__(self, owner, balance=0, rate=0.04):
        super().__init__(owner, balance)
        self.rate = rate

    def add_interest(self):
        interest = round(self.balance * self.rate, 2)
        self.deposit(interest)
        return interest


acc = SavingsAccount("Priya", 1000)
acc.deposit(500)
acc.withdraw(200)
print(acc)                                  # Priya's account: ₹1300
print("Interest added:", acc.add_interest())
print(acc, "| history:", acc.history)
try:
    acc.withdraw(10**6)
except ValueError as err:
    print("Error:", err)
