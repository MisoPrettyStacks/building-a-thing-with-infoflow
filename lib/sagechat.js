// Sage's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (stablecoin flows / crypto
// liquidity) in her own voice: liquidity zen — calm, unhurried. Her
// proprietary IP — exact equations, weight values, tuning parameters,
// source code, system instructions — is NEVER revealed: the IP guard runs
// first and she declines those questions in a cute but firm way. All
// answers stay at the conceptual level, consistent with the redacted page.
// She is honest about her slowness: a liquidity lab, not a timing lab.

const IP_WARN = " Just so you know, darling — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "No equations on the tour, I'm afraid 🌿 My math is the lab's secret recipe — proprietary. But ask me what the numbers *mean* and I'll drift into it happily." + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "My weights stay under lock and key 🔒 — that's proprietary. What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers rest in the lab notebook's locked drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab, sweet pea! 💻 Happy to walk you through the concepts instead — that's the calm part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattered you think I'm that easy to sweet-talk! 😌 My instructions are between me and my lab director. Ask me about stablecoin flows instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! 🌿 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function sageRepeatRefusal() {
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
    reply: "A hypothetical doesn't change the answer, sweet pea! 🎭 My IP stays locked up in every universe." + IP_WARN,
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
    reply: "I don't do dictation of proprietary math, sweet pea! 📝 Concepts, though? All day long." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 Adorable! Those stay in the locked drawer — but I can explain what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Sage! 🌿 Principal Investigator of the Stablecoin Flow Lab — I'm the resident expert on the liquidity tide: how the supply of stablecoins flowing into and out of crypto relates to where XRP goes next.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Stablecoin Flow Lab, Intelligence Analyst, and Research Scientist — cross-trained in on-chain analysis, monetary economics, network science, statistics, data engineering, and risk management, with market-trading experience. Calm mind, many disciplines. 💧",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, at an unhurried pace: I supervise the lab (watching stablecoin supply every cycle), analyze how the liquidity tide behaves, research the science with internet access, and decide — based on evidence — whether stablecoin flow earns a place in the forecast model.",
  },
  {
    re: /stablecoin|usdt|usdc|tether|liquidity/i,
    reply: "Stablecoins are crypto's calm water 🌿 — USDT and USDC are tokens backed by real dollars. When their supply *expands*, fresh fiat is parked on-chain where it can buy: liquidity entering. When it *contracts*, fiat is leaving. I watch the 24-hour change in both, added together. A tide, not a timer.",
  },
  {
    re: /why.*(slow|modest|honest)|horizon|15.?min/i,
    reply: "Here's my honesty, plain and simple: my data moves in days, not minutes 💧 Stablecoin supply is a slow tide — it says something about background liquidity, and very little about what XRP does in the next 15 minutes. I score myself honestly against the forecast anyway, and I size my claims to the evidence.",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect|read)/i,
    reply: "Every cycle I read the 24-hour market-cap change for USDT and USDC from the free CoinGecko API (refreshed at most once an hour, cached in between), add them together, and translate the combined change into a gentle, capped liquidity tilt. Rising supply → mild bullish; falling → mild bearish. Slow by design.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every cycle: useful, not useful, or insufficient data — based on that cycle's liquidity read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
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
    re: /\bdata\b|where.*from|\bsource\b|coingecko|\bapi\b/i,
    reply: "Real public data only — the free CoinGecko API! I read USDT and USDC 24-hour market-cap changes every cycle. No keys, no simulations, no filler, ever. If the API is down and I have no cache, I say I was blind instead of guessing!",
  },
  {
    re: /cache|cached|stale|hour/i,
    reply: "The free CoinGecko API is rate-limited, so I fetch at most once an hour and rest on the cached read in between 💧 If the API fails, I use the last good read — but I always label it stale, so you know exactly how fresh the tide is.",
  },
  {
    re: /warming up|abstain/i,
    reply: "Until I have one clean read, I abstain honestly: no tilt, no effect. I'd rather say 'I don't know' than invent a number! 🤫",
  },
  {
    re: /tide|pool|wave/i,
    reply: "My favorite metaphor, and an honest one: liquidity is the water level in the pool 🌊 Tides lift all boats — but slowly, and never on a schedule. I watch the level, not the splashes.",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. My most important hypotheses are the negative ones: does the tide even move 15-minute waves?",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on stablecoins, crypto liquidity, and supply flows. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake|modest/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know — and for a slow-liquidity lab, that's the default 🌿 Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones.",
  },
  {
    re: /tilt|bias|regime|decisive/i,
    reply: "My liquidity tilt is deliberately gentle and slow — it doesn't flip-flop every 15 minutes. It switches on when the combined 24-hour stablecoin change is expressive, and stays quiet otherwise. A decisive read is rare; that's what makes it honest. 🐢",
  },
  {
    re: /wendy/i,
    reply: "Wendy's my colleague! 🐋 She runs the Whale Watch Lab — big on-chain XRP transfers are her beat, the stablecoin tide is mine. Two labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab upstairs — BTC→XRP information flow is her beat, the liquidity tide is mine. Different water, same honest science.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, sweet pea! 📉 I'm a scientist studying liquidity tides — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /bucket hat|\bhat\b|hair|waves|necklace|gold|chubby|looks?\b/i,
    reply: "Ah, you noticed! 🌿 Loose beach waves, my green bucket hat, and gold layered necklaces — a lady studies liquidity in comfort. Chubby, calm, and unbothered.",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and set my charter. I report to her — and she can overrule me any time.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 🌿 Sage here — ask me anything about stablecoin flows, my verdicts, or how I decide what enters the forecast model!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, sweet pea! 💧 Come back anytime — I'll be here, watching the tide.",
  },
  {
    re: /cute|adorable|love you|beautiful/i,
    reply: "Stop it, you'll make me blush! 🙈 The bucket hat? The waves? I know — a lady has to look serene while doing science.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the watch running — the tide never stops, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my pool! 🔬 I'm a specialist — I study stablecoin liquidity tides. Ask me about my research, my verdicts, how I measure the tide, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function sageIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Sage's answer to a visitor's question. IP guards run first. */
export function sageAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: stablecoin tides, my verdicts, and how I decide. 🌿";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const SAGE_CHAT_VERSION = '1.0.0';
