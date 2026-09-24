// Thirukkural: famous kurals by Thiruvalluvar, in Tamil with their meaning.
// "give me a thirukkural", "kural on friendship", "kural 391", "thirukural
// about education" → a kural. Runs on the device.

// [number, section, topic words, Tamil (two lines), meaning]
const KURALS = [
  [1, "Aram (virtue) · Praise of God", ["god", "first", "letters", "alphabet"], "அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு", "As the letter A is the first of all letters, so God, the Primal One, is the first of the world."],
  [2, "Aram · Praise of God", ["learning", "god", "education"], "கற்றதனால் ஆய பயனென்கொல் வாலறிவன்\nநற்றாள் தொழாஅர் எனின்", "What use is all one's learning if one does not bow at the feet of the One of pure knowledge?"],
  [34, "Aram · Power of virtue", ["mind", "virtue", "purity", "honesty"], "மனத்துக்கண் மாசிலன் ஆதல் அனைத்தறன்\nஆகுல நீர பிற", "Being spotless in mind is the whole of virtue; everything else is mere noise and show."],
  [45, "Aram · Married life", ["family", "love", "home", "marriage"], "அன்பும் அறனும் உடைத்தாயின் இல்வாழ்க்கை\nபண்பும் பயனும் அது", "If home life has love and virtue, that is its grace and its reward."],
  [71, "Aram · Love", ["love", "tears", "kindness"], "அன்பிற்கும் உண்டோ அடைக்குந்தாழ் ஆர்வலர்\nபுன்கணீர் பூசல் தரும்", "Is there any lock that can shut love in? The tears of loving people reveal it."],
  [72, "Aram · Love", ["love", "selfless", "sharing"], "அன்பிலார் எல்லாம் தமக்குரியர் அன்புடையார்\nஎன்பும் உரியர் பிறர்க்கு", "The loveless keep everything for themselves; the loving give even their bones to others."],
  [80, "Aram · Love", ["love", "life"], "அன்பின் வழியது உயிர்நிலை அஃதிலார்க்கு\nஎன்புதோல் போர்த்த உடம்பு", "A living being is one that follows love; without love, a body is just bones covered with skin."],
  [100, "Aram · Sweet speech", ["speech", "words", "kind words", "talk"], "இனிய உளவாக இன்னாத கூறல்\nகனியிருப்பக் காய்கவர்ந் தற்று", "Speaking harsh words when kind words are there is like picking unripe fruit when ripe fruit is at hand."],
  [101, "Aram · Gratitude", ["gratitude", "help", "thanks", "helping"], "செய்யாமல் செய்த உதவிக்கு வையகமும்\nவானகமும் ஆற்றல் அரிது", "Earth and heaven together cannot repay a help given without any help received first."],
  [102, "Aram · Gratitude", ["gratitude", "help", "time", "thanks"], "காலத்தி னாற்செய்த நன்றி சிறிதெனினும்\nஞாலத்தின் மாணப் பெரிது", "A help given at the right time, however small, is greater than the whole world."],
  [110, "Aram · Gratitude", ["gratitude", "ungrateful", "thanks"], "எந்நன்றி கொன்றார்க்கும் உய்வுண்டாம் உய்வில்லை\nசெய்ந்நன்றி கொன்ற மகற்கு", "There is escape for those who destroy any other good, but none for one who forgets a kindness received."],
  [129, "Aram · Self-control", ["speech", "anger", "words", "hurt"], "தீயினாற் சுட்டபுண் உள்ளாறும் ஆறாதே\nநாவினாற் சுட்ட வடு", "A wound made by fire heals inside, but a scar made by the tongue never heals."],
  [151, "Aram · Patience", ["patience", "forgiveness", "tolerance"], "அகழ்வாரைத் தாங்கும் நிலம்போலத் தம்மை\nஇகழ்வார்ப் பொறுத்தல் தலை", "Like the earth that bears even those who dig into it, the best thing is to bear those who insult you."],
  [314, "Aram · Not harming", ["enemy", "revenge", "kindness", "forgiveness"], "இன்னாசெய் தாரை ஒறுத்தல் அவர்நாண\nநன்னயஞ் செய்து விடல்", "The way to punish those who harm you is to shame them by doing them good."],
  [391, "Porul (wealth) · Learning", ["education", "learning", "study", "students"], "கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தக", "Learn thoroughly what is worth learning, and then live by what you have learnt."],
  [392, "Porul · Learning", ["education", "numbers", "letters", "eyes", "learning"], "எண்ணென்ப ஏனை எழுத்தென்ப இவ்விரண்டும்\nகண்ணென்ப வாழும் உயிர்க்கு", "Numbers and letters are the two eyes of all living people."],
  [396, "Porul · Learning", ["education", "knowledge", "learning", "study"], "தொட்டனைத் தூறும் மணற்கேணி மாந்தர்க்குக்\nகற்றனைத் தூறும் அறிவு", "As a well in sand gives more water the deeper you dig, knowledge grows the more you learn."],
  [400, "Porul · Learning", ["education", "wealth", "learning"], "கேடில் விழுச்செல்வம் கல்வி ஒருவற்கு\nமாடல்ல மற்றை யவை", "Learning is the true wealth that never perishes; other riches are not real wealth."],
  [423, "Porul · Knowledge", ["knowledge", "wisdom", "truth", "thinking"], "எப்பொருள் யார்யார்வாய்க் கேட்பினும் அப்பொருள்\nமெய்ப்பொருள் காண்பது அறிவு", "Whatever you hear, from whoever says it, wisdom is finding the truth in it."],
  [467, "Porul · Acting with thought", ["planning", "decision", "action", "thinking"], "எண்ணித் துணிக கருமம் துணிந்தபின்\nஎண்ணுவம் என்பது இழுக்கு", "Think well before you begin a task; to begin and then think is a mistake."],
  [619, "Porul · Effort", ["effort", "hard work", "success", "work"], "தெய்வத்தான் ஆகா தெனினும் முயற்சிதன்\nமெய்வருத்தக் கூலி தரும்", "Even if fate does not help, hard effort always pays back the wages of one's labour."],
  [621, "Porul · Courage in trouble", ["courage", "trouble", "problems", "smile", "difficulty"], "இடுக்கண் வருங்கால் நகுக அதனை\nஅடுத்தூர்வது அஃதொப்ப தில்", "When trouble comes, laugh at it; nothing defeats trouble like that."],
  [664, "Porul · Firm action", ["action", "words", "promise", "doing"], "சொல்லுதல் யார்க்கும் எளிய அரியவாம்\nசொல்லிய வண்ணம் செயல்", "Saying is easy for anyone; doing what one has said is hard."],
  [667, "Porul · Firm action", ["appearance", "judging", "respect", "small"], "உருவுகண்டு எள்ளாமை வேண்டும் உருள்பெருந்தேர்க்கு\nஅச்சாணி அன்னார் உடைத்து", "Do not look down on people for their size or looks; a great rolling chariot depends on a tiny linchpin."],
  [788, "Porul · Friendship", ["friendship", "friend", "help", "friends"], "உடுக்கை இழந்தவன் கைபோல ஆங்கே\nஇடுக்கண் களைவதாம் நட்பு", "Like a hand that quickly catches a slipping garment, true friendship removes a friend's trouble at once."],
  [948, "Porul · Medicine", ["health", "doctor", "medicine", "disease", "problem solving"], "நோய்நாடி நோய்முதல் நாடி அதுதணிக்கும்\nவாய்நாடி வாய்ப்பச் செயல்", "Find the disease, find its cause, find the way to cure it, and then act carefully."],
  [1031, "Porul · Farming", ["farming", "agriculture", "farmer", "work"], "சுழன்றும்ஏர்ப் பின்னது உலகம் அதனால்\nஉழந்தும் உழவே தலை", "Wherever the world wanders, it follows the plough; so farming, though hard, is the best work."],
];

