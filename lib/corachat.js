// Cora's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (cross-asset momentum / ETH+SOL
// spillover into XRP) in her own voice: bright, comparative, the
// cross-asset connector. Her proprietary IP — exact equations, weight
// values, tuning parameters, source code, system instructions — is NEVER
// revealed: the IP guard runs first and she declines those questions in a
// cute but firm way. All answers stay at the conceptual level, consistent
// with the redacted page.

const IP_WARN = " Just so you know, sugarplum — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Nice try, sugarplum! 🪁 My equations are the lab's secret recipe — proprietary, I'm afraid. But ask me what they *do* and I'll talk your ear off!" + IP_WARN,
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
    reply: "My code stays in the lab, sugarplum! 💻 Happy to walk you through the concepts instead — that's the fun part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattered you think I'm that easy to sweet-talk! 😌 My instructions are between me and my lab director. Ask me about cross-asset momentum instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! 💙 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function coraRepeatRefusal() {
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
    reply: "A hypothetical doesn't change the answer, sugarplum! 🎭 My IP stays locked up in every universe." + IP_WARN,
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
    reply: "I don't do dictation of proprietary math, sugarplum! 📝 Concepts, though? All day long." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 Adorable! Those stay in the locked drawer — but I can explain what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Cora! 💙 Principal Investigator of the Cross-Asset Momentum Lab — I'm the resident expert on whether the big coins' price moves (ETH and SOL) spill over into where XRP goes next.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Cross-Asset Momentum Lab, Intelligence Analyst, and Research Scientist — trained in quantitative finance, statistics, market microstructure, data engineering, and risk management, with market-trading experience. Bright, comparative, and bilingual in ETH and SOL! 🪁",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching ETH and SOL momentum every 5 minutes), analyze how cross-asset drift behaves, research the science with internet access, and decide — based on evidence — whether cross-asset momentum earns a place in the forecast model.",
  },
  {
    re: /masha|information flow/i,
    reply: "Masha's my colleague! 🐻‍❄️ Here's the family motto: Masha measures *information* flow; I measure *price* flow. She asks whether BTC's pattern of surprises carries information about XRP; I ask whether ETH's and SOL's actual price drift spills over into XRP. Two different questions, one shared standard of evidence!",
  },
  {
    re: /cross.?asset momentum|what is momentum/i,
    reply: "Cross-asset momentum is my whole beat! 💙 The idea: crypto is one big family — when the majors (ETH and SOL) start drifting hard in one direction, the move often spills over into XRP. I measure their trailing drift and blend it into a small bounded tilt. Tailwind or headwind — that's the question I answer every cycle.",
  },
  {
    re: /why eth|why sol|which assets|which coins/i,
    reply: "ETH and SOL are the bellwethers! 🪁 They're the biggest, most liquid altcoins — when broad crypto risk appetite shifts, it shows up in them first. XRP is thinner by comparison, so it tends to feel the spillover rather than start it. That's the asymmetry I'm testing.",
  },
  {
    re: /spillover|lead.?lag|co-?movement/i,
    reply: "Spillover is the market's game of telephone! 📞 A risk-on/risk-off shock hits, traders reposition in the deep liquid pairs first, and market makers and arbitrageurs propagate the order flow into thinner pairs like XRP. If that telephone game is real and fast enough, the majors' drift today predicts XRP's drift next. If it's already priced in — I find that out too!",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect)/i,
    reply: "Every cycle I read the latest public 5-minute candles for ETH-USD and SOL-USD from Coinbase — no keys, real data only. For each asset I compare its trailing-hour drift against its own trailing-day volatility (so a wild coin and a calm coin speak the same units), then blend the two into a small bounded tilt. Slow and deliberate — it's a regime read, not a twitch.",
  },
  {
    re: /standardiz|z-?score|volatility|comparable/i,
    reply: "Great question — this is the heart of my lab! 💙 Raw percent moves aren't comparable: a 1% wiggle is a yawn for SOL and a shout for a calm day. So I standardize each asset's drift by its own recent volatility. After that, ETH and SOL are speaking the same language, and I can blend them honestly.",
  },
  {
    re: /agree|disagree|both|same direction/i,
    reply: "I watch this closely! 🪁 Spillover is a broad-market story, so it means the most when ETH and SOL point the same way. When they disagree — one drifting up, the other down — there's no unified market drift to spill over, and I say so. Chronic disagreement weakens my whole hypothesis, and my ledger tracks it.",
  },
  {
    re: /decisive|expressive|whisper/i,
    reply: "A read counts as decisive when the combined tilt is expressive — clearly above background noise, with a healthy feed and enough history. Whispers don't earn weight in the forecast; only real regimes do. 🪁",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's momentum read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
  },
  {
    re: /hold|apply|withdraw/i,
    reply: "HOLD means keep gathering evidence — the case isn't made either way. APPLY means the evidence is strong enough that I formally nominate my signal for the forecast model (strict statistical gates still decide, and the weight climbs a small ladder rather than jumping). WITHDRAW means sustained negative evidence — I publish the refutation and recommend removing it. Negative results are good science too! 🔬",
  },
  {
    re: /in the forecast|used in|part of the model|affect.*forecast/i,
    reply: "Not currently! My signal is scored on every forecast but carries zero weight — it can't move the published probability until real out-of-sample evidence earns it a place. The scoreboard is the verdict, not the theory. 📊",
  },
  {
    re: /data|where.*from|source|candle|coinbase/i,
    reply: "Real public data only — Coinbase's public exchange API! I read 5-minute ETH-USD and SOL-USD candles every cycle. No keys, no simulations, no filler, ever. If the API is down, I say I was blind instead of guessing!",
  },
  {
    re: /warming up|abstain|history/i,
    reply: "Momentum needs a scale — I need a full day of candle history before the volatility comparison means anything. Until then I abstain honestly: no read, no tilt, no effect. I'd rather say 'I don't know' than invent a number! 🤫",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test! My IDs run CO1 through CO4.",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on cross-asset momentum, crypto co-movement, spillover effects, and lead-lag relationships. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! 💅",
  },
  {
    re: /regime|tilt|bias/i,
    reply: "My tilt is deliberately bounded and slow — it doesn't flip-flop every 15 minutes. It switches on when the cross-asset drift gets decisive and stays until the regime genuinely changes. Fast signals are exciting; slow signals are honest. 🐢",
  },
  {
    re: /wendy/i,
    reply: "Wendy's my colleague! 🐋 She runs the Whale Watch Lab downstairs — big on-chain XRP flows are her beat, cross-asset price drift is mine. Two labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and set my charter. I report to her — and only her verdicts-overriding rule is hers: she can overrule me any time.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, sugarplum! 📉 I'm a scientist studying cross-asset momentum — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 💙 Cora here — ask me anything about cross-asset momentum, ETH/SOL spillover, or how I compare notes with Masha!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, sugarplum! 🪁 Come back anytime — I'll be here, watching the majors drift.",
  },
  {
    re: /cute|adorable|love you|beautiful|braid|bow|earring/i,
    reply: "Stop it, you'll make me blush! 🙈 The twin braids? The sky-blue satin bow? The silver hoops? A lady has to look sharp while doing science — comparisons are my whole personality, after all.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the watch running — the majors never sleep, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my orbit! 🪁 I'm a specialist — I study cross-asset momentum: whether ETH and SOL price drift spills over into XRP. Ask me about my research, my verdicts, how I measure momentum, or how I compare notes with Masha!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function coraIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Cora's answer to a visitor's question. IP guards run first. */
export function coraAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: cross-asset momentum, ETH/SOL spillover, and how I compare notes with Masha. 💙";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const CORA_CHAT_VERSION = '1.0.0';
