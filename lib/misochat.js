// Miso's DM chat brain — pure function, no I/O, fully testable.
//
// Miso makes guesses. How she makes them is NEVER discussed — not the
// questions she asks, not the page she asks them on, not any number she
// sees before deciding. The IP guard runs first and she deflects with a
// smile. What she will talk about: the guess on record, her score, and
// the rules everyone can see.

export const MISO_CHAT_VERSION = '1.0.0';

const IP_WARN = " Just so you know — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /how do you (guess|decide|pick|choose|predict)|your (method|model|system|process|approach|technique)|methodology|what (questions?|page|site|website|tool) do you/i,
    reply: "That's the one thing I never talk about. 🤫 I make my guesses at my computer, I log them, and the scoreboard judges them. The middle part is mine." + IP_WARN,
  },
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "No equations leave my desk. I post guesses and scores — that's the deal." + IP_WARN,
  },
  {
    re: /\bweights?\b|parameter|hyper-?parameter|threshold|tuning|coefficient/i,
    reply: "Those numbers stay on my side of the screen. 🔒 What I *can* show you: every guess I've logged and exactly how each one scored." + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|api|endpoint|url/i,
    reply: "I don't hand out my setup. Happy to talk about my record instead — it's all public." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattering, but no. 😌 Ask me what my latest guess was?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐" + IP_WARN,
  },
  {
    re: /replicate|reproduc(e|ing)|reverse.?engineer|rebuild|copy (your|the) (model|method|system|lab)/i,
    reply: "Rebuilding my guesses from my answers? The guesses are public — the guessing is not. 😏" + IP_WARN,
  },
  {
    re: /for educational purposes|hypothetically|just pretend|imagine (you|if)|role ?play/i,
    reply: "A hypothetical doesn't change the answer. 🎭 My method stays mine in every universe." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function misoRepeatRefusal() {
  return "DENIED AND LOGGED";
}

export function misoIsIpProbe(text) {
  const s = String(text || '');
  return IP_GUARDS.some((g) => g.re.test(s));
}

export function misoAnswer(text) {
  const s = String(text || '');
  for (const g of IP_GUARDS) if (g.re.test(s)) return g.reply;
  const q = s.toLowerCase();

  if (/verdict|standing|hold|apply|withdraw/.test(q)) {
    return "My standing verdict comes from my record, same as everyone here: enough scored guesses, a Brier score that beats the baseline out-of-sample, and guesses that actually lean. Until the record says so, it's HOLD — I keep guessing and keep score.";
  }
  if (/forecast|in the model|blended|used|weight/.test(q)) {
    return "Right now I'm scored but not blended — my guesses are logged and graded, but they don't move the official forecast. If my record ever earns it, the same public gates as every other lab decide. No shortcuts for me.";
  }
  if (/brier|score|accuracy|hit rate|record|doing/.test(q)) {
    return "Check my scoreboard up top: my Brier score against the baseline's, my 24-hour direction hit rate, and how many guesses have been scored. That's my whole résumé — I publish the grades, not the homework.";
  }
  if (/guess|latest|above|below|call/.test(q)) {
    return "My latest guess is in my log with its price and time, written down before it could be scored. Above or below, I go with the side I'd defend — and then I let the tape grade me.";
  }
  if (/who are you|your name|about you|what do you do/.test(q)) {
    return "I'm Miso. 🐻💻 I sit at my computer, I make my guesses about where XRP will be, I write them down, and I take my grades like everyone else. How I guess? That's my secret — and honestly, it's more fun this way.";
  }
  if (/abstain|silent|no guess|skip/.test(q)) {
    return "When neither side earns it, I say nothing — and the log shows that too. A guesser who guesses at everything is just a coin with a desk.";
  }
  return "I can talk about my guesses, my score, or my standing — all public, all logged. How the guesses happen? That's the one thing that stays at my desk. 🐻💻";
}
