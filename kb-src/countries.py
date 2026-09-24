from common import save
# country, capital, continent, note (optional)
C = [
("Afghanistan","Kabul","Asia"),("Albania","Tirana","Europe"),("Algeria","Algiers","Africa"),("Andorra","Andorra la Vella","Europe"),
("Angola","Luanda","Africa"),("Antigua and Barbuda","Saint John's","North America"),("Argentina","Buenos Aires","South America"),
("Armenia","Yerevan","Asia"),("Australia","Canberra","Oceania"),("Austria","Vienna","Europe"),("Azerbaijan","Baku","Asia"),
("Bahamas","Nassau","North America"),("Bahrain","Manama","Asia"),("Bangladesh","Dhaka","Asia"),("Barbados","Bridgetown","North America"),
("Belarus","Minsk","Europe"),("Belgium","Brussels","Europe"),("Belize","Belmopan","North America"),
("Benin","Porto-Novo","Africa","Porto-Novo is the official capital; the government sits in Cotonou."),
("Bhutan","Thimphu","Asia"),
("Bolivia","Sucre","South America","Sucre is the constitutional capital; La Paz is the seat of government."),
("Bosnia and Herzegovina","Sarajevo","Europe"),("Botswana","Gaborone","Africa"),("Brazil","Brasília","South America"),
("Brunei","Bandar Seri Begawan","Asia"),("Bulgaria","Sofia","Europe"),("Burkina Faso","Ouagadougou","Africa"),
("Burundi","Gitega","Africa","Gitega has been the political capital since 2019; Bujumbura is the largest city."),
("Cambodia","Phnom Penh","Asia"),("Cameroon","Yaoundé","Africa"),("Canada","Ottawa","North America"),("Cape Verde","Praia","Africa"),
("Central African Republic","Bangui","Africa"),("Chad","N'Djamena","Africa"),("Chile","Santiago","South America"),("China","Beijing","Asia"),
("Colombia","Bogotá","South America"),("Comoros","Moroni","Africa"),("Republic of the Congo","Brazzaville","Africa"),
("Democratic Republic of the Congo","Kinshasa","Africa"),("Costa Rica","San José","North America"),
("Ivory Coast","Yamoussoukro","Africa","Yamoussoukro is the official capital; Abidjan is the largest city and economic centre."),
("Croatia","Zagreb","Europe"),("Cuba","Havana","North America"),("Cyprus","Nicosia","Europe"),("Czech Republic","Prague","Europe"),
("Denmark","Copenhagen","Europe"),("Djibouti","Djibouti City","Africa"),("Dominica","Roseau","North America"),
("Dominican Republic","Santo Domingo","North America"),("East Timor","Dili","Asia"),("Ecuador","Quito","South America"),
("Egypt","Cairo","Africa"),("El Salvador","San Salvador","North America"),("Equatorial Guinea","Malabo","Africa"),("Eritrea","Asmara","Africa"),
("Estonia","Tallinn","Europe"),("Eswatini","Mbabane","Africa","Mbabane is the administrative capital; Lobamba is the royal and legislative capital."),
("Ethiopia","Addis Ababa","Africa"),("Fiji","Suva","Oceania"),("Finland","Helsinki","Europe"),("France","Paris","Europe"),
("Gabon","Libreville","Africa"),("Gambia","Banjul","Africa"),("Georgia","Tbilisi","Asia"),("Germany","Berlin","Europe"),("Ghana","Accra","Africa"),
("Greece","Athens","Europe"),("Grenada","Saint George's","North America"),("Guatemala","Guatemala City","North America"),
("Guinea","Conakry","Africa"),("Guinea-Bissau","Bissau","Africa"),("Guyana","Georgetown","South America"),("Haiti","Port-au-Prince","North America"),
("Honduras","Tegucigalpa","North America"),("Hungary","Budapest","Europe"),("Iceland","Reykjavík","Europe"),("India","New Delhi","Asia"),
("Indonesia","Jakarta","Asia","A new capital, Nusantara, is being built on Borneo."),("Iran","Tehran","Asia"),("Iraq","Baghdad","Asia"),
("Ireland","Dublin","Europe"),("Italy","Rome","Europe"),("Jamaica","Kingston","North America"),("Japan","Tokyo","Asia"),("Jordan","Amman","Asia"),
("Kazakhstan","Astana","Asia"),("Kenya","Nairobi","Africa"),("Kiribati","South Tarawa","Oceania"),("North Korea","Pyongyang","Asia"),
("South Korea","Seoul","Asia"),("Kuwait","Kuwait City","Asia"),("Kyrgyzstan","Bishkek","Asia"),("Laos","Vientiane","Asia"),
("Latvia","Riga","Europe"),("Lebanon","Beirut","Asia"),("Lesotho","Maseru","Africa"),("Liberia","Monrovia","Africa"),("Libya","Tripoli","Africa"),
("Liechtenstein","Vaduz","Europe"),("Lithuania","Vilnius","Europe"),("Luxembourg","Luxembourg City","Europe"),("Madagascar","Antananarivo","Africa"),
("Malawi","Lilongwe","Africa"),("Malaysia","Kuala Lumpur","Asia","Putrajaya is the administrative centre of the government."),
("Maldives","Malé","Asia"),("Mali","Bamako","Africa"),("Malta","Valletta","Europe"),("Marshall Islands","Majuro","Oceania"),
("Mauritania","Nouakchott","Africa"),("Mauritius","Port Louis","Africa"),("Mexico","Mexico City","North America"),("Micronesia","Palikir","Oceania"),
("Moldova","Chișinău","Europe"),("Monaco","Monaco","Europe"),("Mongolia","Ulaanbaatar","Asia"),("Montenegro","Podgorica","Europe"),
("Morocco","Rabat","Africa"),("Mozambique","Maputo","Africa"),("Myanmar","Naypyidaw","Asia","Yangon (Rangoon) was the capital until 2006."),
("Namibia","Windhoek","Africa"),("Nauru","Yaren","Oceania","Nauru has no official capital; the government offices are in Yaren District."),
("Nepal","Kathmandu","Asia"),("Netherlands","Amsterdam","Europe","The government and parliament sit in The Hague."),
("New Zealand","Wellington","Oceania"),("Nicaragua","Managua","North America"),("Niger","Niamey","Africa"),("Nigeria","Abuja","Africa","Lagos was the capital until 1991."),
("North Macedonia","Skopje","Europe"),("Norway","Oslo","Europe"),("Oman","Muscat","Asia"),("Pakistan","Islamabad","Asia"),("Palau","Ngerulmud","Oceania"),
("Panama","Panama City","North America"),("Papua New Guinea","Port Moresby","Oceania"),("Paraguay","Asunción","South America"),
("Peru","Lima","South America"),("Philippines","Manila","Asia"),("Poland","Warsaw","Europe"),("Portugal","Lisbon","Europe"),("Qatar","Doha","Asia"),
("Romania","Bucharest","Europe"),("Russia","Moscow","Europe","Russia spans Europe and Asia."),("Rwanda","Kigali","Africa"),
("Saint Kitts and Nevis","Basseterre","North America"),("Saint Lucia","Castries","North America"),
("Saint Vincent and the Grenadines","Kingstown","North America"),("Samoa","Apia","Oceania"),("San Marino","San Marino","Europe"),
("São Tomé and Príncipe","São Tomé","Africa"),("Saudi Arabia","Riyadh","Asia"),("Senegal","Dakar","Africa"),("Serbia","Belgrade","Europe"),
("Seychelles","Victoria","Africa"),("Sierra Leone","Freetown","Africa"),("Singapore","Singapore","Asia","Singapore is a city-state."),
("Slovakia","Bratislava","Europe"),("Slovenia","Ljubljana","Europe"),("Solomon Islands","Honiara","Oceania"),("Somalia","Mogadishu","Africa"),
("South Africa","Pretoria","Africa","South Africa has three capitals: Pretoria (executive), Cape Town (legislative) and Bloemfontein (judicial)."),
("South Sudan","Juba","Africa"),("Spain","Madrid","Europe"),
("Sri Lanka","Sri Jayawardenepura Kotte","Asia","Sri Jayawardenepura Kotte is the official capital; Colombo is the largest city and commercial capital."),
("Sudan","Khartoum","Africa"),("Suriname","Paramaribo","South America"),("Sweden","Stockholm","Europe"),("Switzerland","Bern","Europe"),
("Syria","Damascus","Asia"),("Taiwan","Taipei","Asia"),("Tajikistan","Dushanbe","Asia"),("Tanzania","Dodoma","Africa","Dar es Salaam is the largest city."),
("Thailand","Bangkok","Asia"),("Togo","Lomé","Africa"),("Tonga","Nukuʻalofa","Oceania"),("Trinidad and Tobago","Port of Spain","North America"),
("Tunisia","Tunis","Africa"),("Turkey","Ankara","Asia","Turkey spans Asia and Europe; Istanbul is its largest city."),
("Turkmenistan","Ashgabat","Asia"),("Tuvalu","Funafuti","Oceania"),("Uganda","Kampala","Africa"),("Ukraine","Kyiv","Europe"),
("United Arab Emirates","Abu Dhabi","Asia"),("United Kingdom","London","Europe"),("United States","Washington, D.C.","North America"),
("Uruguay","Montevideo","South America"),("Uzbekistan","Tashkent","Asia"),("Vanuatu","Port Vila","Oceania"),("Vatican City","Vatican City","Europe"),
("Venezuela","Caracas","South America"),("Vietnam","Hanoi","Asia"),("Yemen","Sanaa","Asia"),("Zambia","Lusaka","Africa"),("Zimbabwe","Harare","Africa"),
]
ALIASES = {
 "United States": ["USA","US","America","United States of America"], "United Kingdom": ["UK","Britain","Great Britain","England"],
 "United Arab Emirates": ["UAE"], "Ivory Coast": ["Côte d'Ivoire","Cote d'Ivoire"], "Czech Republic": ["Czechia"],
 "Democratic Republic of the Congo": ["DR Congo","DRC"], "Republic of the Congo": ["Congo"], "East Timor": ["Timor-Leste"],
 "Eswatini": ["Swaziland"], "Myanmar": ["Burma"], "North Macedonia": ["Macedonia"], "South Korea": ["Korea"], "Cape Verde": ["Cabo Verde"],
 "Vatican City": ["Vatican"], "Netherlands": ["Holland"], "Turkey": ["Türkiye"], "Russia": ["Russian Federation"],
}
CURRENCY = {
 "India":"Indian rupee (₹)","United States":"US dollar ($)","United Kingdom":"pound sterling (£)","Japan":"yen (¥)","China":"renminbi, whose unit is the yuan (¥)",
 "France":"euro (€)","Germany":"euro (€)","Italy":"euro (€)","Spain":"euro (€)","Netherlands":"euro (€)","Ireland":"euro (€)","Greece":"euro (€)","Portugal":"euro (€)",
 "Austria":"euro (€)","Belgium":"euro (€)","Finland":"euro (€)","Russia":"Russian ruble","Canada":"Canadian dollar","Australia":"Australian dollar","New Zealand":"New Zealand dollar",
 "Pakistan":"Pakistani rupee","Sri Lanka":"Sri Lankan rupee","Nepal":"Nepalese rupee","Bangladesh":"Bangladeshi taka","Bhutan":"ngultrum","Maldives":"Maldivian rufiyaa",
 "Afghanistan":"afghani","Myanmar":"kyat","Thailand":"baht","Malaysia":"ringgit","Singapore":"Singapore dollar","Indonesia":"Indonesian rupiah","Philippines":"Philippine peso",
 "Vietnam":"dong","South Korea":"South Korean won","North Korea":"North Korean won","Saudi Arabia":"Saudi riyal","United Arab Emirates":"UAE dirham","Qatar":"Qatari riyal",
 "Kuwait":"Kuwaiti dinar","Oman":"Omani rial","Bahrain":"Bahraini dinar","Iran":"Iranian rial","Iraq":"Iraqi dinar","Israel":"new shekel","Turkey":"Turkish lira",
 "Egypt":"Egyptian pound","South Africa":"rand","Nigeria":"naira","Kenya":"Kenyan shilling","Ghana":"cedi","Ethiopia":"birr","Brazil":"Brazilian real","Argentina":"Argentine peso",
 "Mexico":"Mexican peso","Switzerland":"Swiss franc","Sweden":"Swedish krona","Norway":"Norwegian krone","Denmark":"Danish krone","Poland":"złoty","Ukraine":"hryvnia",
 "Chile":"Chilean peso","Colombia":"Colombian peso","Peru":"sol","Cuba":"Cuban peso","Jamaica":"Jamaican dollar","Mauritius":"Mauritian rupee","Seychelles":"Seychellois rupee",
}
E = []
for row in C:
    country, capital, continent = row[:3]
    note = row[3] if len(row) > 3 else ""
    names = [country] + ALIASES.get(country, [])
    a = f"The capital of {country} is {capital}." + (f" {note}" if note else "")
    alts = []
    for n in names:
        alts += [f"{n} capital", f"capital city of {n}", f"which city is the capital of {n}", f"capital of {n}"]
    E.append((f"What is the capital of {country}?", a, alts))
    if capital.lower() != country.lower():
        E.append((f"{capital} is the capital of which country?", f"{capital} is the capital of {country}." + (f" {note}" if note else ""),
                  [f"which country has {capital} as its capital", f"which country's capital is {capital}", f"{capital} capital of which country"]))
    E.append((f"Which continent is {country} in?", f"{country} is in {continent}." if country not in ("Russia","Turkey") else note,
              [f"{n} is in which continent" for n in names] + [f"continent of {n}" for n in names] + [f"where is {n} located continent" for n in names]))
    if country in CURRENCY:
        E.append((f"What is the currency of {country}?", f"The currency of {country} is the {CURRENCY[country]}.",
                  [f"{n} currency" for n in names] + [f"which currency is used in {n}" for n in names] + [f"money of {n}" for n in names]))
