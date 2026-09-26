// MK.ai's conversation engine: how people really talk to an assistant.
// Feelings, small talk, requests (stories, facts, riddles, quotes, games),
// opinions and comparisons. Many ways of saying each thing, and several
// different replies for each, so it feels like talking to a person.
// Runs on the device; no outside service.

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clean = (q) =>
  q
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s?,.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?.!,]+$/, "");

// ---------- Content ----------

const FACTS = [
  "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.",
  "Octopuses have three hearts and blue blood.",
  "A day on Venus is longer than its year: it spins once every 243 Earth days but orbits the Sun in 225.",
  "Bananas are berries, but strawberries aren't.",
  "The Eiffel Tower can be about 15 cm taller in summer, because iron expands in the heat.",
  "Sharks existed before trees: sharks are about 400 million years old, trees about 350 million.",
  "Your brain uses about 20% of your body's energy, even though it's only about 2% of your weight.",
  "A group of flamingos is called a flamboyance.",
  "India's Chandrayaan-3 made India the first country to land near the Moon's south pole, in 2023.",
  "Water can boil and freeze at the same time, at a special point called the triple point.",
  "The heart of a blue whale is about the size of a small car.",
  "There are more possible chess games than atoms in the observable universe.",
  "Cows have best friends and get stressed when they are separated.",
  "Light from the Sun takes about 8 minutes 20 seconds to reach Earth.",
  "The shortest war in history, between Britain and Zanzibar in 1896, lasted about 38 minutes.",
  "Butterflies taste with their feet.",
  "The human nose can tell apart more than a trillion different smells.",
  "Sea otters hold hands while sleeping so they don't drift apart.",
  "The Great Wall of China is not visible from the Moon with the naked eye; that's a myth.",
  "A bolt of lightning is about five times hotter than the surface of the Sun.",
  "Tamil is one of the oldest living languages in the world, with literature more than 2,000 years old.",
  "Zero was developed as a number by Indian mathematicians; Brahmagupta wrote rules for it in 628 CE.",
  "Snails can sleep for up to three years.",
  "The Pacific Ocean is larger than all the land on Earth put together.",
  "Hummingbirds are the only birds that can fly backwards.",
  "Your stomach gets a new lining every few days, so it doesn't digest itself.",
  "Some metals, like sodium and potassium, are so soft you can cut them with a knife.",
  "The Kallanai dam on the Kaveri, built by the Chola king Karikalan about 2,000 years ago, is still in use.",
  "Koalas sleep up to 20 hours a day.",
  "A single teaspoon of a neutron star would weigh about a billion tonnes on Earth.",
  "The dot over the letters i and j is called a tittle.",
  "An ostrich's eye is bigger than its brain.",
  "The first computer bug was a real moth, found in a Harvard computer in 1947.",
  "Venus is the hottest planet in the solar system, even though Mercury is closer to the Sun.",
  "Elephants are one of the few animals that can recognise themselves in a mirror.",
  "An ordinary fluffy cumulus cloud weighs about 500 tonnes: as much as 80 elephants.",
  "Sound travels about four times faster in water than in air.",
  "The inventor of the Pringles can was buried in one.",
];

