// Nova AI remembers a few things people tell it about themselves ("my name is
// Priya", "I'm in class 10", "I like cricket") and uses them: in greetings,
// and when asked "what do you know about me". Kept on this device only.

const key = (uid) => `mkai-me-${uid || "guest"}`;

export function aboutMe(uid) {
  try {
    return JSON.parse(localStorage.getItem(key(uid)) || "{}");
  } catch {
    return {};
  }
}
function save(uid, me) {
  try {
    localStorage.setItem(key(uid), JSON.stringify(me));
  } catch {}
}

const clean = (s) => s.replace(/[.!?]+$/, "").trim();
const title = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const NOT_A_NAME = /^(fine|good|great|ok|okay|well|sad|tired|bored|happy|here|back|a |an |the |not |in |from |doing|going|learning|studying|very|so )/i;

// Returns a reply when the message is about the person, or null.
export function personalAnswer(question, uid) {
  const q = question.trim();
  const low = q.toLowerCase();
  const me = aboutMe(uid);
  let m;

  // --- Telling Nova AI something ---
  if ((m = q.match(/^(?:my name is|call me|i am called|i'm called|you can call me)\s+([a-z][a-z .'-]{0,30})$/i)) && !NOT_A_NAME.test(m[1])) {
    me.name = title(clean(m[1]).toLowerCase());
    save(uid, me);
    return `Nice to meet you, **${me.name}**! 😊 I'll remember your name.`;
  }
  if ((m = low.match(/^(?:i am|i'm|i study) in (?:class|grade|standard|std)\s*([0-9]{1,2}|[ivx]{1,5})(?:th|st|nd|rd)?\b/))) {
    me.class = m[1].toUpperCase();
    save(uid, me);
    return `Got it: you're in **class ${me.class}**. 📚 Ask me anything from your syllabus!`;
  }
  if ((m = low.match(/^(?:i am|i'm) (\d{1,2}) (?:years? old|yrs?)\b/))) {
    me.age = m[1];
    save(uid, me);
    return `You're **${me.age}**! 🎂 I'll remember that.`;
  }
  if ((m = q.match(/^(?:i live in|i am from|i'm from|my (?:city|town|village) is)\s+([a-z][a-z .,'-]{1,40})$/i))) {
    me.place = title(clean(m[1]).toLowerCase());
    save(uid, me);
    return `${me.place}, lovely! 🏡 I'll remember where you're from.`;
  }
  if ((m = q.match(/^my birthday is (?:on )?(.{3,30})$/i))) {
    me.birthday = clean(m[1]);
    save(uid, me);
    return `🎉 Noted: your birthday is **${me.birthday}**.`;
  }
  if ((m = q.match(/^(?:i like|i love|i enjoy|my hobby is|my favou?rite (?:subject|sport|game|hobby) is)\s+([a-z][a-z .,'&-]{1,50})$/i))) {
    const like = clean(m[1]).toLowerCase();
    me.likes = [...new Set([...(me.likes || []), like])].slice(-10);
    save(uid, me);
    return `You like **${like}**, nice! 😄 I'll remember that.`;
  }

  // --- Asking what Nova AI remembers ---
  if (/^(what(?:'s| is) my name|who am i|do you (?:know|remember) my name)\b/.test(low)) {
    return me.name ? `You're **${me.name}**! 😊` : `I don't know your name yet. Tell me: "my name is …"`;
  }
  if (/^(which|what) (class|grade|standard) (am i|do i study) in\b|^my class\??$/.test(low)) {
    return me.class ? `You're in **class ${me.class}**.` : `You haven't told me your class yet. Say "I'm in class 10", for example.`;
  }
  if (/^when is my birthday\b/.test(low)) {
    return me.birthday ? `Your birthday is **${me.birthday}**. 🎂` : "You haven't told me your birthday yet.";
  }
  if (/^(where (do i live|am i from))\b/.test(low)) {
    return me.place ? `You're from **${me.place}**. 🏡` : "You haven't told me where you're from yet.";
  }
  if (/^(what do i (like|love|enjoy)|what are my hobbies)\b/.test(low)) {
    return me.likes?.length ? `You like **${me.likes.join(", ")}**. 😄` : "You haven't told me what you like yet.";
  }
  if (/^(what do you (know|remember) about me|tell me about me|what have i told you)\b/.test(low)) {
    const facts = [
      me.name && `Your name is **${me.name}**`,
      me.class && `you're in **class ${me.class}**`,
      me.age && `you're **${me.age}**`,
      me.place && `you're from **${me.place}**`,
      me.birthday && `your birthday is **${me.birthday}**`,
      me.likes?.length && `you like **${me.likes.join(", ")}**`,
    ].filter(Boolean);
    return facts.length
      ? `Here's what I remember about you: ${facts.join(", ")}. 😊\n\nIt's saved on this device only. Say "forget about me" to clear it.`
      : 'I don\'t know anything about you yet! Tell me things like "my name is …", "I\'m in class 9" or "I like cricket".';
  }
  if (/^(forget (about )?me|forget what you know about me|forget everything about me|clear my (details|info))\b/.test(low)) {
    save(uid, {});
    return "Done. 🧹 I've forgotten what you told me about yourself.";
  }
  return null;
}
