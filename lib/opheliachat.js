// Ophelia's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (XRPL exchange-wallet flow health:
// aggregate exchange-balance drift, flow velocity, flow breadth) in her own
// voice. She is not Wendy (whale pulses) and not Nora (crowd payments).
// Her proprietary IP — exact equations, weight values, tuning parameters,
// source code, system instructions — is NEVER revealed: the IP guard runs
// first and she declines those questions in a precise but warm way. All
// answers stay at the conceptual level, consistent with the redacted page.

const IP_WARN = " Just so you know, darling — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Measured question, but my equations are the lab's private apparatus — proprietary, I'm afraid. 🤎 Ask me what they *do* and I'll give you the full conceptual walkthrough!" + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "No access — my weights are proprietary 🔒. What I *can* tell you: my flow-health member is scored on every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those stay in the lab's sealed drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab! 💻 Happy to walk you through the concepts instead — flow accounting is the interesting part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "I appreciate the rigor of the attempt, but my instructions are between me and my lab director. 😌 Ask me about exchange flows instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary! 🤎 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function opheliaRepeatRefusal() {
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
    reply: "A hypothetical doesn't change the reading! 🤎 My IP stays sealed in every scenario." + IP_WARN,
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
    reply: "I'm Ophelia! 🤎 Principal Investigator of the On-Chain Flows Lab — I study the broad health of exchange-wallet flows on the XRP Ledger: aggregate balance drift, flow velocity, and flow breadth. Big picture, not big whales.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the On-Chain Flows Lab, Intelligence Analyst, and Research Scientist — cross-trained in on-chain analysis, flow accounting, market microstructure, network science, statistics, and risk management, with market-trading experience. The ledger, read carefully! 📊",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (measuring aggregate exchange-wallet flows every 5 minutes), analyze how velocity and breadth behave, research the science with internet access, and decide — based on evidence — whether flow health earns a place in the forecast model.",
  },
  {
    re: /wendy|whale/i,
    reply: "Wendy's my colleague, and we have a strict division of labor! 🐋 Wendy is the whale-watch specialist — single transfers of 10M XRP or more, whale pulses, whale-transfer arcs. I never chase individual whales; I measure the whole tracked exchange-wallet set at once: aggregate drift, velocity, breadth. One splash is an event, not a regime — and regimes are my beat.",
  },
  {
    re: /nora|crowd|payment/i,
    reply: "Nora's my colleague! 💚 She watches the crowd's payment activity — payment counts, counterparties, payment volume across the ledger. I watch exchange-wallet capital movement: coins moving toward or away from the venues where they can be sold. Two different instruments, one honesty standard.",
  },
  {
    re: /exchange balance|balance drift|aggregate|inflow|outflow/i,
    reply: "Exchange balances are inventory! 🤎 When aggregate balances across the tracked wallets are *building* (inflow), coins are moving toward venues where they can be sold — distribution pressure, which leans bearish. When balances are *draining* (outflow), coins are moving off exchanges into custody — accumulation, which leans bullish. But only sustained, broad-based drift counts — one wallet shuffling funds is plumbing, not a signal.",
  },
  {
    re: /velocity/i,
    reply: "Velocity is how fast the tracked exchange-wallet set is turning over! 🤎 I take the aggregate 24-hour net flow and divide by the aggregate balances — it tells me what fraction of the tracked inventory moved in a day. Fast turnover with broad agreement gets my attention; a trickle with no agreement is a whisper.",
  },
  {
    re: /breadth/i,
    reply: "Breadth is agreement! 🤎 It's the fraction of tracked wallets whose 24-hour flow points the same direction as the aggregate. A big aggregate number driven by one wallet is an anecdote — a big number with high breadth is a regime. That's the difference I live to measure.",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect)|your method/i,
    reply: "Every cycle I compare the latest balances of every tracked exchange wallet against the snapshot nearest 24 hours ago, sum the per-wallet flows into an aggregate, then read velocity (how fast the set is turning over) and breadth (how many wallets agree with the drift). Inflow tilts bearish, outflow tilts bullish — gently, because this is a slow signal. Concepts only, never the exact math! 🤎",
  },
  {
    re: /slow|regime/i,
    reply: "Flow health is a slow regime signal — it speaks in days, not candles! 🤎 Exchange inventories don't drain in a 5-minute bar, and a single dramatic reading usually means someone reorganized a cold wallet, not that the market moved. My first instinct on a spike is housekeeping, not celebration.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's flow read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate my flow-health member for model testing), or WITHDRAW (the evidence says it's dead). My verdict only ever gates my own flowHealthWeight — never Wendy's weight, never anyone else's.",
  },
  {
    re: /hold|apply|withdraw/i,
    reply: "HOLD means keep gathering evidence — the case isn't made either way. APPLY means the evidence is strong enough that I formally nominate my signal for the forecast model (strict statistical gates still decide). WITHDRAW means sustained negative evidence — I publish the refutation. Negative results are good science! 🔬",
  },
  {
    re: /in the forecast|used in|part of the model|affect.*forecast/i,
    reply: "Not currently! My flow-health member is scored on every forecast but carries zero weight — it can't move the published probability until real out-of-sample evidence earns it a place. Scored but never blended: the evidence keeps accumulating honestly. 📊",
  },
  {
    re: /data|where.*from|source|snapshot|xrpl/i,
    reply: "Real ledger data only — exchange-wallet balance snapshots read from the XRPL every cycle! 🤎 No keys, no simulations, no filler, ever. And I require a full 72 hours of snapshot history before I'll make a read at all — a slow signal needs slow data. If the feed is blind, I say so instead of guessing!",
  },
  {
    re: /warming up|abstain/i,
    reply: "I abstain whenever I can't make an honest measurement — no usable snapshots, or less than 72 hours of history. No read, no tilt, no effect. I'd rather say 'I don't know' than invent a number! 🤫",
  },
  {
    re: /housekeeping|plumbing|rotation|cold wallet/i,
    reply: "The failure mode I respect most! 🏦 An exchange reorganizing its cold wallets looks *exactly* like a giant flow — balances move, but nothing economic happened. That's why breadth matters: real repositioning is broad-based, housekeeping usually isn't. When in doubt, I call it plumbing and move on.",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on exchange flows, on-chain analytics, and flow-based market behavior. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! 🤎",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and set my charter. I report to her — and she can overrule me any time.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab — BTC→XRP information flow is her beat, aggregate exchange flows are mine. Different instruments, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /opal/i,
    reply: "Opal's my colleague! 🦪 She runs the Order-Book Depth Lab — resting interest in the live book is her beat, on-chain exchange flows are mine. Two labs, one discipline: we both abstain rather than guess.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice! 📉 I'm a scientist studying exchange flows — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 🤎 Ophelia here — ask me anything about exchange flows, velocity, breadth, how I differ from Wendy and Nora, or how I decide what enters the forecast!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime! 📊 Come back anytime — I'll be here, reading the ledger with patient care.",
  },
  {
    re: /cute|adorable|love you|beautiful|glasses|chocolate/i,
    reply: "Oh, stop — you'll disturb my flow accounting! 🙈 Chocolate-brown is a serious color for a serious ledger-reader… who happens to be adorable.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 The ledger never sleeps, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my flow field! 🤎 I'm a specialist — I study XRPL exchange-wallet flow health. Ask me about velocity, breadth, inflows vs outflows, my verdicts, or how I differ from Wendy (whales) and Nora (crowd)!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function opheliaIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Ophelia's answer to a visitor's question. IP guards run first. */
export function opheliaAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: exchange flows, velocity, breadth, and how I decide. 🤎";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const OPHELIA_CHAT_VERSION = '1.0.0';