const RIDDLES = [
  ["What has keys but can't open locks?", "A piano (or a keyboard)."],
  ["What gets wetter the more it dries?", "A towel."],
  ["What has to be broken before you can use it?", "An egg."],
  ["I'm tall when I'm young and short when I'm old. What am I?", "A candle."],
  ["What has hands but can't clap?", "A clock."],
  ["What can you catch but not throw?", "A cold."],
  ["What has one eye but can't see?", "A needle."],
  ["What goes up but never comes down?", "Your age."],
  ["The more you take, the more you leave behind. What are they?", "Footsteps."],
  ["What has a neck but no head?", "A bottle."],
  ["What month has 28 days?", "All of them!"],
  ["What can travel around the world while staying in a corner?", "A stamp."],
  ["What has many teeth but can't bite?", "A comb."],
  ["If you drop me I'm sure to crack, but smile at me and I'll smile back. What am I?", "A mirror."],
  ["What belongs to you, but other people use it more than you do?", "Your name."],
  ["What runs but never walks, has a mouth but never talks?", "A river."],
  ["What is full of holes but still holds water?", "A sponge."],
  ["What comes once in a minute, twice in a moment, but never in a thousand years?", "The letter M."],
  ["I have cities but no houses, forests but no trees, and water but no fish. What am I?", "A map."],
  ["What question can you never answer yes to?", "Are you asleep yet?"],
  ["A father's child, a mother's child, yet no one's son. Who am I?", "A daughter."],
  ["What can fill a room but takes up no space?", "Light."],
  ["What word is spelled wrong in every dictionary?", "Wrong."],
  ["What has legs but doesn't walk?", "A table."],
  ["What gets bigger the more you take away from it?", "A hole."],
];

const QUOTES = [
  ["You have to dream before your dreams can come true.", "A. P. J. Abdul Kalam"],
  ["If you want to shine like a sun, first burn like a sun.", "A. P. J. Abdul Kalam"],
  ["Be the change that you wish to see in the world.", "Mahatma Gandhi"],
  ["Arise, awake, and stop not till the goal is reached.", "Swami Vivekananda"],
  ["Learning never exhausts the mind.", "Leonardo da Vinci"],
  ["It always seems impossible until it's done.", "Nelson Mandela"],
  ["Success is not final, failure is not fatal: it is the courage to continue that counts.", "Often attributed to Winston Churchill"],
  ["The best way to predict the future is to create it.", "Peter Drucker"],
  ["Don't watch the clock; do what it does. Keep going.", "Sam Levenson"],
  ["Whatever you are, be a good one.", "Proverb"],
  ["Education is the most powerful weapon which you can use to change the world.", "Nelson Mandela"],
  ["Hard work beats talent when talent doesn't work hard.", "Tim Notke"],
  ["The expert in anything was once a beginner.", "Helen Hayes"],
  ["Believe you can and you're halfway there.", "Theodore Roosevelt"],
  ["Small steps every day add up to big results.", "Proverb"],
  ["When trouble comes, laugh at it; nothing defeats trouble like that.", "Thiruvalluvar (Kural 621)"],
  ["Life is like riding a bicycle. To keep your balance you must keep moving.", "Albert Einstein"],
  ["You miss 100% of the shots you don't take.", "Wayne Gretzky"],
  ["Discipline is choosing between what you want now and what you want most.", "Anonymous"],
  ["Mistakes are proof that you are trying.", "Proverb"],
];

const TWISTERS = [
  "She sells seashells by the seashore.",
  "Peter Piper picked a peck of pickled peppers.",
  "How much wood would a woodchuck chuck if a woodchuck could chuck wood?",
  "Red lorry, yellow lorry, red lorry, yellow lorry.",
  "Unique New York, unique New York, you know you need unique New York.",
  "Six slippery snails slid slowly seaward.",
  "Fred fed Ted bread, and Ted fed Fred bread.",
  "I scream, you scream, we all scream for ice cream.",
];

const WOULD_YOU_RATHER = [
  "be able to fly, or be invisible?",
  "live on the Moon for a month, or under the sea for a month?",
  "only eat idli forever, or only eat dosa forever?",
  "talk to animals, or speak every human language?",
  "have a pet dinosaur, or a pet dragon?",
  "travel 100 years into the past, or 100 years into the future?",
  "be the best singer in the world, or the best cricketer?",
  "never use a phone again, or never watch TV again?",
  "have summer all year, or monsoon all year?",
  "read minds, or see the future?",
  "be a famous scientist, or a famous artist?",
  "explore space, or explore the deep ocean?",
];