const clean = (q) => q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
// "thirukkural", "thirukural", "tirukkural", "thirukural", "kural", "kurals"
const KURAL_WORD = /\b(th?iru\s*k*\s*k?u?rr?a?l|th?irukk?ural|kurals?|thiruvalluvar (?:quote|saying|verse)s?)\b/;
const FACT_QUESTION = /\b(who wrote|who is|what is|what are|how many|when was|meaning of the word|author)\b/;

function show(k, intro = "") {
  const [n, section, , tamil, meaning] = k;
  return `${intro}📜 **Thirukkural ${n}** (${section})\n\n${tamil}\n\n**Meaning:** ${meaning}\n\n— Thiruvalluvar`;
}

export function thirukkural(question) {
  const q = clean(question);
  if (!KURAL_WORD.test(q)) return null;
  // "who wrote thirukkural", "how many kurals" — facts come from the knowledge base
  if (FACT_QUESTION.test(q) && !/\b(give|tell|say|share|show|one|some|any|a kural|random|today)\b/.test(q)) return null;
  const num = q.match(/\b(?:kural|number|no)\s*(\d{1,4})\b|\b(\d{1,4})(?:st|nd|rd|th)?\s*kural\b/);
  if (num) {
    const n = Number(num[1] || num[2]);
    const k = KURALS.find((x) => x[0] === n);
    if (k) return show(k);
    if (n >= 1 && n <= 1330) return `I don't have kural ${n} memorised yet 🙏 (there are 1,330 in all). I know these by heart: ${KURALS.map((x) => x[0]).join(", ")}. Ask for any of them, or teach me kural ${n} below!`;
  }
  // A topic: "kural on friendship", "thirukkural about education"
  const words = q.split(" ");
  const onTopic = KURALS.filter((k) => k[2].some((t) => (t.includes(" ") ? q.includes(t) : words.includes(t) || words.includes(t + "s"))));
  const many = /\b(some|few|all|list|kurals|two|three|3|5|five)\b/.test(q);
  const pool = onTopic.length ? onTopic : KURALS;
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  if (many) {
    const count = Math.min(/\b(five|5)\b/.test(q) ? 5 : 3, shuffled.length);
    return `Here are ${count} kurals${onTopic.length ? " on that topic" : ""} from the Thirukkural 📜\n\n` + shuffled.slice(0, count).map((k) => show(k).replace(/\n\n— Thiruvalluvar$/, "")).join("\n\n---\n\n") + "\n\n— Thiruvalluvar";
  }
  return show(shuffled[0]);
}

export const KURAL_COUNT = KURALS.length;
