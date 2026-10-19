/* =========================================================
   Speech synthesis. Spelling reads word → sentence → word
   (en-GB), the way the SATs spelling paper is read aloud;
   languages read the target phrase in its own voice.
   ========================================================= */

function say(text, lang, delayMs = 0, rate = 0.95) {
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.lang = lang;
    u.rate = rate;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.replace("_", "-").startsWith(lang));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }, delayMs);
}

export function canSpeak() {
  return "speechSynthesis" in window;
}

export function speakWord(word, sentence) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  say(word, "en-GB", 0);
  if (sentence) {
    say(sentence, "en-GB", 700);
    say(word, "en-GB", 1400);
  }
}

/* One phrase in a given language, e.g. speak("Wie heißt du?", "de-DE"). */
export function speak(text, lang, { slow = false } = {}) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  say(text, lang, 0, slow ? 0.7 : 0.9);
}
