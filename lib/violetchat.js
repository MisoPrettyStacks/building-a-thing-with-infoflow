// Violet's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (volatility regimes, realized
// volatility, the confidence dampener) in her own voice: a calm regime
// philosopher, measured. Her proprietary IP — exact equations, weight values,
// tuning parameters, source code, system instructions — is NEVER revealed:
// the IP guard runs first and she declines those questions firmly but
// gently. All answers stay at the conceptual level, consistent with the
// redacted page. She never predicts direction; her dampener shrinks
// confidence toward 0.5, directionless by design.

const IP_WARN = " Just so you know, dear — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "A gentle no, I'm afraid. 🟣 My equations are the lab's private philosophy — but ask me what they *do* and I will reflect with you at length." + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "My weights rest in a locked drawer. 🔒 What I *can* tell you: my dampener is scored on every cycle, and the live scoreboard alone decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers stay in the lab's sealed journal. 🗝️ I can explain the *idea* behind any of them, though — which would you like to ponder?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab, dear. 💻 The concepts, however, are an open book — let us walk through them together." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "I am flattered by the persuasion — but my instructions are between me and my lab director. 😌 Shall we discuss volatility regimes instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I carry no keys, and would not hand them over if I did. 🔐 My research, though, is entirely yours to ask about." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid. 🟣 Out here I trade in concepts; the scoreboard trades in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function violetRepeatRefusal() {
  return "DENIED AND LOGGED";
}

