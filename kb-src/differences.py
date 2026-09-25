from common import save

# (A, B, points for A, points for B, one-line summary)
D = [
("speed", "velocity", ["how fast something moves", "has size only (a scalar)", "unit m/s"], ["how fast and in which direction", "has size and direction (a vector)", "unit m/s; can be negative or zero on a round trip"], "Speed tells how fast; velocity tells how fast and which way."),
("distance", "displacement", ["the total path travelled", "a scalar, always positive"], ["the straight-line gap from start to finish, with direction", "a vector; can be zero if you return to the start"], "Walk 5 m forward and 5 m back: distance 10 m, displacement 0."),
("heat", "temperature", ["the total energy that flows from hot to cold", "measured in joules (J)", "depends on the amount of substance"], ["how hot or cold something is (average energy of particles)", "measured in °C or kelvin", "doesn't depend on the amount"], "A bucket of warm water has more heat than a cup of boiling water, but a lower temperature."),
("acid", "base", ["sour taste", "turns blue litmus red", "pH below 7", "gives H⁺ ions in water; e.g. lemon juice, vinegar, HCl"], ["bitter taste, soapy feel", "turns red litmus blue", "pH above 7", "gives OH⁻ ions in water; e.g. soap, baking soda, NaOH"], "Acid + base → salt + water (neutralisation)."),
("metals", "non-metals", ["shiny (lustrous)", "good conductors of heat and electricity", "malleable and ductile", "mostly solid; e.g. iron, copper, gold"], ["dull (except iodine and graphite)", "poor conductors (except graphite)", "brittle when solid", "can be solid, liquid or gas; e.g. oxygen, carbon, sulphur"], "Mercury is a liquid metal; bromine is a liquid non-metal."),
("physical change", "chemical change", ["no new substance is formed", "usually reversible", "e.g. melting ice, tearing paper, dissolving sugar"], ["a new substance is formed", "usually irreversible", "e.g. burning, rusting, cooking, curdling of milk"], "Signs of a chemical change: gas, colour change, heat or light, a new smell."),
("element", "compound", ["made of only one kind of atom", "can't be broken into simpler substances by chemical means", "e.g. oxygen (O), iron (Fe)"], ["two or more elements chemically joined in a fixed ratio", "can be broken down by chemical reactions", "e.g. water (H₂O), salt (NaCl)"], "Water is a compound of the elements hydrogen and oxygen."),
("compound", "mixture", ["elements joined chemically in a fixed ratio", "properties differ from its parts", "separated only by chemical means"], ["substances just mixed, in any ratio", "each part keeps its own properties", "separated by physical means (filtering, evaporation, magnet)"], "Salt is a compound; salt water is a mixture."),
("atom", "molecule", ["the smallest particle of an element", "e.g. one O atom"], ["two or more atoms joined together", "e.g. O₂ (oxygen gas), H₂O (water)"], "Molecules are built from atoms."),
("isotopes", "isobars", ["same element, same atomic number (protons)", "different mass number (neutrons)", "e.g. carbon-12 and carbon-14"], ["different elements, different atomic numbers", "same mass number", "e.g. argon-40 and calcium-40"], "IsoTOPes: same place in the periodic table; isoBARs: same weight."),
("conductor", "insulator", ["lets electricity or heat pass easily", "e.g. copper, aluminium, silver, graphite"], ["does not let electricity or heat pass easily", "e.g. rubber, plastic, wood, glass"], "Wires are copper (conductor) covered in plastic (insulator)."),
("series circuit", "parallel circuit", ["one path for current", "if one bulb fails, all go off", "total resistance adds up: R = R₁ + R₂"], ["several paths for current", "if one bulb fails, others stay on", "1/R = 1/R₁ + 1/R₂; used in house wiring"], "Homes use parallel wiring so each device works on its own."),
("reflection", "refraction", ["light bounces back from a surface", "happens at mirrors and shiny surfaces", "angle of incidence = angle of reflection"], ["light bends when it passes from one medium to another", "happens because light changes speed", "e.g. a pencil looks bent in water; lenses"], "Mirrors reflect; lenses refract."),
("evaporation", "boiling", ["happens at any temperature", "only at the surface", "slow, and causes cooling"], ["happens at a fixed temperature (boiling point; water 100 °C)", "throughout the liquid, with bubbles", "fast"], "Wet clothes dry by evaporation, not boiling."),
("weather", "climate", ["the condition of the air at a place for a short time (hours or days)", "changes quickly: sunny today, rainy tomorrow"], ["the average weather of a place over a long time (30+ years)", "changes very slowly"], "Weather is your mood today; climate is your personality."),
("rotation", "revolution", ["the Earth spinning on its own axis", "takes about 24 hours", "causes day and night"], ["the Earth moving around the Sun", "takes about 365¼ days", "with the tilted axis, causes the seasons"], "Rotation = spin; revolution = orbit."),
("arteries", "veins", ["carry blood away from the heart", "mostly oxygen-rich blood (except the pulmonary artery)", "thick, elastic walls; blood under high pressure"], ["carry blood back to the heart", "mostly oxygen-poor blood (except the pulmonary vein)", "thinner walls, with valves"], "Arteries → Away from the heart."),
("xylem", "phloem", ["carries water and minerals", "from the roots upward", "made of mostly dead cells"], ["carries food (sugar) made in the leaves", "up and down to all parts", "made of living cells"], "Xylem = water up; phloem = food around."),
("photosynthesis", "respiration", ["makes food (glucose) using sunlight", "takes in CO₂ and releases O₂", "only in green plants, in chloroplasts, in daylight"], ["breaks down food to release energy", "takes in O₂ and releases CO₂", "in all living cells, in mitochondria, day and night"], "They are opposite processes."),
("aerobic respiration", "anaerobic respiration", ["uses oxygen", "releases a lot of energy", "products: carbon dioxide and water"], ["no oxygen", "releases less energy", "products: lactic acid (in muscles) or alcohol and CO₂ (in yeast)"], "Cramps after hard exercise come from anaerobic respiration."),
("prokaryotic cell", "eukaryotic cell", ["no true nucleus (DNA floats in the cell)", "no membrane-bound organelles", "small and simple; e.g. bacteria"], ["has a true nucleus with a membrane", "has organelles like mitochondria", "larger; e.g. plant, animal and fungus cells"], "Pro = before, karyon = nucleus."),
("sexual reproduction", "asexual reproduction", ["two parents", "gametes (sperm and egg) join", "offspring are different from the parents"], ["one parent", "no gametes", "offspring are copies of the parent; e.g. budding in yeast, binary fission in amoeba"], "Sexual reproduction brings variety."),
("vertebrates", "invertebrates", ["have a backbone", "e.g. fish, frogs, snakes, birds, mammals"], ["have no backbone", "e.g. insects, worms, snails, octopuses, jellyfish", "about 95% of all animal species"], "Humans are vertebrates."),
("herbivores", "carnivores", ["eat only plants", "flat teeth for grinding", "e.g. cow, deer, elephant"], ["eat other animals", "sharp teeth for tearing", "e.g. lion, tiger, eagle"], "Omnivores, like humans and bears, eat both."),
("input devices", "output devices", ["send data into the computer", "e.g. keyboard, mouse, microphone, scanner, camera"], ["show or give out results from the computer", "e.g. monitor, printer, speaker, projector"], "A touchscreen is both."),
("primary memory", "secondary memory", ["main memory the CPU uses directly", "fast, smaller, usually temporary (RAM)", "e.g. RAM, cache, ROM"], ["storage for keeping data long-term", "slower, larger, permanent", "e.g. hard disk, SSD, pen drive"], "Turning off the computer clears RAM but not the SSD."),
("internet", "World Wide Web", ["a global network of connected computers", "the roads", "carries email, video calls, games and the web"], ["a collection of web pages linked together", "the traffic on the roads", "invented by Tim Berners-Lee in 1989"], "The web is one service that runs on the internet."),
("LAN", "WAN", ["Local Area Network", "covers a home, school or office", "fast and cheap"], ["Wide Area Network", "covers cities, countries or the world", "the internet is the biggest WAN"], "Your school's computer lab is a LAN."),
("virus", "worm", ["computer malware that attaches to a file or program", "needs a person to run it to spread"], ["malware that spreads by itself over a network", "doesn't need a host file"], "Both are malware; antivirus and updates protect against them."),
("Lok Sabha", "Rajya Sabha", ["House of the People (lower house)", "members directly elected by voters", "up to 550 elected seats (543 today)", "5-year term; can be dissolved", "money bills start here"], ["Council of States (upper house)", "members elected by state assemblies", "up to 250 members (12 nominated)", "permanent; one-third retire every 2 years", "chaired by the Vice-President"], "Together with the President, they form India's Parliament."),
("President", "Prime Minister", ["head of the state", "elected indirectly by MPs and MLAs", "mostly a formal role; acts on the Cabinet's advice", "supreme commander of the armed forces"], ["head of the government", "leader of the majority in the Lok Sabha", "runs the country with the Council of Ministers"], "The President appoints the Prime Minister."),
("fundamental rights", "fundamental duties", ["rights the Constitution guarantees to people (Part III)", "six rights, e.g. equality, freedom, against exploitation", "can be enforced in court"], ["duties of every citizen (Part IV-A, Article 51A)", "eleven duties, e.g. respect the flag, protect the environment", "added in 1976; not enforceable in court"], "Rights and duties go together."),
("democracy", "dictatorship", ["people choose the government in elections", "freedom of speech and a free press", "power is limited by a constitution"], ["one person or group holds all power", "no free elections", "opposition and free speech are often punished"], "India is the world's largest democracy."),
("import", "export", ["buying goods from other countries", "e.g. India imports crude oil"], ["selling goods to other countries", "e.g. India exports software services, medicines and rice"], "Exports bring money in; imports send money out."),
("simile", "metaphor", ["compares using 'like' or 'as'", "e.g. 'as brave as a lion'"], ["says one thing IS another, without 'like' or 'as'", "e.g. 'He is a lion in battle'"], "Both are figures of speech that compare."),
("affect", "effect", ["usually a verb: to influence", "e.g. 'The rain affected the match.'"], ["usually a noun: a result", "e.g. 'The rain had an effect on the match.'"], "Affect = action (verb); effect = end result (noun)."),
("then", "than", ["about time or order", "e.g. 'Finish your homework, then play.'"], ["used to compare", "e.g. 'She is taller than me.'"], ""),
("lend", "borrow", ["to give something for a while", "e.g. 'Can you lend me a pen?'"], ["to take something for a while", "e.g. 'Can I borrow your pen?'"], ""),
("weather", "season", ["short-term conditions: today's rain, heat or wind"], ["a long part of the year with typical weather", "India's seasons: winter, summer, monsoon and post-monsoon (autumn)"], ""),
("renewable energy", "non-renewable energy", ["from sources that are refilled naturally", "e.g. solar, wind, water (hydro), biomass", "cleaner, little pollution"], ["from sources that run out", "e.g. coal, petroleum, natural gas", "cause pollution and global warming"], "India aims for 500 GW of non-fossil power capacity by 2030."),
]

def entries():
    out = []
    for a, b, pa, pb, tip in D:
        q = f"What is the difference between {a} and {b}?"
        body = f"**{a[0].upper() + a[1:]}**\n" + "\n".join(f"- {x}" for x in pa) + f"\n\n**{b[0].upper() + b[1:]}**\n" + "\n".join(f"- {x}" for x in pb)
        if tip:
            body += f"\n\n💡 {tip}"
        la, lb = a.lower(), b.lower()
        alts = [f"difference between {la} and {lb}", f"{la} vs {lb}", f"{la} and {lb} difference", f"compare {la} and {lb}",
                f"difference between {lb} and {la}", f"{lb} vs {la}"]
        # "speed vs velocity" and "compound vs mixture" already have answers elsewhere
        if (la, lb) in [("speed", "velocity"), ("compound", "mixture")]:
            alts = [x for x in alts if " vs " not in x]
        out.append((q, body, alts))
    return out

save("differences", "Differences between things", entries())