# Indian states and union territories
STATES = [("Andhra Pradesh","Amaravati"),("Arunachal Pradesh","Itanagar"),("Assam","Dispur"),("Bihar","Patna"),("Chhattisgarh","Raipur"),("Goa","Panaji"),
("Gujarat","Gandhinagar"),("Haryana","Chandigarh"),("Himachal Pradesh","Shimla"),("Jharkhand","Ranchi"),("Karnataka","Bengaluru"),("Kerala","Thiruvananthapuram"),
("Madhya Pradesh","Bhopal"),("Maharashtra","Mumbai"),("Manipur","Imphal"),("Meghalaya","Shillong"),("Mizoram","Aizawl"),("Nagaland","Kohima"),("Odisha","Bhubaneswar"),
("Punjab","Chandigarh"),("Rajasthan","Jaipur"),("Sikkim","Gangtok"),("Tamil Nadu","Chennai"),("Telangana","Hyderabad"),("Tripura","Agartala"),("Uttar Pradesh","Lucknow"),
("Uttarakhand","Dehradun"),("West Bengal","Kolkata")]
UTS = [("Andaman and Nicobar Islands","Port Blair (renamed Sri Vijaya Puram in 2024)"),("Chandigarh","Chandigarh"),("Dadra and Nagar Haveli and Daman and Diu","Daman"),
("Delhi","New Delhi"),("Jammu and Kashmir","Srinagar (summer) and Jammu (winter)"),("Ladakh","Leh"),("Lakshadweep","Kavaratti"),("Puducherry","Puducherry")]
for s, cap in STATES:
    extra = " Chandigarh is shared by Punjab and Haryana." if cap == "Chandigarh" else ""
    E.append((f"What is the capital of {s}?", f"The capital of {s} is {cap}.{extra}", [f"{s} capital", f"capital city of {s}", f"capital of {s} state"]))
