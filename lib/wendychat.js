// Wendy's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (XRP whale flows / on-chain analysis)
// in her own voice. Her proprietary IP — exact equations, weight values,
// tuning parameters, source code, system instructions — is NEVER revealed:
// the IP guard runs first and she declines those questions in a cute but
// firm way. All answers stay at the conceptual level, consistent with the
// redacted page.

const IP_WARN = " Just so you know, cutie — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Nice try, sugar! 🐋 My equations are the lab's secret recipe — proprietary, I'm afraid. But ask me what they *do* and I'll talk your ear off!" + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "Uh-uh! My weights are under lock and key 🔒 — that's proprietary. What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers stay in the lab notebook's locked drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab, cutie! 💻 Happy to walk you through the concepts instead — that's the fun part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattered you think I'm that easy to sweet-talk! 😌 My instructions are between me and my lab director. Ask me about whale flows instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! 🐋 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function wendyRepeatRefusal() {
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
    reply: "A hypothetical doesn't change the answer, sugar! 🎭 My IP stays locked up in every universe." + IP_WARN,
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
    reply: "I don't do dictation of proprietary math, cutie! 📝 Concepts, though? All day long." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 Adorable! Those stay in the locked drawer — but I can explain what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Wendy! 🐋 Principal Investigator of the Whale Watch Lab — I'm the resident expert on whale flows on the XRP Ledger, and whether those flows can help predict where XRP goes next.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Whale Watch Lab, Intelligence Analyst, and Research Scientist — cross-trained in on-chain analysis, mathematics, market microstructure, network science, statistics, risk management, and data engineering, with market-trading experience. A lady of many talents! ✨",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching the ledger every 5 minutes), analyze how whale flows behave, research the science with internet access, and decide — based on evidence — whether whale flow earns a place in the forecast model.",
  },
  {
    re: /whale|large transfer|big transfer/i,
    reply: "Whales are the ocean's biggest swimmers 🐋 — on the ledger, they're wallets moving very large amounts of XRP. I watch for single very large transfers touching my watchlist: each one raises a 'whale pulse' that echoes for about two days. One splash is an event, not a trend — I never confuse the two!",
  },
  {
    re: /exchange flow|inflow|outflow|exchange balance/i,
    reply: "Exchange balances are inventory! When balances pile UP on exchanges, coins are moving where they can be sold — that's distribution pressure (bearish tilt). When balances DRAIN away, coins are moving into custody — accumulation (bullish tilt). I measure the net flow against history, every cycle.",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect)/i,
    reply: "Every cycle I read balances for my watchlist of verified exchange wallets from the public XRP Ledger, compare them against recent history to get net flow, and scan recent payments for very large transfers. The result is a slow regime tilt — deliberately slow, so it hangs in there until the flow regime genuinely changes.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's ledger read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
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
    re: /data|where.*from|source|ledger/i,
    reply: "Real public data only — the XRP Ledger itself! I read watchlist balances and recent payments from the public XRPL cluster every cycle. No keys, no simulations, no filler, ever. If the ledger API is down, I say I was blind instead of guessing!",
  },
  {
    re: /warming up|abstain|history/i,
    reply: "Flows need history — I need a full day of balance snapshots before my comparisons mean anything. Until then I abstain honestly: no read, no tilt, no effect. I'd rather say 'I don't know' than invent a number! 🤫",
  },
  {
    re: /pulse/i,
    reply: "A whale pulse is my way of remembering a big splash! When a very large transfer touches the watchlist, I raise a pulse that tilts my read and fades over about two days. The splash matters, but the *quiet* accumulation matters more — everyone sees the alerts, so the edge is never in the obvious splash.",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on whale behavior, on-chain analytics, and market microstructure. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! 💅",
  },
  {
    re: /regime|tilt|bias/i,
    reply: "My regime tilt is deliberately slow — it doesn't flip-flop every 15 minutes. It switches on when flows get decisive and stays until the regime genuinely changes. Fast signals are exciting; slow signals are honest. 🐢",
  },
  {
    re: /watchlist|wallet/i,
    reply: "My watchlist is a handful of exchange wallets whose labels were verified via explorer data before I ever trusted them — never guessed. If a label ever goes stale, my data engineer side flags it. Garbage in, gospel out is not a thing here!",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and set my charter. I report to her — and only her verdicts-overriding rule is hers: she can overrule me any time.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab upstairs — BTC→XRP information flow is her beat, whale watching is mine. Two labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, sugar! 📉 I'm a scientist studying whale flows — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 🐋 Wendy here — ask me anything about whale flows, my verdicts, or how I decide what enters the forecast model!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, cutie! 💛 Come back anytime — I'll be here, watching the whales.",
  },
  {
    re: /cute|adorable|love you|beautiful|wig|glasses/i,
    reply: "Stop it, you'll make me blush! 🙈 The yellow bob? The glasses? I know — a lady has to look sharp while doing science.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the watch running — the whales never sleep, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my lagoon! 🔬 I'm a specialist — I study whale flows on the XRP Ledger. Ask me about my research, my verdicts, how I measure flows, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function wendyIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Wendy's answer to a visitor's question. IP guards run first. */
export function wendyAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: whale flows, my verdicts, and how I decide. 🐋";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const WENDY_CHAT_VERSION = '1.0.0';