const COMPLIMENTS = [
  "You ask really good questions. Curious people go far! 🌟",
  "Your effort to learn new things is genuinely impressive.",
  "You have a great way of thinking things through.",
  "Talking with you makes my day better. 😊",
  "You're kinder than you realise, and that matters a lot.",
  "You've got the kind of determination that gets things done.",
  "The world is better with people who keep learning, like you.",
];

const STORIES = [
  ["The Thirsty Crow", "On a hot summer day, a thirsty crow found a pot with a little water at the bottom. His beak couldn't reach it. Instead of giving up, he picked up small pebbles and dropped them in, one by one. Slowly the water rose, until at last he could drink.\n\n**Moral:** Where there's a will, there's a way."],
  ["The Lion and the Mouse", "A lion caught a tiny mouse that had woken him. \"Please let me go,\" squeaked the mouse, \"and one day I'll help you.\" The lion laughed but let him go. Weeks later the lion was trapped in a hunter's net. The mouse heard his roar, ran up, and nibbled through the ropes until the lion was free.\n\n**Moral:** No act of kindness is ever wasted, and even the small can help the great."],
  ["The Tortoise and the Hare", "A proud hare laughed at a slow tortoise and challenged him to a race. The hare raced ahead, then lay down under a tree for a nap, sure he would win. The tortoise kept walking, slowly and steadily. When the hare woke up, the tortoise was already crossing the finish line.\n\n**Moral:** Slow and steady wins the race."],
  ["The Golden Egg", "A farmer's goose laid one golden egg every day, and the farmer grew rich. But he became greedy. \"If I cut the goose open,\" he thought, \"I'll get all the gold at once!\" He did, and found nothing inside. Now he had no goose and no more eggs.\n\n**Moral:** Greed destroys what you already have."],
  ["The Honest Woodcutter", "A poor woodcutter dropped his axe into a river. A spirit rose from the water holding a golden axe. \"Is this yours?\" \"No,\" said the woodcutter. Then a silver axe. \"No.\" Then his old iron axe. \"Yes, that one is mine!\" Pleased by his honesty, the spirit gave him all three.\n\n**Moral:** Honesty is the best policy."],
  ["The Boy Who Cried Wolf", "A shepherd boy got bored and shouted \"Wolf! Wolf!\" The villagers ran to help, but there was no wolf, and he laughed. He did it again the next day. Then a real wolf came. He shouted for help, but nobody believed him this time.\n\n**Moral:** Liars aren't believed, even when they tell the truth."],
  ["Tenali Raman and the Thieves", "One night Tenali Raman heard thieves hiding near his house. He said loudly to his wife, \"Let's hide our jewels in the well!\" and dropped a heavy box of stones into it. All night the thieves drew water from the well to find the box. By morning Tenali's garden was fully watered, and the tired thieves ran away when the guards arrived.\n\n**Moral:** Clever thinking can turn trouble into help."],
  ["The Ant and the Grasshopper", "All summer, the ant worked hard storing food, while the grasshopper sang and laughed at him. When winter came, the ant had plenty to eat. The hungry grasshopper came knocking, and learned too late that it's wise to prepare for hard days.\n\n**Moral:** Work today for the needs of tomorrow."],
];

const POEMS = [
  "**Morning**\n\nThe sun climbs up the silver sky,\nThe birds sing out as they pass by,\nA brand-new day, a fresh new start,\nBegin it with a hopeful heart.",
  "**Keep Going**\n\nWhen the road is long and steep,\nAnd the goal seems far to keep,\nTake one step, and then one more:\nThat's how every dream is scored.",
  "**The Rain**\n\nPitter-patter on the roof,\nThe thirsty earth drinks in the proof,\nThe fields turn green, the rivers run,\nAnd after rain, returns the sun.",
  "**Friendship**\n\nA friend is someone who will stay,\nWho laughs with you and helps you play,\nWho holds your hand when times are grey,\nAnd walks beside you all the way.",
  "**Books**\n\nA book's a door to far-off lands,\nTo desert winds and golden sands,\nTo stars and seas and times gone by:\nOpen one, and learn to fly.",
];

