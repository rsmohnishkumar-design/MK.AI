from common import save

# Short school essays (about 200 words) and letter formats.
E = {
"pollution": ("Pollution", [
"Pollution means making the air, water or land dirty and harmful. It is one of the biggest problems in the world today.",
"There are many kinds of pollution. Air pollution comes from vehicle smoke, factories, burning waste and crackers. Water pollution happens when sewage, chemicals and plastic are thrown into rivers and seas. Soil pollution is caused by too much fertiliser, pesticide and garbage. Loud horns, loudspeakers and machines cause noise pollution.",
"Pollution harms everyone. Dirty air causes asthma and lung disease. Polluted water spreads cholera and typhoid and kills fish. Plastic chokes animals, and smoke adds to global warming.",
"We can all help. We should walk, cycle or use buses instead of cars, plant trees, avoid plastic bags, separate wet and dry waste, and never throw rubbish into water bodies. Factories must clean their waste, and the government must make and follow strict laws.",
"A clean environment is our right and our duty. If each of us does a little, together we can make our planet clean and healthy again."]),
"importance of trees": ("The Importance of Trees", [
"Trees are among nature's greatest gifts. Without them, life on Earth would not be possible.",
"Trees give us oxygen and take in carbon dioxide, which keeps the air clean and slows global warming. They give us fruits, vegetables, wood, paper, rubber, gum and medicines. Their roots hold the soil together and stop floods and erosion. Trees bring rain, cool the air and give shade on hot days.",
"Trees are also homes for birds, insects and animals. A single old tree can support hundreds of living things. Forests are called the lungs of the Earth.",
"Sadly, trees are being cut down for cities, roads and farms. This causes pollution, landslides, droughts and the loss of wildlife.",
"We must plant more trees and protect the ones we have. Every student can plant a sapling on their birthday and care for it. As the saying goes, a tree planted today is shade for tomorrow. Let us save trees, and trees will save us."]),
"my school": ("My School", [
"My school is my second home. It is a place where I learn, play and make friends.",
"My school has a big building with bright, airy classrooms, a library full of books, science and computer labs, and a large playground. The school garden is green and beautiful, with flowers and trees.",
"Our teachers are kind and hardworking. They teach us not only lessons from books but also good manners, discipline and values. Our principal guides everyone with care.",
"Every day begins with the morning assembly, prayer and news. Besides studies, we take part in sports, music, dance, drawing, quizzes and science exhibitions. We celebrate Independence Day, Republic Day, Children's Day and our Annual Day with great joy.",
"I love my school because it helps me grow into a good person. I am proud to be a student here, and I will always remember the happy days I spent in my school."]),
"independence day": ("Independence Day", [
"Independence Day is celebrated on 15 August every year. On this day in 1947, India became free from British rule after nearly 200 years.",
"Many brave freedom fighters, like Mahatma Gandhi, Jawaharlal Nehru, Subhas Chandra Bose, Bhagat Singh, Sardar Patel and V. O. Chidambaram Pillai, gave their lives and struggled hard for our freedom. We remember them with gratitude.",
"On Independence Day, the Prime Minister hoists the national flag at the Red Fort in Delhi and speaks to the nation. Schools and offices hoist the flag, sing the national anthem, and hold parades, speeches and cultural programmes. Streets and buildings are decorated in saffron, white and green.",
"Independence Day reminds us that freedom is precious. It also gives us a duty: to keep our country united, clean and strong, respect all people, and work hard for its progress.",
"Let us be proud of our country and do our best to make India great. Jai Hind!"]),
"republic day": ("Republic Day", [
"Republic Day is celebrated on 26 January every year. On this day in 1950, the Constitution of India came into force and India became a republic.",
"The Constitution was prepared by the Constituent Assembly, with Dr B. R. Ambedkar as the chairman of its drafting committee. It gives every citizen equal rights and freedoms.",
"The main celebration is held at Kartavya Path in New Delhi. The President hoists the national flag, and a grand parade shows the strength of the Army, Navy and Air Force, along with colourful tableaux from different states. Brave citizens and children receive awards.",
"Schools celebrate with flag hoisting, patriotic songs, speeches and cultural programmes.",
"Republic Day reminds us that India is a democracy where the people choose their government. We must respect the Constitution, follow the law, and do our duties as good citizens."]),
"cleanliness": ("Cleanliness (Swachh Bharat)", [
"Cleanliness means keeping ourselves and our surroundings free from dirt and germs. It is said that cleanliness is next to godliness.",
"Personal cleanliness includes bathing daily, brushing our teeth, washing our hands before eating and after using the toilet, cutting our nails and wearing clean clothes. It keeps us healthy and fresh.",
"Keeping our homes, schools, streets and public places clean is equally important. Garbage and open drains breed mosquitoes and flies, which spread diseases like dengue, malaria and cholera.",
"The Swachh Bharat Mission, launched on 2 October 2014, aims to make India clean. We can help by using dustbins, separating wet and dry waste, not spitting or littering, and using toilets.",
"Cleanliness should be a habit, not a one-day activity. A clean India is a healthy India, and it begins with each one of us."]),
"water conservation": ("Save Water", [
"Water is essential for life. Humans, animals and plants cannot live without it. Yet only a small part of the Earth's water is fresh water that we can use.",
"Today many places face water shortage because of a growing population, wasteful use, pollution and falling groundwater. In summer, many cities depend on water tankers.",
"We can save water in many ways: turn off the tap while brushing, fix leaking taps, take shorter showers or use a bucket, reuse water from washing vegetables for plants, and water plants in the morning or evening.",
"Rainwater harvesting is one of the best ways to save water. Collecting rain from rooftops can refill wells and groundwater. Farmers can use drip irrigation to save water.",
"Every drop counts. If we waste water today, our children will suffer tomorrow. Let us all save water and save life."]),
"digital india": ("Digital India", [
"Digital India is a programme launched by the Government of India on 1 July 2015. Its aim is to bring internet, online services and digital skills to every citizen.",
"Through Digital India, people can pay bills, book tickets and transfer money using UPI, keep documents in DigiLocker, and use government services online without standing in long queues. Aadhaar gives every resident a digital identity.",
"Students can learn online through platforms like DIKSHA and SWAYAM. Farmers get information about weather and crop prices on their phones. Villages are being connected with high-speed internet through BharatNet.",
"There are still challenges, such as poor internet in some places, low digital literacy and online fraud. People must learn to use technology safely and never share OTPs or passwords.",
"Digital India is changing the way we live, learn and work. With everyone's participation, it can make India a strong, modern and connected nation."]),
"my favourite festival": ("My Favourite Festival: Pongal", [
"India is a land of festivals, and my favourite festival is Pongal, the harvest festival of Tamil Nadu. It is celebrated in the middle of January for four days.",
"The first day is Bhogi, when we clean our homes and burn old things. On the second day, Thai Pongal, we cook sweet pongal with new rice, milk and jaggery in a clay pot. When it boils over, we shout 'Pongalo Pongal!' and thank the Sun God for a good harvest.",
"The third day is Mattu Pongal, when cows and bulls are bathed, decorated and worshipped for their help in farming. Jallikattu is held in some villages. The last day, Kaanum Pongal, is for visiting relatives and going on outings.",
"We draw beautiful kolams in front of our houses, wear new clothes, and eat sugarcane and sweets.",
"I love Pongal because it teaches us to be thankful to nature, farmers and animals, and it brings families together with joy."]),
"my mother": ("My Mother", [
"My mother is the most important person in my life. She is kind, loving and hardworking.",
"She wakes up early every morning and prepares delicious food for all of us. She takes care of the whole family and makes sure everyone is happy and healthy. When I am ill, she stays by my side and looks after me.",
"My mother is also my first teacher. She helps me with my studies, tells me stories and teaches me good habits like honesty, respect and cleanliness. She encourages me when I fail and celebrates when I succeed.",
"She never complains, even when she is tired. Her smile makes our home a happy place.",
"I love my mother very much. I will always respect her, help her and try to make her proud of me."]),
"my best friend": ("My Best Friend", [
"A good friend is a treasure. I am lucky to have a best friend who is always there for me.",
"We study in the same class and sit together. My friend is honest, cheerful and helpful. We share our lunch, play together in the evening and help each other with homework.",
"When I am sad, my friend cheers me up, and when I make a mistake, my friend tells me the truth kindly. We have never fought for long, because we understand each other.",
"We both love reading and playing cricket. On holidays we go cycling and visit each other's homes, and our families are friends too.",
"As the saying goes, a friend in need is a friend indeed. I hope our friendship lasts forever."]),
"discipline": ("Discipline", [
"Discipline means following rules, controlling ourselves and doing the right thing at the right time. It is the key to success in life.",
"A disciplined student wakes up on time, completes homework, respects teachers and elders, and uses time wisely. Discipline helps us focus on our goals and avoid bad habits.",
"Nature itself follows discipline: the Sun rises and sets on time, and the seasons change in order. Soldiers, athletes and great leaders all succeed because of strict discipline.",
"Discipline should begin at home and continue at school. Parents and teachers guide us, but true discipline comes from within, when we do right even when no one is watching.",
"Without discipline, life becomes confused and unsuccessful. With discipline, we can achieve anything we dream of."]),
"health is wealth": ("Health is Wealth", [
"Health is the greatest wealth a person can have. A healthy person can study, work and enjoy life, while all the money in the world cannot buy good health.",
"To stay healthy we should eat a balanced diet with fruits, vegetables, grains, pulses and milk, and avoid too much junk food, sugar and oily food. Drinking enough water is important.",
"Regular exercise, such as walking, running, cycling, yoga or sports, keeps our body strong and our mind fresh. We also need 8 to 10 hours of sleep.",
"Good habits like washing hands, keeping clean, and staying away from smoking and alcohol protect us from diseases. Spending less time on screens and more time outdoors is good for our eyes and mind.",
"A healthy body has a healthy mind. Let us take care of our health, because health truly is wealth."]),
"importance of education": ("The Importance of Education", [
"Education is the most powerful tool for changing a person's life and the world. It gives us knowledge, skills and good values.",
"Education helps us understand the world, think clearly and make good decisions. It opens the door to good jobs and a better life, and it helps people escape poverty.",
"An educated person knows their rights and duties, respects others, and contributes to society. Educated citizens make a nation strong, healthy and developed.",
"In India, the Right to Education Act (2009) gives free and compulsory education to every child from 6 to 14 years. Education for girls is especially important, because an educated woman educates a whole family.",
"As Thiruvalluvar said, learning is the true wealth that never perishes. Let us value education and help everyone get it."]),
"technology": ("Science and Technology", [
"Science and technology have changed our lives completely. From the moment we wake up to the time we sleep, we use things made by science.",
"Electricity, phones, computers, the internet, vehicles and medicines have made life easier, faster and more comfortable. We can talk to anyone in the world instantly and learn anything online.",
"In medicine, vaccines and modern treatments save millions of lives. In farming, new machines and seeds help grow more food. In space, India's ISRO has sent missions to the Moon and Mars.",
"But technology also has problems, such as pollution, cyber crime, addiction to phones and loss of jobs to machines. We must use it wisely and responsibly.",
"Used well, science and technology are a blessing. They can help us build a better, healthier and happier world."]),
"save girl child": ("Save the Girl Child (Beti Bachao, Beti Padhao)", [
"Girls are as important as boys, and they deserve equal love, care and opportunities. Yet in some places, girls are still treated unfairly.",
"The government launched the Beti Bachao, Beti Padhao scheme on 22 January 2015 to protect girls, improve the sex ratio and educate every girl.",
"When girls are educated, they become doctors, engineers, teachers, scientists, pilots and leaders. Women like Kalpana Chawla, Indira Gandhi, Mary Kom and P. V. Sindhu have made India proud.",
"We must stop discrimination, child marriage and dowry. Every girl must be allowed to study, play and follow her dreams.",
"Save the girl child, educate the girl child, and our nation will progress."]),
"road safety": ("Road Safety", [
"Road safety means following rules to protect ourselves and others on the road. Every year many people lose their lives in road accidents, and most of them can be prevented.",
"Pedestrians should walk on the footpath, cross at zebra crossings and look both ways before crossing. Two-wheeler riders must wear helmets, and car travellers must wear seat belts.",
"Drivers should follow speed limits and traffic signals: red means stop, yellow means get ready, and green means go. They should never drink and drive or use mobile phones while driving.",
"Children should never play on the road. Everyone should give way to ambulances and fire engines.",
"Road rules are for our safety, not a burden. Remember: it is better to be late than never."]),
"plastic pollution": ("Say No to Plastic", [
"Plastic is cheap, light and useful, but it has become one of the biggest threats to our environment.",
"Plastic takes hundreds of years to break down. Plastic bags and bottles block drains, cause floods, and pile up in landfills. When burnt, plastic releases poisonous gases.",
"Much of the plastic ends up in rivers and oceans, where fish, turtles and birds swallow it and die. Tiny pieces called microplastics have even entered our food and water.",
"We can reduce plastic by carrying cloth bags, using steel bottles and lunch boxes, refusing plastic straws and cutlery, and recycling whatever plastic we use. Many states, including Tamil Nadu, have banned single-use plastic.",
"Let us say no to plastic and yes to a cleaner, greener Earth."]),
"global warming": ("Global Warming", [
"Global warming is the rise in the Earth's average temperature. It is mainly caused by greenhouse gases like carbon dioxide and methane, which trap heat in the atmosphere.",
"These gases come from burning coal, petrol and diesel, cutting forests, and factories. As the Earth heats up, glaciers melt, sea levels rise, and weather becomes extreme, with heatwaves, floods, droughts and stronger cyclones.",
"Global warming affects farming, wildlife and human health. Some islands and coastal cities may even go under water.",
"We can fight it by using solar and wind energy, saving electricity, planting trees, using public transport and cycles, and reducing waste. Countries have agreed in the Paris Agreement (2015) to cut emissions.",
"The Earth is our only home. We must act now to protect it for future generations."]),
"my hobby": ("My Hobby", [
"A hobby is something we enjoy doing in our free time. My hobby is reading books.",
"I love reading storybooks, comics, science books and biographies of great people. Books take me to new places and teach me new things. My favourite books include the Panchatantra stories and Wings of Fire by Dr A. P. J. Abdul Kalam.",
"Reading improves my vocabulary, imagination and general knowledge. It also helps me do better in my studies and in writing.",
"I visit the school library every week and have a small collection of books at home. On holidays I read for an hour every day.",
"Hobbies keep us happy and away from boredom. I will continue reading all my life, because a good book is a true friend."]),
}

