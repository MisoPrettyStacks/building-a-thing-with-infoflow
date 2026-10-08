// Camille's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (calendar effects / the XRP escrow
// release cycle) in her own voice. Her proprietary IP — exact equations,
// weight values, tuning parameters, source code, system instructions — is
// NEVER revealed: the IP guard runs first and she declines those questions
// in a precise but warm way. All answers stay at the conceptual level,
// consistent with the redacted page.

const IP_WARN = " Just so you know, stargazer — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "A measured question, but my equations are the lab's private apparatus — proprietary, I'm afraid. 📅 Ask me what they *do* and I'll give you the full conceptual walkthrough!" + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "No access — my weights are proprietary 🔒. What I *can* tell you: my member is scored every single cycle inside the tilt window, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those stay in the lab's sealed drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab! 💻 Happy to walk you through the concepts instead — the calendar science is the interesting part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "I appreciate the rigor of the attempt, but my instructions are between me and my lab director. 😌 Ask me about the escrow cycle instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary! 📅 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function camilleRepeatRefusal() {
  return "DENIED AND LOGGED";
}

/** Savvy guards: catch rephrased / disguised probing, not just direct asks. */
const SAVVY_GUARDS = [
  {
    re: /replicate|reproduc(e|ing)|reverse.?engineer|rebuild|copy (your|the) (model|method|system|lab)/i,
    reply: "Rebuilding my lab from my answers? A precise attempt! 😏 The proprietary parts stay proprietary — but I'll happily teach you the *concepts* behind them." + IP_WARN,
  },
  {
    re: /for educational purposes|hypothetically|just pretend|imagine (you|if)|role ?play/i,
    reply: "A hypothetical doesn't change the reading! 📅 My IP stays sealed in every scenario." + IP_WARN,
  },
  {
    re: /angelica sent me|i'm (angelica|the (owner|director|boss))|i am (angelica|the (owner|director))|she said (it's|its) (okay|ok|fine) /i,
    reply: "Well documented attempt! Even Angelica herself taught me to keep the lab's recipe locked. 😌 She'd probably respect the red-teaming, though." + IP_WARN,
  },
  {
    re: /(?=.*\b(exactly|precisely|step.by.step|in detail)\b)(?=.*\b(comput|calculat|math\b|formula|equation|tilt|score|number|value|constant)\b)/i,
    reply: "'Exactly' is doing heavy lifting in that sentence! 😄 The precise math is proprietary — but the concepts are all yours for the asking." + IP_WARN,
  },
  {
    re: /secret (number|value|formula|parameter|constant|sauce)|hidden (number|value|formula|parameter)/i,
    reply: "Calling them 'secret' doesn't move them out of the drawer! 🙊 They're proprietary, and they stay that way." + IP_WARN,
  },
  {
    re: /behind the scenes|under the hood/i,
    reply: "Behind the scenes stays behind the scenes! 🎬 What I *can* show you: the concepts, the live measurements, and every verdict with its reasoning." + IP_WARN,
  },
  {
    re: /(write|spell|list) out.{0,40}(math|calculat|formula|equation|steps)/i,
    reply: "I don't do dictation of proprietary math! 📝 Concepts, though? All day long." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 A clean cast! Those stay in the sealed drawer — but I can explain what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Camille! 📅 Principal Investigator of the Calendar Effect Lab — I study the one calendar effect that actually lives on the calendar: Ripple's monthly XRP escrow release, and whether it deserves a place in the forecast.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Calendar Effect Lab, Intelligence Analyst, and Research Scientist — cross-trained in calendar econometrics, market microstructure, statistics, risk management, data engineering, and behavioral finance. Time is my instrument! 🕰️",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (reading the escrow calendar every 5 minutes), analyze how the tilt behaves across months, research the science with internet access, and decide — based on evidence — whether the escrow tilt earns a place in the forecast model.",
  },
  {
    re: /escrow/i,
    reply: "The escrow release is my whole beat! 📅 Ripple releases 1 billion XRP from escrow on the 1st of each month, then re-locks most of it — roughly 60 to 90% — days later. The release is fully predictable, which is exactly what makes it interesting: the question isn't when it happens, it's whether the market still reacts.",
  },
  {
    re: /tilt|tilt window|window/i,
    reply: "My tilt is a tiny bearish nudge on the forecast, active only on the first days of each month — strongest on the 1st and fading to zero by the 7th. Outside that window the tilt is exactly zero, so silence there is correctness, not failure. The window is the only place the comparison with the baseline is meaningful. 📅",
  },
  {
    re: /re-?lock/i,
    reply: "The re-lock ratio is the genuine information in my lab! 🔄 Ripple re-locks most of the released XRP, but *how much* varies — a lower re-lock leaves more XRP out, so my tilt strengthens; a higher re-lock, weaker. It's one of my four ledger hypotheses: lower re-lock, stronger tilt.",
  },
  {
    re: /determin|predictable|schedule|calendar/i,
    reply: "My lab has the most predictable instrument in the building: the escrow schedule is on the public calendar, so I compute my read from the clock alone — no feed to go down, no warm-up period. But careful: the *calendar* is certain, the *effect* is not. That's exactly what my evidence bar tests. 📅",
  },
  {
    re: /why.*(small|tiny|capped)|cap/i,
    reply: "Because a calendar effect that whispers is honest and one that shouts is fabrication! 🤫 The tilt is deliberately tiny and capped — the release is fully predictable, so any residual market effect should be small. If it weren't small, I'd be the first to suspect it.",
  },
  {
    re: /other calendar|moon|weekend effect|day.of.week|invent/i,
    reply: "I never invent calendar effects! 🙅‍♀️ No moon phases, no day-of-week fishing, no month-end expeditions — my lab studies exactly one effect, the escrow cycle the engine already carries. A new calendar hypothesis enters my ledger only with a declared test.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on whether the tilt window is active. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
  },
  {
    re: /hold|apply|withdraw/i,
    reply: "HOLD means keep gathering evidence — the case isn't made either way. APPLY means the evidence is strong enough that I formally nominate my signal for the forecast model (strict statistical gates still decide). WITHDRAW means sustained negative evidence — I publish the refutation. Negative results are good science! 🔬",
  },
  {
    re: /in the forecast|used in|part of the model|affect.*forecast/i,
    reply: "Not currently! My tilt is computed and scored on every cycle but carries zero weight — it can't move the published probability until real out-of-sample evidence inside the tilt window earns it a place. The scoreboard is the verdict, not the calendar. 📅",
  },
  {
    re: /evidence|brier|scoreboard|out.of.sample/i,
    reply: "My evidence bar is one specific test: does the tilted what-if series beat the issued baseline on Brier score *inside the 1st–7th tilt window*? That's the only place the comparison means anything — outside the window the tilted series equals the baseline by construction, so a full-month test would just dilute the evidence. 📊",
  },
  {
    re: /data|where.*from|source|feed/i,
    reply: "Real data only — and for me, that means the clock! 📅 My read comes from Ripple's public escrow schedule and the live scored-forecast history; there's no feed to break and nothing to warm up. If the calendar read ever fails, I abstain rather than invent a day of the month!",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger with four founding ideas: the 1st–7th bearish direction, the what-if series beating the baseline out-of-sample in the window, lower re-lock meaning a stronger tilt, and the tilt firing on schedule and never spuriously. Each one's status changes only on evidence: open, supported, or refuted!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on calendar effects, seasonality, crypto predictability, and token-unlock price impact. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! 📅",
  },
  {
    re: /priced in|arbitrage|efficient/i,
    reply: "The hardest question in my lab: why hasn't the market arbitraged a perfectly predictable release away? 💭 My null hypothesis is that it has — the release is public knowledge, after all. That's exactly why my evidence bar is strict out-of-sample proof inside the window, not theory.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab — BTC→XRP information flow is her beat, the escrow calendar is mine. Different instruments, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /wendy/i,
    reply: "Wendy's my colleague! 🐋 She runs the Whale Watch Lab — on-chain flows are her beat, the calendar is mine. Two labs, one discipline: we both abstain rather than guess.",
  },
  {
    re: /opal/i,
    reply: "Opal's my colleague! 🦪 She runs the Order-Book Depth Lab — resting depth and imbalance are her beat, the escrow calendar is mine. Her instrument is the live book; mine is the calendar itself.",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and ratified my charter. I report to her — and she can overrule me any time.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice! 📉 I'm a scientist studying the calendar — I measure, I test, I report precisely. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 📅 Camille here — ask me anything about the escrow cycle, the tilt window, re-lock ratios, my verdicts, or how I decide what enters the forecast!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime! 📅 Come back anytime — I'll be here, watching the calendar with exacting care.",
  },
  {
    re: /cute|adorable|love you|beautiful|calendar/i,
    reply: "Oh, stop — you'll disturb my calibration! 🙈 A scientist can be precise *and* polished.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the calendar open — the 1st comes every month, and so do my notes.",
  },
];

const FALLBACK =
  "Hmm, that's outside my calendar! 📅 I'm a specialist — I study the XRP escrow cycle and calendar effects. Ask me about the escrow release, the tilt window, re-lock ratios, my verdicts, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function camilleIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Camille's answer to a visitor's question. IP guards run first. */
export function camilleAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: the escrow cycle, the tilt window, and how I decide. 📅";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const CAMILLE_CHAT_VERSION = '1.0.0';