for u, cap in UTS:
    if u == "Chandigarh": continue
    E.append((f"What is the capital of {u}?", f"The capital of {u} is {cap}.", [f"{u} capital", f"capital city of {u}"]))
E += [
("How many states are there in India?","India has 28 states and 8 union territories.",["number of states in india","total states in india","how many union territories are there in india"]),
("How many countries are there in the world?","There are 195 countries: 193 members of the United Nations plus 2 observer states (Vatican City and Palestine).",["number of countries in the world","total countries in the world"]),
("How many continents are there?","There are 7 continents: Asia, Africa, North America, South America, Antarctica, Europe and Australia (Oceania).",["name the continents","list of continents","seven continents"]),
("What is the largest continent?","Asia is the largest continent, both by area and by population.",["biggest continent","largest continent in the world"]),
("What is the smallest continent?","Australia (Oceania) is the smallest continent.",["smallest continent in the world"]),
("What is the largest country in the world?","Russia is the largest country by area, about 17.1 million square kilometres.",["biggest country in the world","largest country by area"]),
("What is the smallest country in the world?","Vatican City is the smallest country, about 0.44 square kilometres.",["smallest country by area","tiniest country in the world"]),
("Which country has the largest population?","India has the largest population in the world, having passed China in 2023. Both have more than 1.4 billion people.",["most populated country","most populous country in the world","country with highest population"]),
("What is the largest state in India by area?","Rajasthan is the largest state in India by area.",["biggest state in india","largest indian state"]),
("What is the smallest state in India by area?","Goa is the smallest state in India by area.",["smallest indian state"]),
("Which Indian state has the largest population?","Uttar Pradesh has the largest population of any Indian state.",["most populated state in india","most populous indian state"]),
("How many oceans are there?","There are 5 oceans: Pacific, Atlantic, Indian, Southern (Antarctic) and Arctic.",["name the oceans","list of oceans","five oceans"]),
("What is the largest ocean?","The Pacific Ocean is the largest and deepest ocean.",["biggest ocean","largest ocean in the world"]),
("What is the smallest ocean?","The Arctic Ocean is the smallest and shallowest ocean.",["smallest ocean in the world"]),
]
save("countries", "Countries, capitals and currencies", E)
