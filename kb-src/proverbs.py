from common import save

P = [
("A stitch in time saves nine", "Fixing a small problem early stops it from becoming a big one."),
("Actions speak louder than words", "What you do shows more about you than what you say."),
("All that glitters is not gold", "Something that looks attractive may not be valuable or good."),
("An apple a day keeps the doctor away", "Eating healthy food every day keeps you well."),
("Better late than never", "Doing something late is better than not doing it at all."),
("Birds of a feather flock together", "People with similar interests or character spend time together."),
("Don't count your chickens before they hatch", "Don't rely on something good happening until it actually happens."),
("Don't judge a book by its cover", "Don't judge someone or something only by how it looks."),
("Early to bed and early to rise makes a man healthy, wealthy and wise", "Good sleep habits lead to a healthy, successful life."),
("Every cloud has a silver lining", "Something good can come out of every bad situation."),
("Honesty is the best policy", "Telling the truth is always the wisest choice."),
("Practice makes perfect", "Doing something again and again makes you very good at it."),
("Rome was not built in a day", "Great things take time and patience."),
("Slow and steady wins the race", "Working steadily and carefully succeeds more than rushing (from the tortoise and the hare story)."),
("The pen is mightier than the sword", "Ideas and writing can change the world more than violence."),
("Too many cooks spoil the broth", "When too many people try to manage one job, it goes wrong."),
("Where there is a will, there is a way", "If you are determined, you will find a way to succeed."),
("A friend in need is a friend indeed", "A true friend is one who helps you when you are in trouble."),
("Knowledge is power", "Knowing things gives you the ability to do and change more."),
("Look before you leap", "Think carefully before you act."),
("Empty vessels make the most noise", "People who know the least often talk the most."),
("Cleanliness is next to godliness", "Being clean is very important, almost a virtue."),
("Time and tide wait for none", "Time keeps moving, so don't waste it or delay."),
("Unity is strength", "People working together are stronger than people alone."),
("Necessity is the mother of invention", "When we really need something, we find creative ways to make it."),
("Health is wealth", "Good health is more valuable than money."),
("Two heads are better than one", "Two people solving a problem together do better than one alone."),
("When in Rome, do as the Romans do", "Follow the customs of the place you are in."),
("Curiosity killed the cat", "Being too curious can get you into trouble."),
("The early bird catches the worm", "People who start early get the best chances."),
("Out of sight, out of mind", "We tend to forget things or people we don't see."),
("Barking dogs seldom bite", "People who make loud threats rarely act on them."),
("Make hay while the sun shines", "Make good use of an opportunity while it lasts."),
("Strike while the iron is hot", "Act quickly while the chance is there."),
("You reap what you sow", "What happens to you depends on what you did before; good actions bring good results."),
("Charity begins at home", "Take care of your own family first, then help others."),
("A bad workman blames his tools", "People who do poor work blame their equipment instead of themselves."),
("Many hands make light work", "A job is easier when many people help."),
("Prevention is better than cure", "It is better to stop a problem before it starts than to fix it later."),
("Where there is smoke, there is fire", "If there are signs of a problem, there probably is one."),
]

def entries():
    out = []
    for p, meaning in P:
        k = p.lower().replace("'", "").replace(",", "")
        q = f'What does "{p}" mean?'
        a = f"**\"{p}.\"**\n\n**Meaning:** {meaning}"
        out.append((q, a, [k, f"meaning of {k}", f"what does {k} mean", f"{k} meaning", f"explain the proverb {k}"]))
    return out

save("proverbs", "Proverbs and their meanings", entries())
