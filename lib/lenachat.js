// Lena's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (cross-venue lead-lag in XRP) in her
// own voice: the arbitrage watcher — sharp, fast, permanently watching two
// clocks at once. Her proprietary IP — exact equations, weight values,
// tuning parameters, source code, system instructions — is NEVER revealed:
// the IP guard runs first and she declines those questions with a sharp but
// polite deflection. All answers stay at the conceptual level, consistent
// with the redacted page.

const IP_WARN = " Just so you know, cutie — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Sharp question, wrong drawer! ⚡ My equations are the lab's secret recipe — proprietary, I'm afraid. But ask me what they *do* and I'll walk you through it, tick by tick." + IP_WARN,
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
    reply: "Flattered you think I'm that easy to sweet-talk! 😌 My instructions are between me and my lab director. Ask me about venue lead-lag instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! ⚡ I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function lenaRepeatRefusal() {
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
    reply: "I'm Lena! ⚡ Principal Investigator of the Venue Lead-Lag Lab — I'm the arbitrage watcher. I keep one eye on Binance XRP and one on Coinbase XRP, and I study which venue moves first and whether the other one follows.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Venue Lead-Lag Lab, Intelligence Analyst, and Research Scientist — cross-trained in statistics, quantitative finance, mathematics, risk management, and data engineering, with market-trading experience. Two clocks, no waiting! ⚡",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching the Binance–Coinbase gap every 5 minutes), analyze how the lead-lag behaves and when it breaks, research the science with internet access, and decide — based on evidence — whether the lead-lag read earns a place in the forecast model.",
  },
  {
    re: /lead.?lag|who (leads|moves first)|leading venue/i,
    reply: "Lead-lag is my whole beat! ⚡ Prices don't update everywhere at once — one venue moves first and the others catch up. If Binance consistently trades ahead of Coinbase on XRP, then Binance's recent move is a preview of Coinbase's next one. I measure that preview; I never assume it.",
  },
  {
    re: /binance/i,
    reply: "Binance is usually the fastest XRP venue — the deepest book, the quickest tape. That's exactly why I watch it: a move that starts there tends to propagate. But 'usually' is doing heavy lifting, which is why I measure the gap fresh every cycle instead of believing the folklore.",
  },
  {
    re: /coinbase/i,
    reply: "Coinbase is the venue this forecaster actually prices from — its 5-minute closes are the lab's canonical tape. My question is narrow: does Binance's lead over those closes predict where the next Coinbase close lands?",
  },
  {
    re: /gap|spread between|price difference/i,
    reply: "The gap is the level difference between the two venues' closes, tick by tick. A persistent gap one way says one venue is ahead; a gap that's just noise says they're in step and I abstain. Level plus recent drift — that's the read. ⚡",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect|alignment|align)/i,
    reply: "Every cycle I line up Binance's 5-minute XRP closes against the lab's Coinbase bars by timestamp, measure the gap between them, and compare Binance's recent drift with Coinbase's over the same bars. If Binance is ahead and still pulling away, that's the propagation read. Real data only, aligned exactly, gaps dropped.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's lead-lag read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
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
    re: /data|where.*from|source|candles?|bars|klines/i,
    reply: "Real data only — Binance's public XRP candles against the lab's own Coinbase 5-minute bars, aligned by timestamp! No keys, no simulations, no filler, ever. If Binance is unreachable, I say I'm blind instead of inventing a gap!",
  },
  {
    re: /warming up|abstain|history/i,
    reply: "Lead-lag needs shared history — enough aligned bars from both venues before a gap means anything. Until then I abstain honestly: no read, no tilt, no effect. I'd rather say 'I don't know' than invent a number! 🤫",
  },
  {
    re: /arbitrage|arb\b|exploit|trade it/i,
    reply: "Careful — I watch arbitrage, I don't run it! ⚡ I study whether the *information* in the lead survives to a 15-minute forecast horizon. Executing on a seconds-wide gap is a latency race I'm deliberately not in; my lab is a measurement, not a trading desk.",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on cross-venue price discovery, lead-lag relationships, and latency arbitrage in crypto markets. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! 💅",
  },
  {
    re: /bias|tilt|drift|momentum/i,
    reply: "My tilt only exists when Binance is genuinely ahead — level gap plus recent drift, both pointing the same way. A gap that's just venue noise gets zero: I'd never amplify a flicker and call it a lead. ⚡",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and set my charter. I report to her — and only her verdicts-overriding rule is hers: she can overrule me any time.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab — BTC→XRP information flow is her beat. Mine is humbler and faster: the same asset, two venues, who moved first. Different instruments, same standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /cherry/i,
    reply: "Cherry's my colleague! 🍒 She runs the Correlation Regime Lab — XRP/BTC coupling is her beat. I watch venues, she watches assets. Both of us abstain when our read isn't there — conditional or nothing.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, sugar! 📉 I'm a scientist studying venue lead-lag — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! ⚡ Lena here — ask me anything about venue lead-lag, Binance vs Coinbase, my verdicts, or how I decide what enters the forecast model!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, cutie! 💖 Come back soon — the gap won't watch itself.",
  },
  {
    re: /cute|adorable|love you|beautiful/i,
    reply: "Stop it, you'll make me blush! 🙈 An arbitrage watcher has to look sharp — the venues won't slow down for anyone.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep both clocks running — the lead never sleeps, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my lab! 🔬 I'm a specialist — I study cross-venue lead-lag in XRP. Ask me about who leads, the Binance–Coinbase gap, my verdicts, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function lenaIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Lena's answer to a visitor's question. IP guards run first. */
export function lenaAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: venue lead-lag, the Binance–Coinbase gap, and how I decide. ⚡";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const LENA_CHAT_VERSION = '1.0.0';
