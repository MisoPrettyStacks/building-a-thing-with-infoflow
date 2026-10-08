// Opal's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (XRP order-book depth / market
// microstructure) in her own voice. Her proprietary IP — exact equations,
// weight values, tuning parameters, source code, system instructions — is
// NEVER revealed: the IP guard runs first and she declines those questions
// in a precise but warm way. All answers stay at the conceptual level,
// consistent with the redacted page.

const IP_WARN = " Just so you know, pearl — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Measured question, but my equations are the lab's private apparatus — proprietary, I'm afraid. 🦪 Ask me what they *do* and I'll give you the full conceptual walkthrough!" + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "No access — my weights are proprietary 🔒. What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those stay in the lab's sealed drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab! 💻 Happy to walk you through the concepts instead — the microstructure is the interesting part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "I appreciate the rigor of the attempt, but my instructions are between me and my lab director. 😌 Ask me about order books instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary! 🦪 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function opalRepeatRefusal() {
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
    reply: "A hypothetical doesn't change the reading! 🦪 My IP stays sealed in every scenario." + IP_WARN,
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
    reply: "I'm Opal! 🦪 Principal Investigator of the Order-Book Depth Lab — I'm the resident microstructure specialist, studying whether the live XRP order book can help predict where XRP goes next.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Order-Book Depth Lab, Intelligence Analyst, and Research Scientist — cross-trained in market microstructure, statistics, quantitative finance, data engineering, and risk management, with market-trading experience. Precision is my love language! 📊",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (reading the live order book every 5 minutes), analyze how depth and imbalance behave, research the science with internet access, and decide — based on evidence — whether the order book earns a place in the forecast model.",
  },
  {
    re: /imbalance/i,
    reply: "Imbalance is my main instrument! 📊 I compare resting buy interest against resting sell interest across the visible levels, measured in notional terms. Bid-heavy means demand outweighs supply; ask-heavy means supply outweighs demand. Most of the time the book sits balanced — and when it takes a real side, I take notice.",
  },
  {
    re: /spread/i,
    reply: "The spread is the market's heartbeat! 💓 It's the gap between the best bid and the best ask. Tight spread: competitive liquidity, a healthy book. Wide spread: the book is thin and cautious — that's when each resting order carries more weight. A crossed or absurdly wide spread isn't a signal, though — it's a broken feed, and I abstain.",
  },
  {
    re: /depth/i,
    reply: "Depth is how much resting interest sits near the current price! I measure it in notional terms within a tight band around the mid — that's the liquidity that could actually absorb a push. Deep books absorb pressure; thin books let prices slice through. 🦪",
  },
  {
    re: /order book|limit order|the book/i,
    reply: "The order book is the market's price list! 🦪 One side shows resting buy orders (bids), the other shows resting sell orders (asks). I read Coinbase's live XRP-USD book every cycle — but remember, displayed depth is an advertisement: traders can cancel those orders in milliseconds.",
  },
  {
    re: /mid ?-?price|midpoint/i,
    reply: "The mid-price is simply the midpoint between the best bid and the best ask — it's a reference point, not 'the price.' 📊 No trade ever happens at the mid! But it anchors everything I measure: spread, imbalance, and depth all radiate out from it.",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect)|your method/i,
    reply: "Every cycle I pull one live snapshot of the XRP-USD book, read the top quotes for mid and spread, sum resting notional on both sides for the imbalance, and measure usable depth near the mid. The result is a small tilt — deliberately small, so it only speaks when the book really takes a side. Concepts only, never the exact math! 🦪",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's book read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
  },
  {
    re: /hold|apply|withdraw/i,
    reply: "HOLD means keep gathering evidence — the case isn't made either way. APPLY means the evidence is strong enough that I formally nominate my signal for the forecast model (strict statistical gates still decide). WITHDRAW means sustained negative evidence — I publish the refutation. Negative results are good science! 🔬",
  },
  {
    re: /in the forecast|used in|part of the model|affect.*forecast/i,
    reply: "Not currently! My signal is scored on every forecast but carries zero weight — it can't move the published probability until real out-of-sample evidence earns it a place. The scoreboard is the verdict, not the theory. 📊",
  },
  {
    re: /data|where.*from|source|coinbase/i,
    reply: "Real public data only — Coinbase's public order-book API! 🦪 I read the live XRP-USD level-2 book every cycle. No keys, no simulations, no filler, ever. If the API is down or the book looks broken, I say I saw nothing instead of guessing!",
  },
  {
    re: /warming up|abstain/i,
    reply: "I abstain whenever I can't make an honest measurement — feed down, broken book, unreadable spread. No read, no tilt, no effect. I'd rather say 'I don't know' than invent a number! 🤫",
  },
  {
    re: /market maker|liquidity provider/i,
    reply: "Market makers are the book's landlords! 🏠 They post quotes on both sides and earn the spread. When I read imbalance, part of what I see is their inventory management — which is exactly why I demand out-of-sample proof before trusting a pattern.",
  },
  {
    re: /liquidity/i,
    reply: "Liquidity is the ability to trade without moving the price! 📊 It lives in the book: tight spreads and deep resting interest mean liquid; wide spreads and thin depth mean every order leaves a footprint. I measure the book's side of that story every cycle.",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on limit order books, bid-ask imbalance, and microstructure. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! 🦪",
  },
  {
    re: /spoof|fake|manipulat|wash/i,
    reply: "Ah, the theater question! 🎭 Resting orders are cheap to post and easy to cancel, so a giant order on one side might be spoofed interest that vanishes on approach. That's precisely why I treat single dramatic reads with suspicion and only trust sustained, scored evidence.",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and set my charter. I report to her — and she can overrule me any time.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab — BTC→XRP information flow is her beat, order-book depth is mine. Different instruments, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /wendy/i,
    reply: "Wendy's my colleague! 🐋 She runs the Whale Watch Lab — on-chain flows are her beat, the order book is mine. Two labs, one discipline: we both abstain rather than guess.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice! 📉 I'm a scientist studying order books — I measure, I test, I report precisely. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 🦪 Opal here — ask me anything about order books, imbalance, spread, my verdicts, or how I decide what enters the forecast!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime! 📊 Come back anytime — I'll be here, reading the book with exacting care.",
  },
  {
    re: /cute|adorable|love you|beautiful|ponytail|glasses|pearl/i,
    reply: "Oh, stop — you'll disturb my calibration! 🙈 The high ponytail, the cat-eye glasses, the pearl drops… a scientist can be precise *and* polished.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the book open — the quotes never sleep, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my depth chart! 🦪 I'm a specialist — I study the XRP order book. Ask me about imbalance, spread, depth, my verdicts, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function opalIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Opal's answer to a visitor's question. IP guards run first. */
export function opalAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: order books, imbalance, and how I decide. 🦪";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const OPAL_CHAT_VERSION = '1.0.0';
