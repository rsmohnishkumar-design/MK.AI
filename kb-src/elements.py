from common import save
EL = """1 H Hydrogen;2 He Helium;3 Li Lithium;4 Be Beryllium;5 B Boron;6 C Carbon;7 N Nitrogen;8 O Oxygen;9 F Fluorine;10 Ne Neon;
11 Na Sodium;12 Mg Magnesium;13 Al Aluminium;14 Si Silicon;15 P Phosphorus;16 S Sulfur;17 Cl Chlorine;18 Ar Argon;19 K Potassium;20 Ca Calcium;
21 Sc Scandium;22 Ti Titanium;23 V Vanadium;24 Cr Chromium;25 Mn Manganese;26 Fe Iron;27 Co Cobalt;28 Ni Nickel;29 Cu Copper;30 Zn Zinc;
31 Ga Gallium;32 Ge Germanium;33 As Arsenic;34 Se Selenium;35 Br Bromine;36 Kr Krypton;37 Rb Rubidium;38 Sr Strontium;39 Y Yttrium;40 Zr Zirconium;
41 Nb Niobium;42 Mo Molybdenum;43 Tc Technetium;44 Ru Ruthenium;45 Rh Rhodium;46 Pd Palladium;47 Ag Silver;48 Cd Cadmium;49 In Indium;50 Sn Tin;
51 Sb Antimony;52 Te Tellurium;53 I Iodine;54 Xe Xenon;55 Cs Caesium;56 Ba Barium;57 La Lanthanum;58 Ce Cerium;59 Pr Praseodymium;60 Nd Neodymium;
61 Pm Promethium;62 Sm Samarium;63 Eu Europium;64 Gd Gadolinium;65 Tb Terbium;66 Dy Dysprosium;67 Ho Holmium;68 Er Erbium;69 Tm Thulium;70 Yb Ytterbium;
71 Lu Lutetium;72 Hf Hafnium;73 Ta Tantalum;74 W Tungsten;75 Re Rhenium;76 Os Osmium;77 Ir Iridium;78 Pt Platinum;79 Au Gold;80 Hg Mercury;
81 Tl Thallium;82 Pb Lead;83 Bi Bismuth;84 Po Polonium;85 At Astatine;86 Rn Radon;87 Fr Francium;88 Ra Radium;89 Ac Actinium;90 Th Thorium;
91 Pa Protactinium;92 U Uranium;93 Np Neptunium;94 Pu Plutonium;95 Am Americium;96 Cm Curium;97 Bk Berkelium;98 Cf Californium;99 Es Einsteinium;100 Fm Fermium;
101 Md Mendelevium;102 No Nobelium;103 Lr Lawrencium;104 Rf Rutherfordium;105 Db Dubnium;106 Sg Seaborgium;107 Bh Bohrium;108 Hs Hassium;109 Mt Meitnerium;110 Ds Darmstadtium;
111 Rg Roentgenium;112 Cn Copernicium;113 Nh Nihonium;114 Fl Flerovium;115 Mc Moscovium;116 Lv Livermorium;117 Ts Tennessine;118 Og Oganesson"""
LATIN = {"Na":"natrium","K":"kalium","Fe":"ferrum","Cu":"cuprum","Ag":"argentum","Sn":"stannum","Sb":"stibium","W":"wolfram","Au":"aurum","Hg":"hydrargyrum","Pb":"plumbum"}
E = []
for part in EL.replace("\n","").split(";"):
    n, sym, name = part.strip().split(" ")
    latin = f" The symbol comes from its Latin name, {LATIN[sym]}." if sym in LATIN else ""
    alias = ["aluminum"] if name == "Aluminium" else ["sulphur"] if name == "Sulfur" else ["cesium"] if name == "Caesium" else []
    names = [name] + alias
    E.append((f"What is the chemical symbol of {name}?", f"The chemical symbol of {name} is {sym}.{latin}",
              [f"symbol of {x}" for x in names] + [f"{x} symbol" for x in names] + [f"chemical symbol for {x}" for x in names]))
    E.append((f"What is the atomic number of {name}?", f"The atomic number of {name} ({sym}) is {n}: it has {n} protons.",
              [f"atomic number of {x}" for x in names] + [f"{x} atomic number" for x in names]))
    E.append((f"Which element has atomic number {n}?", f"Element number {n} is {name} ({sym}).",
              [f"element with atomic number {n}", f"atomic number {n} element", f"element number {n}"]))
    if len(sym) <= 2 and sym.lower() not in ("i","b","c","n","o","f","k","p","s","u","v","w","y","at","be","in","as","no","he","is","am","me","my","by","do","of","on","or","to","it"):
        E.append((f"Which element has the symbol {sym}?", f"{sym} is the symbol of {name} (atomic number {n}).", [f"{sym} element", f"element {sym}", f"what is {sym} in chemistry"]))
E += [
("How many elements are there in the periodic table?","There are 118 known elements in the periodic table. 94 of them occur naturally.",["number of elements in periodic table","total elements"]),
("Who created the periodic table?","Dmitri Mendeleev, a Russian chemist, published the first widely accepted periodic table in 1869, arranging elements by atomic mass and leaving gaps for undiscovered elements. The modern table is arranged by atomic number.",["father of periodic table","who invented periodic table","mendeleev","who made the periodic table","who developed the periodic table","who gave the periodic table"]),
("What is the lightest element?","Hydrogen is the lightest element (atomic number 1).",["lightest element","first element"]),
("What is the heaviest naturally occurring element?","Uranium (atomic number 92) is the heaviest element found in large amounts in nature.",["heaviest natural element"]),
("Which metal is liquid at room temperature?","Mercury (Hg) is the only metal that is liquid at room temperature.",["liquid metal","metal liquid at room temperature"]),
("Which non-metal is liquid at room temperature?","Bromine (Br) is the only non-metal that is liquid at room temperature.",["liquid non metal"]),
("What are noble gases?","Noble gases are the group 18 elements: helium, neon, argon, krypton, xenon and radon (and oganesson). They are very unreactive because their outer shells are full.",["inert gases","group 18 elements","list of noble gases"]),
("What are alkali metals?","Alkali metals are group 1: lithium, sodium, potassium, rubidium, caesium and francium. They are soft and react strongly with water.",["group 1 elements","list of alkali metals"]),
("What are halogens?","Halogens are group 17: fluorine, chlorine, bromine, iodine and astatine (and tennessine). They are reactive non-metals.",["group 17 elements","list of halogens"]),
("What is the most abundant element in the universe?","Hydrogen is the most abundant element in the universe, followed by helium.",["most common element in universe"]),
("What is the most abundant element in the Earth's crust?","Oxygen is the most abundant element in the Earth's crust, followed by silicon and aluminium.",["most abundant element in earth crust"]),
("What is the most abundant metal in the Earth's crust?","Aluminium is the most abundant metal in the Earth's crust.",["most common metal in earth crust"]),
("What is the most abundant gas in the air?","Nitrogen makes up about 78% of air. Oxygen is about 21%, argon about 0.9% and carbon dioxide about 0.04%.",["composition of air","gases in air","percentage of oxygen in air","percentage of nitrogen in air"]),
("What is the hardest natural substance?","Diamond, a form of carbon, is the hardest natural substance.",["hardest substance","hardest material"]),
("What is the best conductor of electricity?","Silver is the best conductor of electricity, followed by copper, which is used in most wires because it is cheaper.",["best electrical conductor"]),
]
save("elements", "Periodic table", E)