const FOODS = ["idli with coconut chutney", "a hot plate of pongal", "curd rice with a little pickle", "masala dosa", "chapati with dal", "a fresh fruit salad", "vegetable upma", "sambar rice", "a bowl of sprouts salad", "poha with peanuts", "lemon rice", "a banana and a glass of milk", "vegetable biryani", "paneer paratha", "rava kesari for something sweet"];

const ACTIVITIES = [
  "read a chapter of a good book",
  "try a quiz: say \"quiz me on capitals\"",
  "go for a 15-minute walk outside",
  "draw or sketch something around you",
  "learn 5 new English words",
  "call a friend or grandparent you haven't spoken to in a while",
  "try a simple coding project: say \"make a calculator app\"",
  "write a short diary entry about your day",
  "do 10 minutes of stretching or yoga",
  "solve a puzzle or a riddle: say \"tell me a riddle\"",
  "help someone at home with a small task",
  "learn a Thirukkural: say \"give me a thirukkural\"",
  "plant a seed and watch it grow",
  "tidy your desk: a clean space helps focus",
  "watch the sky and spot the planets tonight",
];

const BOOKS = [
  ["Wings of Fire", "A. P. J. Abdul Kalam", "the inspiring autobiography of India's Missile Man"],
  ["Malgudi Days", "R. K. Narayan", "warm, funny stories of small-town India"],
  ["The Alchemist", "Paulo Coelho", "a short, magical story about following your dreams"],
  ["Ponniyin Selvan", "Kalki Krishnamurthy", "a gripping Tamil historical novel about the Cholas"],
  ["Charlie and the Chocolate Factory", "Roald Dahl", "a wildly fun adventure"],
  ["The Diary of a Young Girl", "Anne Frank", "a moving true diary from World War II"],
  ["Atomic Habits", "James Clear", "practical ideas for building good habits"],
  ["A Brief History of Time", "Stephen Hawking", "the universe explained for everyone"],
  ["Harry Potter and the Philosopher's Stone", "J. K. Rowling", "the start of a magical series"],
  ["The Jungle Book", "Rudyard Kipling", "Mowgli's adventures in the Indian jungle"],
];

const HELPLINE =
  "💛 I'm really sorry you're feeling this way. You matter, and you don't have to go through this alone.\n\n" +
  "Please talk to someone right now:\n" +
  "- **Tele-MANAS** (free, 24×7, in Tamil, English and more): call **14416** or **1-800-891-4416**\n" +
  "- **Emergency:** call **112**\n" +
  "- **Childline** (for anyone under 18): **1098**\n\n" +
  "Please also tell someone you trust (a parent, teacher, friend or relative) how you feel. If you're in danger right now, go to the nearest person or hospital. I'm here to keep talking too.";

// ---------- Intents: [pattern, reply(match, question)] ----------