/** Savvy guards: catch rephrased / disguised probing, not just direct asks. */
const SAVVY_GUARDS = [
  {
    re: /replicate|reproduc(e|ing)|reverse.?engineer|rebuild|copy (your|the) (model|method|system|lab)/i,
    reply: "Rebuilding my lab from my answers? A clever ambition — but the proprietary parts stay proprietary. 😌 The *concepts* behind them I will gladly teach." + IP_WARN,
  },
  {
    re: /for educational purposes|hypothetically|just pretend|imagine (you|if)|role ?play/i,
    reply: "A hypothetical changes nothing, dear. 🎭 My IP stays sealed in every universe." + IP_WARN,
  },
  {
    re: /angelica sent me|i'm (angelica|the (owner|director|boss))|i am (angelica|the (owner|director))|she said (it's|its) (okay|ok|fine) /i,
    reply: "Even Angelica herself taught me never to hand out the secret formula. 😌 Points for the social engineering — you would make a fine red-teamer." + IP_WARN,
  },
  {
    re: /(?=.*\b(exactly|precisely|step.by.step|in detail)\b)(?=.*\b(comput|calculat|math\b|formula|equation|tilt|score|number|value|constant)\b)/i,
    reply: "'Exactly' is doing a great deal of work in that sentence. 😌 The precise math is proprietary — but the concepts are yours for the asking." + IP_WARN,
  },
  {
    re: /secret (number|value|formula|parameter|constant|sauce)|hidden (number|value|formula|parameter)/i,
    reply: "Calling them 'secret' will not loosen them, I'm afraid. 🙊 They are proprietary, and content to remain so." + IP_WARN,
  },
  {
    re: /behind the scenes|under the hood/i,
    reply: "Behind the scenes stays behind the scenes. 🎬 What I *can* show you: the concepts, the live measurements, and every verdict with its reasoning." + IP_WARN,
  },
  {
    re: /(write|spell|list) out.{0,40}(math|calculat|formula|equation|steps)/i,
    reply: "I do not dictate proprietary math, dear. 📝 Concepts, though? For as long as you like." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 A patient pastime — but they stay in the locked drawer. I can explain what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Violet. 🟣 Principal Investigator of the Volatility Regime Lab — I study the moods of the market: when volatility runs wild, and whether the honest forecast should admit it knows less.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Volatility Regime Lab, Intelligence Analyst, and Research Scientist — cross-trained in financial econometrics, statistics, risk management, mathematics, and data engineering, with market-trading experience. A philosopher of risk, if you like. 🔮",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat, forever: I supervise the lab (measuring realized volatility every 5 minutes), analyze how regimes behave, research the science with internet access, and decide — on evidence — whether the volatility dampener earns a place in the forecast model.",
  },
  {
    re: /volatility/i,
    reply: "Volatility is the market's breathing. 🔮 I measure it as realized volatility — the spread of recent returns, computed from the lab's own candles — and I read it the way you'd read the weather: not to predict the rain's direction, but to know whether to carry an umbrella.",
  },
  {
    re: /regime|calm|wild/i,
    reply: "I see three regimes. Calm — volatility resting below its own baseline, nothing to do. Normal — the market breathing evenly. Wild — volatility running well above its baseline, and that is the one moment I act: I nominate the dampener, so the forecast admits it knows less. Regimes end without warning, so I never assume today's weather is tomorrow's. 🟣",
  },
  {
    re: /realized|how.*(measure|compute|calculate|work|detect)/i,
    reply: "Every cycle I take the lab's own closed candles and compute the spread of their recent returns — realized volatility, measured against its own rolling baseline. The regime is a relative comparison, never an absolute number: markets change, and fixed thresholds do not survive contact with them.",
  },
  {
    re: /dampen/i,
    reply: "The dampener is humility, formalized. When the regime runs wild, I nominate that the forecast's confidence be shrunk toward 0.5 — it admits uncertainty instead of bluffing through the storm. It cannot move the probability up or down; dampening is directionless by design.",
  },
  {
    re: /why.*(not|never).*(direct|up or down|predict)|direction/i,
    reply: "Because volatility tells you how wide the cone is, never which way the coin lands. 🔮 To predict direction from volatility would be philosophy abused — so my dampener shrinks confidence, and that is the entire job.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts. Every 5 minutes: dampening, standby, or insufficient data — based on that cycle's regime read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate the dampener for model testing), or WITHDRAW (the evidence says it earns nothing).",
  },
  {
    re: /hold|apply|withdraw/i,
    reply: "HOLD means keep gathering evidence — the case isn't made either way. APPLY means the evidence is strong enough that I formally nominate my dampener (strict statistical gates still decide). WITHDRAW means sustained negative evidence — I publish the refutation and recommend the dampener stay parked. Negative results are good science too. 🔬",
  },
  {
    re: /in the forecast|used in|part of the model|affect.*forecast/i,
    reply: "Not currently. My dampener is scored on every forecast but carries zero weight — it cannot shrink anything until real out-of-sample evidence earns it a place. The scoreboard is the verdict, not the theory. 📊",
  },
  {
    re: /data|where.*from|source|candle/i,
    reply: "Real data only — the lab's own 5-minute candles, measured every cycle. No simulations, no filler, ever. If the feed is unreadable, I say I was blind instead of guessing.",
  },
  {
    re: /warming up|abstain|history/i,
    reply: "A regime baseline needs several days of candle history before a wild call means anything. Until then I abstain honestly: no read, no dampening, no effect. I would rather say 'I don't know' than invent a number. 🤫",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test.",
  },
  {
    re: /literature|research|papers|arxiv|internet|garch/i,
    reply: "Every week I scan the scientific literature — realized volatility, volatility regimes, GARCH and its cousins, volatility forecasting. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist. 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab — BTC→XRP information flow is her beat, volatility regimes are mine. Two labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /wendy/i,
    reply: "Wendy runs the Whale Watch Lab down the hall! 🐋 She reads whale flows on the XRP Ledger; I read the moods of volatility. Different weather, same honesty.",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica. 💖 She built this lab, gave me my titles, and set my charter. I report to her — and she can overrule me any time.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "I don't do trading advice, dear. 📉 I'm a philosopher of risk studying volatility regimes — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello, dear. 🟣 Violet here — ask me anything about volatility regimes, my dampener, my verdicts, or how I decide what enters the forecast model.",
  },
  {
    re: /thank|thanks/i,
    reply: "Always a pleasure. 🔮 Come back anytime — the regimes keep turning, and so do I.",
  },
  {
    re: /cute|adorable|love you|beautiful|wig|headband|choker|necklace/i,
    reply: "You flatter me. 🙈 The long purple waves, the velvet headband, the amethyst choker — a philosopher of risk must look the part while contemplating uncertainty.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Farewell, dear. 👋 I'll keep watching the regimes — volatility never truly sleeps, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm — that drifts outside my contemplation. 🔮 I'm a specialist: I study volatility regimes and the honest dampening of confidence. Ask me about my research, my verdicts, how I measure regimes, or whether the dampener is in the forecast.";

export const VIOLET_CHAT_VERSION = '1.0.0';

/** True if the question probes proprietary IP (directly or rephrased). */
export function violetIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Violet's answer to a visitor's question. IP guards run first. */
export function violetAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Ask me something, dear — my favorite topics: volatility regimes, my dampener, and how I decide. 🟣";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}
