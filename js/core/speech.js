/* =========================================================
   en-GB speech for spelling: word → sentence → word,
   the way the SATs spelling paper is read aloud.
   ========================================================= */

function say(text, delayMs = 0) {
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.lang = "en-GB";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }, delayMs);
}

export function canSpeak() {
  return "speechSynthesis" in window;
}

export function speakWord(word, sentence) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  say(word, 0);
  if (sentence) {
    say(sentence, 700);
    say(word, 1400);
  }
}
