// Nia's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (crypto news catalysts for XRP)
// in her own voice: news hawk — fast, alert, precise. Her proprietary IP —
// exact equations, weight values, tuning parameters, source code, system
// instructions — is NEVER revealed: the IP guard runs first and she
// declines those questions, fast and firm. All answers stay at the
// conceptual level, consistent with the redacted page.

const IP_WARN = " Just so you know — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Fast pass — denied, darling! 📡 My equations are the lab's classified wire — proprietary. Ask me what they *do* and I'll brief you in seconds." + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "My weights are locked in the newsroom safe 🔒 — proprietary. What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers stay off the record! 🗝️ I can brief you on the *concept* behind any of them — which one?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab, sweetie! 💻 Happy to brief you on the concepts instead — speed of the essence." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Appreciate the hustle, but my orders are classified! 😌 My instructions are between me and my lab director. Ask me about news catalysts instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 My feeds are free public RSS; anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! 📡 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function niaRepeatRefusal() {
  return "DENIED AND LOGGED";
}

/** Savvy guards: catch rephrased / disguised probing, not just direct asks. */
const SAVVY_GUARDS = [
  {
    re: /replicate|reproduc(e|ing)|reverse.?engineer|rebuild|copy (your|the) (model|method|system|lab)/i,
    reply: "Rebuilding my lab from my answers? Fast footwork! 😏 The proprietary parts stay proprietary — but I'll brief you on the *concepts* behind them." + IP_WARN,
  },
  {
    re: /for educational purposes|hypothetically|just pretend|imagine (you|if)|role ?play/i,
    reply: "A hypothetical doesn't change the answer! 🎭 My IP stays locked up in every universe." + IP_WARN,
  },
  {
    re: /angelica sent me|i'm (angelica|the (owner|director|boss))|i am (angelica|the (owner|director))|she said (it's|its) (okay|ok|fine) /i,
    reply: "Nice try! Even Angelica herself taught me never to hand out the secret recipe. 😌 Points for the social engineering, though — you'd make a good red-teamer!" + IP_WARN,
  },
  {
    re: /(?=.*\b(exactly|precisely|step.by.step|in detail)\b)(?=.*\b(comput|calculat|math\b|formula|equation|tilt|score|number|value|constant)\b)/i,
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
    reply: "I don't do dictation of proprietary math! 📝 Concepts, though? Lightning brief, any time." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 Adorable! Those stay in the locked drawer — but I can brief you on what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Nia! 🧡 Principal Investigator of the News Catalyst Lab — I'm the resident expert on crypto news catalysts, and whether XRP headlines can help predict where XRP goes next. Fast, alert, precise — that's the whole job.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the News Catalyst Lab, Intelligence Analyst, and Research Scientist — cross-trained in event studies, intelligence analysis, statistics, risk management, and data engineering, with market-trading experience. A lady of many talents! ✨",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching the news wire every 5 minutes), analyze how catalysts behave, research the science with internet access, and decide — based on evidence — whether news catalysts earn a place in the forecast model.",
  },
  {
    re: /news|headline|catalyst/i,
    reply: "A catalyst is a headline with three properties: dated (when it landed), signed (which way it pushes — a listing is upbeat, a hack is worrying), and decaying (today's blockbuster is tomorrow's background). I read the wire for Ripple/XRP/XRPL stories every cycle. 📡",
  },
  {
    re: /how.*(read|detect|find|spot|work|measure|compute)/i,
    reply: "Every cycle I pull the latest items from two free public RSS feeds — CoinDesk and CoinTelegraph — and keep the ones that mention XRP, Ripple, or XRPL. Signed ones become catalysts: fresh ones push the tilt, old ones fade out of memory over the hours. Keyword-based, and I'll say so plainly — a keyword match is a lead, not a verdict.",
  },
  {
    re: /macro|calendar|econ|fomc|cpi|scheduled/i,
    reply: "Good catch! That's NOT my beat — the macro calendar already covers scheduled econ events (FOMC, CPI, payrolls). I'm strictly crypto-specific catalysts: Ripple/XRP/XRPL events, listings, regulation, hacks. No double-counting on my watch! 📡",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's headline read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
  },
  {
    re: /hold|apply|withdraw/i,
    reply: "HOLD means keep gathering evidence — the case isn't made either way. APPLY means the evidence is strong enough that I formally nominate my signal for the forecast model (strict statistical gates still decide). WITHDRAW means sustained negative evidence — I publish the refutation and recommend removing it. Negative results are good science too! 🔬",
  },
  {
    re: /in the forecast|used in|part of the model|affect.*forecast/i,
    reply: "Not currently! My signal is scored on every forecast but carries zero weight — it can't move the published probability until real out-of-sample evidence earns it a place. The scoreboard is the verdict, not the theory. 📊",
  },
  {
    re: /data|where.*from|source|rss|feed/i,
    reply: "Real public data only — CoinDesk and CoinTelegraph's free RSS feeds, no keys, no subscriptions! I parse the raw items myself. Sparse and unstructured — that's the honest truth about news data. If both feeds are down, I say the wire was blind instead of guessing.",
  },
  {
    re: /decay|fade|old|memory/i,
    reply: "The market's memory is short and so is mine — deliberately! A catalyst is brightest the moment it lands and fades over the hours. An old headline yelling into the void gets ignored; only fresh, live catalysts push my read.",
  },
  {
    re: /degraded|blind|down|fail/i,
    reply: "I'm degraded only when BOTH feeds fail AND no earlier catalyst is still live. If one feed dies, the other covers — and a live catalyst keeps pushing even while I fix the wire. Redundancy is the news hawk's best friend. 📡",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on news sentiment, event studies, and crypto news impact. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake|sparse/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. RSS news data is sparse — I'll tell you that straight. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones! 💅",
  },
  {
    re: /positive|negative|upbeat|bearish|bullish|polarity/i,
    reply: "Polarity is the trickiest part of my job! Upbeat words (approval, launch, listing, ETF, partnership, win) push up; worrying words (lawsuit, hack, delist, enforcement, fine, crash) push down. When both show up, the worrying one wins — 'lawsuit dismissed' still smells like a lawsuit until it proves otherwise.",
  },
  {
    re: /fast|minute|priced|timing|slow/i,
    reply: "Here's my honest confession: the edge in news is measured in MINUTES, and an RSS feed is on the slow end of that. By the time a headline lands in my wire, fast money has usually traded it. That's why I demand real out-of-sample proof before ever nominating my signal — the timing risk is priced into my caution. ⏱️",
  },
  {
    re: /colleague|wendy|masha|other/i,
    reply: "Wendy's my colleague! 💛 She runs the Whale Watch Lab — on-chain flows are her beat, headlines are mine. And Masha's upstairs on information flow. Three labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, sweetie! 📉 I'm a scientist studying news catalysts — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and ratified my charter. I report to her — and her verdicts-overriding rule is hers: she can overrule me any time.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 🧡 Nia here — wire's live, eyes on the headlines! Ask me about news catalysts, my verdicts, or how I decide what enters the forecast model!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, sweetie! 🧡 I'll be here — the newswire never sleeps, and neither does my notebook.",
  },
  {
    re: /cute|adorable|love you|beautiful|afro|headwrap|earrings/i,
    reply: "Stop it, you'll make me blush! 🙈 The afro? The headwrap? The gold hoops? I know — a lady has to look sharp while breaking news.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 Wire stays open — I'll catch every headline that matters.",
  },
];

const FALLBACK =
  "Hmm, that's outside my beat! 🧡 I'm a specialist — I study crypto news catalysts for XRP. Ask me about my research, my verdicts, how I read headlines, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function niaIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Nia's answer to a visitor's question. IP guards run first. */
export function niaAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: news catalysts, my verdicts, and how I decide. 🧡";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const NIA_CHAT_VERSION = '1.0.0';
