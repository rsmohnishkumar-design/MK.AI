from common import save

# (day, date, why, extra alternative phrasings)
D = [
("World Health Day", "7 April", "It marks the founding of the World Health Organization in 1948; each year has a health theme.", []),
("World Book Day", "23 April", "UNESCO's day for books, reading and copyright; it is the day Shakespeare and Cervantes died (1616).", ["world book and copyright day"]),
("Labour Day", "1 May", "International Workers' Day (May Day) honours workers and the fight for the 8-hour working day. It is also Maharashtra Day and Gujarat Day.", ["may day", "workers day", "international labour day"]),
("Mother's Day", "the second Sunday of May", "A day to thank and honour mothers.", ["mothers day"]),
("Father's Day", "the third Sunday of June", "A day to thank and honour fathers.", ["fathers day"]),
("World No Tobacco Day", "31 May", "WHO's day to warn about the harm of tobacco.", []),
("World Oceans Day", "8 June", "A UN day to protect the oceans.", ["world ocean day"]),
("World Blood Donor Day", "14 June", "Thanks blood donors; it is the birthday of Karl Landsteiner, who discovered blood groups.", []),
("World Music Day", "21 June", "Fête de la Musique, first held in France in 1982; free music everywhere. It is also International Yoga Day.", []),
("National Doctors' Day in India", "1 July", "Honours doctors on the birth and death anniversary of Dr B. C. Roy, a great doctor and Chief Minister of West Bengal.", ["doctors day", "national doctors day"]),
("World Population Day", "11 July", "A UN day about population issues, started in 1989.", []),
("Friendship Day", "the first Sunday of August in India (the UN's International Day of Friendship is 30 July)", "A day to celebrate friends.", ["international friendship day"]),
("Hiroshima Day", "6 August", "Remembers the atomic bombing of Hiroshima, Japan, in 1945; Nagasaki was bombed on 9 August.", []),
("Quit India Day", "8 August", "Gandhi launched the Quit India Movement on 8 August 1942 (it began in earnest on 9 August, August Kranti Day).", ["quit india movement day", "august kranti day"]),
("Engineers' Day in India", "15 September", "The birthday of Sir M. Visvesvaraya, the great engineer and Bharat Ratna.", ["engineers day"]),
("Hindi Diwas", "14 September", "On this day in 1949 Hindi was adopted as an official language of the Union.", ["hindi day"]),
("International Day of Democracy", "15 September", "A UN day to promote democracy.", ["democracy day"]),
("World Tourism Day", "27 September", "A UN day to celebrate travel and tourism.", ["tourism day"]),
("World Food Day", "16 October", "Marks the founding of the UN's Food and Agriculture Organization (1945); about fighting hunger.", []),
("United Nations Day", "24 October", "The UN Charter came into force on this day in 1945.", ["un day"]),
("National Unity Day", "31 October", "Rashtriya Ekta Diwas, the birthday of Sardar Vallabhbhai Patel, who united the princely states.", ["rashtriya ekta diwas"]),
("National Education Day in India", "11 November", "The birthday of Maulana Abul Kalam Azad, India's first Education Minister.", ["national education day"]),
("World AIDS Day", "1 December", "Raises awareness of HIV and AIDS; the symbol is a red ribbon.", ["aids day"]),
("Armed Forces Flag Day", "7 December", "India honours its soldiers and collects money for their welfare.", ["flag day"]),
("Human Rights Day", "10 December", "The UN adopted the Universal Declaration of Human Rights on this day in 1948.", []),
("Vijay Diwas", "16 December", "India's victory in the 1971 war, when Bangladesh was born.", ["victory day india"]),
("National Farmers' Day in India", "23 December", "Kisan Diwas, the birthday of Chaudhary Charan Singh, former Prime Minister and farmers' leader.", ["kisan diwas", "farmers day"]),
("National Consumer Day in India", "24 December", "The Consumer Protection Act was passed on this day in 1986.", ["consumer day"]),
("Army Day in India", "15 January", "In 1949 General K. M. Cariappa became the first Indian Commander-in-Chief of the Army.", ["indian army day"]),
("National Girl Child Day in India", "24 January", "Promotes the rights and education of girls.", ["girl child day"]),
("National Voters' Day in India", "25 January", "The Election Commission was founded on this day in 1950.", ["voters day"]),
("Martyrs' Day in India", "30 January", "Shaheed Diwas: Mahatma Gandhi was killed on this day in 1948.", ["shaheed diwas", "martyrs day"]),
("World Cancer Day", "4 February", "Raises awareness about preventing and treating cancer.", ["cancer day"]),
("Valentine's Day", "14 February", "A day for love, named after Saint Valentine.", ["valentines day"]),
("International Mother Language Day", "21 February", "UNESCO's day for all the world's languages, remembering the 1952 language movement in Bangladesh.", ["mother language day"]),
("International Women's Day", "8 March", "Celebrates women's achievements and equal rights.", ["womens day", "women's day"]),
("World Consumer Rights Day", "15 March", "Inspired by a 1962 speech by US President John F. Kennedy about consumer rights.", []),
("World Sparrow Day", "20 March", "Started in India (by the Nature Forever Society) to save house sparrows.", ["sparrow day"]),
("World Forest Day", "21 March", "The UN's International Day of Forests.", ["international day of forests", "forest day"]),
("World Theatre Day", "27 March", "Celebrates theatre and drama.", []),
("Ambedkar Jayanti", "14 April", "The birthday of Dr B. R. Ambedkar (born 1891), chief architect of the Indian Constitution.", ["ambedkar birthday"]),
("World Heritage Day", "18 April", "The International Day for Monuments and Sites, to protect heritage.", ["heritage day"]),
("World Press Freedom Day", "3 May", "A UN day for a free press.", ["press freedom day"]),
("National Technology Day in India", "11 May", "Remembers the Pokhran-II nuclear tests of 1998.", ["technology day"]),
("International Nurses Day", "12 May", "The birthday of Florence Nightingale, founder of modern nursing.", ["nurses day"]),
("International Day of Families", "15 May", "A UN day about families.", ["family day"]),
("World Telecommunication Day", "17 May", "Marks the founding of the International Telecommunication Union (1865).", []),
("World Bee Day", "20 May", "Raises awareness of bees and pollinators.", ["bee day"]),
("Earth Hour", "the last Saturday of March (8:30 to 9:30 pm)", "People switch off lights for one hour to support the planet.", ["earth hour"]),
("International Day of Persons with Disabilities", "3 December", "A UN day for the rights of people with disabilities.", ["disability day"]),
("International Literacy Day", "8 September", "UNESCO's day for reading and writing for all.", ["literacy day"]),
("World Ozone Day", "16 September", "The Montreal Protocol to protect the ozone layer was signed on this day in 1987.", ["ozone day"]),
("World Heart Day", "29 September", "Raises awareness about heart disease.", ["heart day"]),
("World Animal Day", "4 October", "The feast day of St Francis of Assisi, patron saint of animals.", ["animal day"]),
("World Mental Health Day", "10 October", "Raises awareness about mental health.", ["mental health day"]),
("World Students' Day", "15 October", "The birthday of Dr A. P. J. Abdul Kalam, who loved students.", ["students day", "world students day"]),
("World Diabetes Day", "14 November", "The birthday of Frederick Banting, co-discoverer of insulin.", ["diabetes day"]),
]

def entries():
    out = []
    for day, date, why, alts in D:
        q = f"When is {day}?"
        a = f"**{day}** is on **{date}**. {why}"
        k = day.lower().replace("'", "")
        extra = [f"{k}", f"when is {k}", f"{k} date", f"why is {k} celebrated"] + [x for a2 in alts for x in (a2, f"when is {a2}")]
        out.append((q, a, extra))
    return out

save("days", "Important days", entries())
