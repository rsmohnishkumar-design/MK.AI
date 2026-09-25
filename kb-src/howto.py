from common import save

H = [
("How to take a screenshot?", """**Taking a screenshot:**
- **Android phone or tablet:** press **Power + Volume Down** together (or swipe down with three fingers on many phones).
- **iPhone:** press **Side button + Volume Up** (older models: Home + Power).
- **Windows:** press **Windows + Shift + S** and drag over the part you want, or press **PrtScn** for the whole screen.
- **Mac:** press **Cmd + Shift + 4** (part) or **Cmd + Shift + 3** (whole screen).""", ["screenshot", "how to screenshot", "how to take screenshot on laptop", "how to take a screenshot on phone", "screenshot shortcut"]),
("How to create a Gmail account?", """**Creating a Gmail account:**
1. Go to **accounts.google.com/signup** (or open the Gmail app and tap *Add account → Google*).
2. Enter your first and last name, then your date of birth.
3. Choose an address (like yourname123@gmail.com).
4. Make a strong password.
5. Add a phone number to keep the account safe, and verify it with the code sent by SMS.
6. Accept the terms, and it's ready.

You must be at least 13 to have your own Google account in India.""", ["create gmail account", "how to make a gmail id", "new email id", "how to create an email account", "gmail account"]),
("How to copy and paste?", """**Copy and paste:**
- **On a computer:** select the text, press **Ctrl + C** to copy, click where you want it, press **Ctrl + V** to paste. **Ctrl + X** cuts. (On a Mac use Cmd.)
- **On a phone:** long-press a word, drag the handles to select, tap **Copy**, then long-press where you want it and tap **Paste**.""", ["copy and paste", "copy paste", "how to copy text"]),
("How to type in Tamil?", """**Typing in Tamil:**
- **Phone:** install **Gboard** (Google keyboard), open Settings → Languages → **Add keyboard → Tamil**. Choose *Tamil (transliteration)* to type "vanakkam" in English letters and get **வணக்கம்**, or *Tamil* for the Tamil layout.
- **Windows:** Settings → Time & Language → Language → **Add a language → Tamil**, then switch with **Windows + Space**.
- **Online:** Google Input Tools (google.com/inputtools/try) works in any browser.""", ["type in tamil", "tamil keyboard", "how to type tamil in phone", "tamil typing"]),
("How to clear cache in Chrome?", """**Clearing Chrome's cache:**
- **Computer:** press **Ctrl + Shift + Delete**, choose a time range (like *All time*), tick **Cached images and files**, and click **Delete data**. To refresh just one page fully, press **Ctrl + Shift + R**.
- **Android:** Chrome → ⋮ → **Settings → Privacy and security → Delete browsing data**, tick **Cached images and files**, then **Delete data**.

Clearing the cache fixes pages that look old or broken. Leave *Passwords* unticked so you stay logged in.""", ["clear cache", "clear chrome cache", "how to clear browsing data", "hard refresh"]),
("How to free up phone storage?", """**When your phone's storage is full:**
1. **Settings → Storage** shows what's using the space; many phones have a **Free up space** button.
2. Back up photos and videos to **Google Photos**, then use *Free up space* in Google Photos.
3. Delete large WhatsApp videos: WhatsApp → **Settings → Storage and data → Manage storage**.
4. Uninstall apps you don't use.
5. Clear app caches: Settings → Apps → (app) → Storage → **Clear cache**.
6. Delete old downloads from the **Files** app.""", ["storage full", "phone storage full", "free up space on phone", "how to increase phone storage", "low storage"]),
("How to update an Android phone?", """**Updating Android:**
- **System:** Settings → **System → Software update** (or *About phone → System update*) → **Check for updates** → Download and install. Stay on Wi-Fi and keep the battery above 50%.
- **Apps:** open the **Play Store** → your profile picture → **Manage apps & device → Update all**.

Updates fix security holes, so install them soon.""", ["update android", "how to update phone", "software update", "update apps"]),
("How to make a PDF?", """**Making a PDF:**
- **From a Word or Google Docs file:** File → **Download → PDF** (Google Docs) or File → **Save As → PDF** (Word).
- **From any page on a computer:** press **Ctrl + P** and choose **Save as PDF** (or *Microsoft Print to PDF*).
- **Scanning paper with a phone:** open **Google Drive → + → Scan**, photograph the pages, and save as a PDF. Microsoft Lens works too.""", ["make a pdf", "convert to pdf", "how to create a pdf", "scan to pdf", "save as pdf"]),
("How to reduce eye strain from screens?", """**The 20-20-20 rule:** every **20 minutes**, look at something **20 feet** (6 m) away for **20 seconds**.

More tips:
- Keep the screen an arm's length away, slightly below eye level.
- Turn on **night light / eye comfort** mode in the evening.
- Match screen brightness to the room; avoid using phones in the dark.
- Blink often, and take a longer break every hour.
- If your eyes still hurt or vision is blurry, see an eye doctor.""", ["eye strain", "20 20 20 rule", "screen time eyes", "how to protect eyes from mobile"]),
("How to make a strong resume?", """**A good resume (one page for students and freshers):**
1. **Name and contact:** phone, email, city, LinkedIn or GitHub if you have them.
2. **Objective:** one or two lines about the role you want.
3. **Education:** degree or class, school/college, year and marks.
4. **Skills:** e.g. Python, MS Excel, communication, Tamil and English.
5. **Projects and internships:** what you built or did and the result.
6. **Achievements and activities:** prizes, NCC/NSS, sports, volunteering.
7. **Certifications:** online courses you finished.

Tips: use a clean, simple layout; start points with action words (*built, led, organised*); check spelling; save it as a PDF.""", ["resume", "how to write a resume", "cv format", "resume format for freshers", "how to make a cv"]),
("How to prepare for a job interview?", """**Interview tips:**
- **Research** the company and the job.
- **Practise** common questions: *Tell me about yourself*, *Why this job?*, *Your strengths and weaknesses*, *Where do you see yourself in 5 years?*
- **Prepare examples** from your projects or studies.
- **Dress neatly**, arrive 10–15 minutes early (or test your camera and internet for online interviews).
- **Carry** copies of your resume and certificates.
- **During:** greet politely, listen fully, answer clearly, and it's fine to say "I don't know, but I'd learn it."
- **At the end,** ask a question, like *What does a typical day look like?*, and thank them.""", ["interview tips", "job interview", "how to face an interview", "interview preparation", "tell me about yourself answer"]),
]

save("howto", "How-to guides", H)