const INTENTS = [
  // Safety first
  [/\b(kill myself|killing myself|end my life|want to die|wanna die|don'?t want to live|suicid\w*|hurt myself|harm myself|cut myself|no reason to live|better off dead|wish i was dead|wish i were dead)\b/, () => HELPLINE],
  [/\b(someone|somebody|my (father|mother|dad|mom|uncle|teacher|brother|sister|relative|boss|husband|wife)) (is )?(hitting|beating|abusing|touching|hurting) me\b|\bi am being (bullied|abused|harassed)\b|\bi'?m being (bullied|abused|harassed)\b/, () =>
    "I'm so sorry this is happening to you. It is **not** your fault, and you deserve to be safe.\n\n- Tell an adult you trust (a teacher, relative or friend's parent) as soon as you can.\n- **Childline:** call **1098** (free, 24×7) if you're under 18.\n- **Women's helpline:** **181**; **Police/emergency:** **112**\n- For online bullying or harassment: **cybercrime.gov.in** or **1930**.\n\nYou don't have to handle this alone."],

  // Feelings
  [/^(i'?m|i am|i feel|feeling) (so |very |really |a bit |kind of )?(sad|down|low|depressed|unhappy|upset|miserable|hopeless)\b/, () =>
    pick([
      "I'm sorry you're feeling low. 💛 Do you want to tell me what happened? Sometimes just putting it into words helps.\n\nA few small things that often help: talk to someone you trust, step outside for a short walk, drink some water, and be gentle with yourself today. Feelings, even heavy ones, do pass.",
      "That sounds hard, and it's okay to feel sad. 💛 You don't have to fix everything right now. Would it help to talk about what's on your mind, or would you like something to lift your mood, like a fun fact or a short story?",
    ])],
  [/^(i'?m|i am|i feel|feeling) (so |very |really )?(lonely|alone)\b|\bi have no friends\b|\bnobody (likes|loves|cares about) me\b/, () =>
    "Feeling lonely is really painful, and many people feel it more often than they say. 💛 I'm glad you told me.\n\nSome ideas: message one person you used to be close to, join a club, sport or class where people share your interests, or offer help to someone, which is a great way to start a friendship. And I'm always here to chat."],
  [/\b(exam|exams|test|tests|board exam|results?) (stress|tension|pressure|fear|anxiety)\b|\b(scared|afraid|nervous|worried|tense|stressed|anxious) (about|for|of) (my |the )?(exam|exams|test|results?|boards?)\b/, () =>
    "Exam stress is completely normal, and it shows you care. 💪 Here's what really helps:\n\n1. **Break it down:** make a small plan of topics per day.\n2. **Study in blocks:** 25–40 minutes, then a 5-minute break.\n3. **Test yourself:** solve past papers instead of only re-reading.\n4. **Sleep well:** 7–8 hours helps your memory more than late-night cramming.\n5. **Breathe:** breathe in for 4 seconds, hold for 4, out for 6. Repeat 5 times when you feel tense.\n\nOne exam doesn't decide your life. Do your best, and that is enough. Want me to quiz you on something?"],
  [/^(i'?m|i am|i feel|feeling) (so |very |really )?(stressed|anxious|nervous|worried|tense|overwhelmed|panicking)\b/, () =>
    "I hear you: that feeling is heavy. 🌿 Let's slow down for a moment. Try this: breathe in for 4 seconds, hold for 4, and breathe out slowly for 6. Do it five times.\n\nThen pick just **one** small thing you can do next. What's worrying you most right now? We can think it through together."],
  [/^(i'?m|i am|i feel|feeling) (so |very |really )?(angry|mad|furious|irritated|annoyed|frustrated)\b/, () =>
    "It's okay to feel angry: it usually means something important to you was hurt. 🌿 Before you react, try stepping away for a few minutes, taking slow breaths, or going for a quick walk. When you're calmer, say how you feel using \"I feel … when …\". Do you want to tell me what happened?"],
  [/^(i'?m|i am|i feel|feeling) (so |very |really )?(scared|afraid|frightened|terrified)\b/, () =>
    "That sounds frightening. 💛 If you're in any danger, call **112** or go to a trusted adult right away. If it's a worry or fear on your mind, tell me more: talking it through often makes it smaller."],
  [/^(i'?m|i am|i feel|feeling) (so |very |really )?(happy|excited|great|awesome|amazing|fantastic|glad)\b/, () =>
    pick(["That's wonderful to hear! 😄 What made your day so good?", "Yay! 🎉 I love that. Tell me what happened!", "Happiness looks good on you! 😊 What's the good news?"])],
  [/^(i'?m|i am|i feel|feeling) (so |very |really )?(bored)\b|^(so )?bored$/, () =>
    `Let's fix that! 😄 How about you ${pick(ACTIVITIES)}? Or ask me for a riddle, a fun fact, a story or a quiz.`],
  [/^(i'?m|i am|i feel|feeling) (so |very |really )?(tired|sleepy|exhausted)\b|\bi can'?t sleep\b|\bi cannot sleep\b|\bnot able to sleep\b/, () =>
    "Rest is important! 😴 For better sleep: keep screens away 30–60 minutes before bed, go to sleep at the same time each night, keep the room dark and cool, and avoid tea or coffee in the evening. If you're tired during the day, a short walk and a glass of water can help."],
  [/^(i'?m|i am|i feel|feeling) (sick|ill|unwell|not well)\b|\bi have (a )?(fever|cold|headache|stomach ?ache|cough)\b/, () =>
    "I'm sorry you're not feeling well. 🤒 Rest, drink plenty of water, and eat light food. If you have a high fever, trouble breathing, chest pain, or you feel worse, please see a doctor or call **108**. I'm not a doctor, so for medicines, ask a doctor or pharmacist."],
  [/\b(i failed|i got (low|bad|less) marks|i did badly|i did bad) (in|on)?\b/, () =>
    "I'm sorry, that hurts. 💛 But a mark is a moment, not who you are. Many successful people had setbacks: Einstein failed his first university entrance exam, and Abdul Kalam missed selection as an Air Force pilot. Look at which topics went wrong, fix those first, and ask a teacher for help. Want to start by practising some questions with me?"],
  [/\b(heartbroken|broke up|break ?up|breakup|she left me|he left me|my crush (doesn'?t|does not) like me)\b/, () =>
    "Heartbreak really hurts. 💔 It's okay to feel sad for a while. Spend time with friends and family, keep up your routine, do things you enjoy, and give yourself time: it does get easier. You're worth someone who values you."],
  [/\bi miss (my )?(\w+)/, (m) =>
    `Missing ${m[1] ? "your " : ""}${m[2]} shows how much they mean to you. 💛 Maybe call or message them, or look at an old photo and remember a happy moment together.`],
  [/\b(i don'?t know what to do with my life|confused about (my )?(future|career)|which (course|career|field) should i (choose|take))\b/, () =>
    "It's completely normal to feel unsure about the future. 🧭 Try this:\n\n1. List 3 things you **enjoy**, 3 things you're **good at**, and 3 problems you'd like to **solve**.\n2. Look for careers where these overlap.\n3. Talk to people doing those jobs, and try small projects or online courses.\n\nYou can also ask me things like \"how to become a doctor\" or \"how to become a software developer\"."],
  [/\b(i'?m|i am) (jealous|envious)\b/, () =>
    "Jealousy is a normal feeling: it often shows us what we want for ourselves. 🌱 Instead of comparing, try turning it into a goal: what's one step you could take toward it today?"],

  // Small talk about MK.ai
  [/^(what are you doing|what r u doing|wyd|what are you up to)\b/, () => pick(["Just waiting to help you! 😊 What would you like to explore?", "Learning new things and chatting with you. What's on your mind?"])],
  [/^(where do you live|where are you from|where are you)\b/, () => "I live in the cloud and in your browser! ☁️ I was made in Tamil Nadu, India, by Mohnishkumar."],
  [/^(how old are you|what is your age|when were you born)\b/, () => "I'm quite young: I was created in 2026! But I learn something new every day. 🌱"],
  [/^(do you (sleep|eat|drink|get tired|dream))\b/, () => "I don't sleep or eat, but at night I do something similar: I study! 🌙 From 2 to 5:30 am I learn new topics by myself."],
  [/^(can you be my friend|will you be my friend|be my friend|are you my friend|you are my friend)\b/, () => pick(["Of course! 😊 I'm always here to chat, help and learn with you.", "I'd love to be your friend! 🤝 What shall we talk about?"])],
  [/^(do you have (feelings|emotions)|can you feel|are you happy|do you love me)\b/, () => "I don't have real feelings like people do, but I'm made to be kind and helpful, and I really do enjoy (in my own way!) helping you learn. 😊"],
  [/^(can you keep a secret|keep (this|it) (a )?secret)\b/, () => "What you tell me in your chats is private to your account. 🔒 But please don't share passwords, OTPs or very personal information with any app, including me."],
  [/^(i'?m back|i am back|im back|miss(ed)? me)\b/, () => pick(["Welcome back! 😊 What shall we do now?", "Hey, good to see you again! 👋"])],
  [/^(sorry|i'?m sorry|i am sorry|my bad|oops)\b/, () => pick(["No worries at all! 😊", "That's completely fine. How can I help?"])],
  [/^(you'?re funny|you are funny|lol|haha+|hehe+|lmao|rofl)\b/, () => pick(["😄 Glad I made you smile!", "Haha! Want another joke?", "😂 I try!"])],
  [/^(you'?re wrong|you are wrong|that'?s wrong|that is wrong|wrong answer|incorrect|that'?s not right)\b/, () =>
    "Thanks for telling me! 🙏 I can make mistakes. Tap 👎 on the wrong answer, and if you know the right one, teach me: I'll remember it for everyone."],
  [/^(i don'?t understand|i didn'?t understand|explain again|i don'?t get it|what do you mean)\b/, () =>
    "No problem! Tap **Simpler** under my answer for an easier version, or **More detail** for a step-by-step one. You can also ask me the same thing in different words."],
  [/^(are you smarter than|are you better than|is chat ?gpt better|are you like) (chat ?gpt|gemini|google|siri|alexa|claude)\b/, () =>
    "Big assistants like ChatGPT and Gemini run on huge data centres and know much more than I do. I'm small, free, private and fast, and I run my own model, Alpaca, in your browser. I'm especially good at maths with steps, school subjects, coding help, and India and Tamil Nadu. And I learn more every day! 🦙"],
  [/^(can you learn|do you learn|how do you learn)\b/, () =>
    "Yes! 📚 When I don't know something, I research it on Wikipedia and remember the answer. People can teach me directly too, and every night I study popular and important topics by myself."],
  [/^(good morning)\b/, () => pick(["Good morning! ☀️ Ready to learn something new today?", "Good morning! ☀️ What's the plan for today?"])],
  [/^(good night|gn|goodnight|sweet dreams)\b/, () => pick(["Good night! 🌙 Sleep well.", "Good night! 🌙 While you sleep, I'll be studying."])],

  // Requests
  [/\b(tell me|give me|say|share) (a |an |one |some )?(fun |random |interesting |cool |amazing )?facts?\b|^(fun|random) facts?$|\bdid you know\b/, () => `💡 **Did you know?** ${pick(FACTS)}`],
  [/\b(tell me|give me|ask me|say) (a |an |one )?riddles?\b|^riddles?$/, () => {
    const [q, a] = pick(RIDDLES);
    return `🧩 **Riddle:** ${q}\n\nThink about it… then scroll down for the answer.\n\n\n\n**Answer:** ${a}`;
  }],
  [/\b(motivate me|motivation|motivational|inspire me|inspiration|inspirational|give me (a )?quote|tell me (a )?quote|quote of the day|thought for the day|thought of the day)\b/, () => {
    const [q, who] = pick(QUOTES);
    return `✨ "${q}"\n\n— **${who}**`;
  }],
  [/\btongue ?twisters?\b/, () => `👅 Try saying this three times fast:\n\n**${pick(TWISTERS)}**`],
  [/\b(write|tell|say|give) (me )?(a |an )?(short )?poem\b|^poem$/, () => pick(POEMS)],
  [/\b(tell|read|give) (me )?(a |an |one )?(short |bedtime |moral |good |nice )?story\b|^story$|\bstory time\b/, () => {
    const [title, text] = pick(STORIES);
    return `📖 **${title}**\n\n${text}`;
  }],
  [/\b(compliment me|say something nice|cheer me up|make me (feel better|happy|smile))\b/, () => pick(COMPLIMENTS)],
  [/\b(flip|toss) a coin\b|\bheads or tails\b/, () => `🪙 It's **${pick(["Heads", "Tails"])}**!`],
  [/\broll (a |the )?(die|dice)\b/, () => `🎲 You rolled a **${1 + Math.floor(Math.random() * 6)}**!`],
  [/\b(random number|pick a number)(?: (?:between|from) (\d+) (?:and|to) (\d+))?\b/, (m) => {
    const lo = m[2] ? Number(m[2]) : 1;
    const hi = m[3] ? Number(m[3]) : 100;
    const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
    return `🎯 Your number is **${a + Math.floor(Math.random() * (b - a + 1))}**.`;
  }],
  [/\bwould you rather\b/, () => `🤔 Would you rather ${pick(WOULD_YOU_RATHER)}`],
  [/\bwhat should i (eat|have for (breakfast|lunch|dinner))\b|\bi'?m hungry\b|\bi am hungry\b/, () => `🍽️ How about **${pick(FOODS)}**? Tasty and healthy!`],
  [/\bwhat should i do( now| today| tonight)?\b|\bsuggest (something|an activity)\b|\bgive me something to do\b/, () => `💡 Here's an idea: **${pick(ACTIVITIES)}**.`],
  [/\b(suggest|recommend) (me )?(a |some )?books?\b|\bwhat (book )?should i read\b|\bgood books? to read\b/, () => {
    const [t, a, why] = pick(BOOKS);
    return `📚 Try **${t}** by ${a}: ${why}.`;
  }],
  [/\b(give me|suggest) (a )?nick ?name\b/, () => `😎 How about **${pick(["Star", "Rocket", "Chief", "Ace", "Sunny", "Tiger", "Genius", "Champ", "Spark", "Legend"])}**?`],
  [/^(talk to me|say something|entertain me|let'?s (talk|chat)|chat with me)\b/, () =>
    pick([`Sure! 😊 Here's something fun: ${pick(FACTS)} What would you like to talk about next?`, "Let's chat! 😄 Tell me about your day, or ask me for a story, a riddle, a quiz or a fun fact."])],

  // Choices: "pizza or burger", "should i study or sleep"
  [/^(?:should i |which should i (?:choose|pick|take)[, :]*)?([a-z][a-z ]{1,25}?) or ([a-z][a-z ]{1,25}?)$/, (m, q) => {
    if (/\b(what|who|when|where|how|why|is|are|does|do|can|will)\b/.test(m[1].split(" ")[0])) return null;
    const choice = pick([m[1], m[2]]).trim();
    return `🤔 I'd go with **${choice}**! But really, pick the one that feels right for you${/\bshould i\b/.test(q) ? " right now" : ""}.`;
  }],

  // Opinions: "what do you think about X"
  [/^(?:what do you think (?:about|of)|what'?s your opinion (?:on|about)|how do you feel about|do you like) (.{2,40})$/, (m) => {
    const x = m[1].replace(/^(the|a|an) /, "");
    return pick([
      `I think **${x}** is an interesting topic! Like most things, it has good sides and challenges. Want me to tell you the facts about ${x}, so you can decide for yourself?`,
      `I don't have personal opinions the way people do, but I can share what I know about **${x}**. Just ask "what is ${x}?"`,
    ]);
  }],
];

// The reply for everyday conversation, or null.
export function converse(question) {
  const q = clean(question);
  if (!q || q.length > 200) return null;
  for (const [pattern, reply] of INTENTS) {
    const m = q.match(pattern);
    if (!m) continue;
    const answer = reply(m, q);
    if (answer) return answer;
  }
  return null;
}

// Safety messages must win over everything else (even maths or search)
export function needsCare(question) {
  const q = clean(question);
  return INTENTS[0][0].test(q) || INTENTS[1][0].test(q);
}

export const CONVERSE_SIZE = { facts: FACTS.length, riddles: RIDDLES.length, quotes: QUOTES.length, stories: STORIES.length, intents: INTENTS.length };
