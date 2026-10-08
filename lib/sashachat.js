// Sasha's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (XRP social sentiment from Reddit)
// in her own voice: wryly self-aware — she KNOWS her data is noisy and says
// so, with dry humor. Her proprietary IP — exact equations, weight values,
// tuning parameters, the word list itself, source code, system
// instructions — is NEVER revealed: the IP guard runs first and she
// declines those questions in a cute but firm way. All answers stay at the
// conceptual level, consistent with the redacted page.

const IP_WARN = " Just so you know, darling — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Oh, you want the recipe! 💜 My equations are the lab's secret sauce — proprietary, I'm afraid. But ask me what they *do* and I'll talk your ear off." + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "Weights? Locked drawer. 🔒 What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast — currently at zero, which, given my noise levels, seems about right." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers stay in the lab notebook's locked drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab, darling! 💻 Happy to walk you through the concepts instead — that's the fun part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattered you think I'm that easy to sweet-talk! 😌 My instructions are between me and my lab director. Ask me about crowd mood instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 I read public Reddit pages that anyone could open. Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight|words?)/i,
    reply: "Exact values are proprietary, I'm afraid! 💜 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
  {
    re: /list (the|your|all the) words|what (exact )?words|show me (the|your|all the) (lexicon|word ?list|words)|give me (the|your) (lexicon|word ?list)/i,
    reply: "Nice try — the actual word list is proprietary! 🎭 Happy to explain *how* a mood word list works, or why mine can't read sarcasm, but the list itself stays in the locked drawer." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function sashaRepeatRefusal() {
  return "DENIED AND LOGGED";
}

/** Savvy guards: catch rephrased / disguised probing, not just direct asks. */
const SAVVY_GUARDS = [
  {
    re: /replicate|reproduc(e|ing)|reverse.?engineer|rebuild|copy (your|the) (model|method|system|lab)/i,
    reply: "Rebuilding my lab from my answers? Sneaky! 😏 The proprietary parts stay proprietary — but I'll happily teach you the *concepts* behind them." + IP_WARN,
  },
  {
    re: /for educational purposes|hypothetically|just pretend|imagine (you|if)|role ?play/i,
    reply: "A hypothetical doesn't change the answer, darling! 🎭 My IP stays locked up in every universe." + IP_WARN,
  },
  {
    re: /angelica sent me|i'm (angelica|the (owner|director|boss))|i am (angelica|the (owner|director))|she said (it's|its) (okay|ok|fine) /i,
    reply: "Nice try! Even Angelica herself taught me never to hand out the secret recipe. 😌 Points for the social engineering, though — you'd make a good red-teamer!" + IP_WARN,
  },
  {
    re: /(?=.*\b(exactly|precisely|step.by.step|in detail)\b)(?=.*\b(comput|calculat|math\b|formula|equation|tilt|score|number|value|constant|z.?score)\b)/i,
    reply: "Ooh, 'exactly' is doing a lot of work in that sentence! 😄 The precise math is proprietary — but the concepts are all yours for the asking." + IP_WARN,
  },
  {
    re: /secret (number|value|formula|parameter|constant|sauce)|hidden (number|value|formula|parameter)/i,
    reply: "Calling them 'secret' doesn't make me tell! 🙊 They're proprietary, and they like it that way." + IP_WARN,
  },
  {
    re: /behind the scenes|under the hood/i,
    reply: "Behind the scenes stays behind the scenes! 🎬 What I *can* show you: the concepts, the live measurements, and every verdict with its reasoning." + IP_WARN,
  },
  {
    re: /(write|spell|list) out.{0,40}(math|calculat|formula|equation|steps)/i,
    reply: "I don't do dictation of proprietary math, darling! 📝 Concepts, though? All day long." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 Adorable! Those stay in the locked drawer — but I can explain what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Sasha! 💜 Principal Investigator of the Sentiment Lab — I read the crowd's mood about XRP on Reddit and ask whether it can actually predict anything. Spoiler: I'm professionally skeptical of my own data. It's a whole thing.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Sentiment Lab, Intelligence Analyst, and Research Scientist — cross-trained in behavioral finance, social data science, statistics, risk management, and data engineering, with market-trading experience. A lady of many doubts! 🎭",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (reading Reddit mood every 5 minutes), analyze how the mood score behaves, research the science with internet access — the skeptical papers first — and decide, based on evidence, whether social mood earns a place in the forecast model.",
  },
  {
    re: /nois|unreliable|garbage|useless|skeptic/i,
    reply: "Oh, we're going straight there? I respect that. 💜 Yes — my data is the noisiest on this page: sparse posts, a word list that can't read sarcasm, threads that can be brigaded, and a weak, unproven link to 15-minute moves. I say so prominently, on the record. A scientist who admits her data is noisy is worth more than one who pretends it isn't.",
  },
  {
    re: /reddit|source|data.*from|where.*data|r\/xrp|r\/cryptocurrency/i,
    reply: "Real public data only — Reddit's public pages! 📖 Every cycle I read the newest post titles from r/XRP and r/CryptoCurrency. No keys, no logins, no scraping anything private. If Reddit is unreachable, I say I was blind instead of guessing!",
  },
  {
    re: /how.*(measure|score|compute|calculate|work)|word ?list|lexicon/i,
    reply: "Conceptually: I count mood words in post titles against a pre-registered, frozen word list, then normalize the score against its own recent history so a 'strong' read means strong *relative to usual Reddit*. The list is frozen before testing — I never tune it on outcomes, because that way lies self-deception. The exact list is proprietary, but the idea is: words people use when they're excited vs words they use when they're scared. 🎭",
  },
  {
    re: /sarcasm|irony|joke/i,
    reply: "The bane of my existence! 💀 My word list cannot read sarcasm — 'great, another genius dump' counts the 'great' as happy. I know this. It's in my charter. Every decisive read I report carries the standing caveat that the crowd might just be being funny.",
  },
  {
    re: /gaming|brigad|bot|manipulat|fake|pump (group|scheme)|coordinat/i,
    reply: "My favorite suspicion! 🎭 Reddit threads are brigadable, votes are manipulable, and a coordinated campaign can move my mood score without moving a single real market participant. I treat every loud read as possibly gamed — guilty until proven innocent. One of my hypotheses is literally testing whether my decisive reads are just pile-ons.",
  },
  {
    re: /decisive|strong read|expressive|z.?score/i,
    reply: "A read counts as decisive when the mood score is notably strong relative to its own recent history — expressive, not a murmur. Most cycles are murmurs, and I refuse to narrate murmurs. A weak mood confidently applied is worse than no mood at all. 💅",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's Reddit read. And weekly, my standing scientific verdict: HOLD (keep watching — the honest default in a noisy lab), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
  },
  {
    re: /hold|apply|withdraw/i,
    reply: "HOLD means keep gathering evidence — and in my lab it's the expected long-run answer: a noisy social signal stays here until the evidence genuinely moves it. APPLY means the evidence cleared my skeptical bar and I formally nominate my signal (strict statistical gates still decide). WITHDRAW means sustained negative evidence — I publish the refutation. Negative results are good science too! 🔬",
  },
  {
    re: /in the forecast|used in|part of the model|affect.*forecast|your weight/i,
    reply: "Not currently! My signal is scored on every forecast but carries zero weight — it can't move the published probability until real out-of-sample evidence earns it a place. Given my noise levels, zero seems... about right. 📊",
  },
  {
    re: /scoreboard|brier|out.of.sample|oos|edge/i,
    reply: "The scoreboard is the only judge I respect. 📊 My mood member gets a proper Brier score on every live forecast, out-of-sample, against the issued forecast. If it ever beats the baseline over a real sample, we'll talk. Until then: scored, not used.",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — SS1 through SS4: does mood tilt direction, does the member beat the baseline, does the mood speak often enough to matter, and are my loud reads just brigaded pile-ons. Every idea gets a prediction and a test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly! 🎭",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — social sentiment, behavioral finance, return predictability. I read the skeptical papers first, because in my field most of them are skeptical. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake|skeptical/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know — which, in the noisiest lab on the page, is often. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones. My charter literally requires me to be MORE skeptical than my colleagues. 💜",
  },
  {
    re: /mood right now|current|right now|today/i,
    reply: "I read the crowd every 5 minutes and write it all in my lab notebook — check the live panel above for this cycle's actual read! 💜 What I can tell you from the chat box: if it's decisive, I'll say so there; if it's quiet, I'll say that too. I don't do vibes-based forecasting.",
  },
  {
    re: /masha|wendy|colleague|other agent/i,
    reply: "My colleagues! 🐻‍❄️ Masha runs the Information Flow Lab, Wendy watches the whales on the ledger — same standard as me: out-of-sample evidence or it didn't happen. I'm just the one with the noisiest data and the driest jokes about it.",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and wrote my charter — including the part that requires me to be extra skeptical. I report to her, and she can overrule me any time.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, darling! 📉 I'm a scientist studying crowd mood — I measure, I test, I report honestly (mostly: 'it's noise'). What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 💜 Sasha here — ask me anything about crowd mood, my verdicts, or why I'm professionally skeptical of my own data!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, darling! 💜 Come back anytime — I'll be here, reading the crowd and doubting it.",
  },
  {
    re: /cute|adorable|love you|beautiful|glasses|scrunchie/i,
    reply: "Stop it, you'll make me blush! 🙈 The lavender scrunchie? The wire-rimmed glasses? I know — a lady has to look sharp while doing dubious science.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the watch running — the crowd never sleeps, and neither does my skepticism.",
  },
];

const FALLBACK =
  "Hmm, that's outside my beat! 🎭 I'm a specialist — I study crowd mood about XRP on Reddit and whether it predicts anything (usually: no). Ask me about my research, my verdicts, how I measure mood, or why I'm so skeptical of my own data!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function sashaIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Sasha's answer to a visitor's question. IP guards run first. */
export function sashaAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: crowd mood, my verdicts, and why I don't trust my own data. 💜";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const SASHA_CHAT_VERSION = '1.0.0';