L = [
("How to write a leave letter to the principal?", """Here's a leave letter to the principal (change the details in brackets):

To
The Principal,
[School name],
[City].

Date: [DD/MM/YYYY]

Respected Sir/Madam,

Sub: Request for leave for [number] days.

I am [your name], studying in class [class and section]. I am suffering from [fever / a family function / the reason], so I will not be able to attend school from [date] to [date]. Kindly grant me leave for these days.

I will complete the work I miss.

Thanking you,

Yours obediently,
[Your name]
Class [class], Roll No. [number]""", ["leave letter to principal", "leave letter", "sick leave letter", "write a leave letter", "leave letter for fever", "letter to principal for leave", "leave application"]),
("What is the format of a formal letter?", """**Formal letter format** (for a principal, office, editor or company):

1. **Sender's address** (not needed in school leave letters)
2. **Date**
3. **Receiver's address:** To, designation, organisation, city
4. **Subject:** one line saying what the letter is about
5. **Salutation:** Respected Sir/Madam, or Dear Sir/Madam
6. **Body:** introduce yourself, give the reason clearly and politely in 2 or 3 short paragraphs, and end with a request
7. **Closing:** Thanking you, Yours faithfully (or Yours obediently / Yours sincerely)
8. **Signature and name**

Keep it short, polite and to the point.""", ["formal letter format", "format of formal letter", "how to write a formal letter", "formal letter"]),
("What is the format of an informal letter?", """**Informal letter format** (to a friend or relative):

1. **Your address**
2. **Date**
3. **Greeting:** Dear [name],
4. **Body:** start by asking how they are, share your news and feelings, and ask about theirs
5. **Closing:** Your loving friend / Yours lovingly / With love
6. **Your name**

The tone is friendly and personal, and there is no subject line.""", ["informal letter format", "format of informal letter", "how to write an informal letter", "informal letter", "letter to a friend"]),
("How to write a complaint letter?", """Here's a complaint letter (change the details in brackets):

To
The [Commissioner / Manager / Officer],
[Office name],
[City].

Date: [DD/MM/YYYY]

Dear Sir/Madam,

Sub: Complaint about [the problem].

I am [your name], a resident of [area]. I wish to bring to your notice that [describe the problem clearly: when it started and how it affects people].

We have faced this problem for [time]. I kindly request you to take action at the earliest.

Thanking you,

Yours faithfully,
[Your name]
[Address / phone]""", ["complaint letter", "write a complaint letter", "letter of complaint", "complaint letter format"]),
("How to write an application for a job?", """Here's a simple job application letter:

[Your name]
[Address, phone, email]

Date: [DD/MM/YYYY]

To
The [HR Manager],
[Company name],
[City].

Sub: Application for the post of [job title].

Dear Sir/Madam,

I came to know about the opening for [job title] through [source]. I have completed [qualification] and have [experience/skills]. I am confident that my skills in [skill 1] and [skill 2] will help your team.

I have attached my resume. I would be grateful for an opportunity to attend an interview.

Thanking you,

Yours sincerely,
[Your name]""", ["job application letter", "application for job", "how to write a job application", "cover letter"]),
]

# Other names people use for the same essay
SAME = {
    "water conservation": ["save water", "water"],
    "importance of trees": ["trees", "save trees", "tree"],
    "cleanliness": ["swachh bharat", "clean india"],
    "plastic pollution": ["say no to plastic", "plastic"],
    "my favourite festival": ["pongal", "my favorite festival"],
    "health is wealth": ["health", "good health"],
    "importance of education": ["education"],
    "technology": ["science and technology", "science"],
    "save girl child": ["beti bachao beti padhao", "girl child", "girl education"],
    "global warming": ["climate change"],
}

def essay_entries():
    out = []
    for key, (title, paras) in E.items():
        body = f"**{title}**\n\n" + "\n\n".join(paras)
        q = f"Write an essay on {key}"
        alts = [a for k in [key] + SAME.get(key, []) for a in (f"essay on {k}", f"write an essay on {k}", f"paragraph on {k}", f"speech on {k}")]
        alts += [f"essay on {key}", f"{key} essay", f"essay about {key}", f"write an essay about {key}", f"write a paragraph on {key}", f"paragraph on {key}", f"short essay on {key}", f"speech on {key}"]
        out.append((q, body, list(dict.fromkeys(alts))))
    return out

save("essays", "Essays and letters", essay_entries() + L)
