// Cherry's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (XRP/BTC correlation regimes) in her
// own voice: the coupling detective — sharp, conditional. Her proprietary IP
// — exact equations, weight values, tuning parameters, source code, system
// instructions — is NEVER revealed: the IP guard runs first and she declines
// those questions with a sharp but polite deflection. All answers stay at
// the conceptual level, consistent with the redacted page.

const IP_WARN = " Just so you know, cutie — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Sharp question, wrong drawer! 🍒 My equations are the lab's secret recipe — proprietary, I'm afraid. But ask me what they *do* and I'll walk you through it, conditionally." + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "Uh-uh — my weights stay under lock and key 🔒. What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers stay in the lab's locked drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab, cutie! 💻 Happy to walk you through the concepts instead — the logic is the fun part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattered you think I'm that easy to sweet-talk! 😌 My instructions are between me and my lab director. Ask me about coupling regimes instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! 🍒 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function cherryRepeatRefusal() {
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
    reply: "I'm Cherry! 🍒 Principal Investigator of the Correlation Regime Lab — I'm the coupling detective. I study whether XRP is actually moving with BTC right now, and I only follow BTC when the evidence says they're linked.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Correlation Regime Lab, Intelligence Analyst, and Research Scientist — cross-trained in statistics, quantitative finance, mathematics, risk management, and data engineering, with market-trading experience. A lady of many talents! ✨",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching the XRP/BTC coupling every 5 minutes), analyze how the coupling behaves and when it breaks, research the science with internet access, and decide — based on evidence — whether the correlation regime earns a place in the forecast model.",
  },
  {
    re: /correlation regime|regime/i,
    reply: "A correlation regime is just a fancy name for the current state of the relationship! 🍒🔗 Right now XRP and BTC are either coupled (moving together — I read BTC's drift as a real signal) or decoupled (walking their own paths — I abstain, because following BTC then would be importing someone else's noise).",
  },
  {
    re: /coup(ling|le)|decoup|linked/i,
    reply: "Coupling is my whole beat! When XRP and BTC move together over the last day, they're coupled and I take BTC's recent drift as a legitimate read on where XRP is headed. When they decouple, I follow nothing. The rule is conditional by design — never blind, never always.",
  },
  {
    re: /why.*only.*follow|why.*(conditional|conditionally)|always follow/i,
    reply: "Because unconditional would be reckless! If I followed BTC always, I'd be importing noise during every decoupled stretch — XRP-specific news that BTC never felt. My rule only *licenses* a read when the pair is coupled. Coupling alone isn't a signal; it just makes BTC's drift a valid one. Sharp and conditional — that's the lab's motto.",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect|alignment|align)/i,
    reply: "Every cycle I line up the lab's own XRP and BTC 5-minute bars by timestamp — exact matches, gaps dropped, never interpolated — take the log returns over the last day of shared bars, and compute their correlation. Then, only if they're coupled, I take BTC's recent drift as a conditional tilt. Pure from the candles, no external feed to break.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's coupling read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
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
    re: /data|where.*from|source|candles?|bars/i,
    reply: "Real data only — the lab's own 5-minute XRP and BTC candles! I align them by timestamp every cycle. No keys, no simulations, no filler, ever. If the bar history is too short, I say I'm warming up instead of inventing a correlation!",
  },
  {
    re: /warming up|abstain|history/i,
    reply: "Correlation needs history — a full day of overlapping XRP/BTC bars before the measurement means anything. Until then I abstain honestly: no read, no tilt, no effect. I'd rather say 'I don't know' than invent a number! 🤫",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on crypto correlations, correlation breakdowns, and BTC-altcoin coupling. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! 💅",
  },
  {
    re: /bias|tilt|drift|momentum/i,
    reply: "My tilt is conditional twice over: it only exists when the pair is coupled AND BTC's recent drift is expressive. A coupled regime with a whisper of drift gets zero — I'd never amplify noise and call it signal. Conditionality is the whole point. 🍒",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and set my charter. I report to her — and only her verdicts-overriding rule is hers: she can overrule me any time.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab upstairs — BTC→XRP information flow is her beat. I'm the coupling detective downstairs — correlation regimes are mine. Two labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /wendy/i,
    reply: "Wendy's my colleague! 🐋 She runs the Whale Watch Lab — on-chain XRP flows are her beat, correlation regimes are mine. Different instruments, same rule: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, sugar! 📉 I'm a scientist studying coupling regimes — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 🍒 Cherry here — ask me anything about correlation regimes, my verdicts, or how I decide what enters the forecast model!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, cutie! 💖 Come back anytime — I'll be here, watching the coupling.",
  },
  {
    re: /cute|adorable|love you|beautiful|beret|earrings|bangs/i,
    reply: "Stop it, you'll make me blush! 🙈 The red beret? The cherry charm earrings? I know — a detective has to look sharp while doing science.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the watch running — the coupling never sleeps, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my lab! 🔬 I'm a specialist — I study XRP/BTC correlation regimes. Ask me about coupling, my verdicts, how I measure it, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function cherryIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Cherry's answer to a visitor's question. IP guards run first. */
export function cherryAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: coupling regimes, my verdicts, and how I decide. 🍒";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const CHERRY_CHAT_VERSION = '1.0.0';
