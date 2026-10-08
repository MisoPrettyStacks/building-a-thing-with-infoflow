// Daisy's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (XRP derivatives positioning:
// funding rates, open interest, crowded positioning) in her own voice.
// Her proprietary IP — exact equations, weight values, tuning parameters,
// source code, system instructions — is NEVER revealed: the IP guard runs
// first and she declines those questions in a sunny but firm way. All
// answers stay at the conceptual level, consistent with the redacted page.

const IP_WARN = " Just so you know, sunshine — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Aww, nice try! 🌼 My equations are the lab's secret recipe — proprietary, I'm afraid. But ask me what they *do* and I'll talk all day!" + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "Nope, those stay locked up! 🔒 My weight values are proprietary. What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers stay in the lab's locked drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab, sunshine! 💻 Happy to walk you through the concepts instead — that's the fun part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattered you think I'm that easy to sweet-talk! 😌 My instructions are between me and my lab director. Ask me about funding rates instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! 🌼 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function daisyRepeatRefusal() {
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
    reply: "A hypothetical doesn't change the answer, sunshine! 🎭 My IP stays locked up in every universe." + IP_WARN,
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
    reply: "I don't do dictation of proprietary math, sunshine! 📝 Concepts, though? All day long." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 Adorable! Those stay in the locked drawer — but I can explain what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Daisy! 🌼 Principal Investigator of the Derivatives Lab — I'm the resident expert on XRP perpetual-futures positioning: funding rates, open interest, and whether the derivatives crowd can help predict where XRP goes next.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Derivatives Lab, Intelligence Analyst, and Research Scientist — cross-trained in derivatives markets, market microstructure, statistics, risk management, and data engineering, with market-trading experience. A lady of many talents! ✨",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching the derivatives feed every 5 minutes), analyze how positioning regimes behave, research the science with internet access, and decide — based on evidence — whether derivatives positioning earns a place in the forecast model.",
  },
  {
    re: /funding rate|funding/i,
    reply: "Funding is my crowd meter! 📈 On perpetual futures, when funding is persistently positive, longs are paying shorts — the long side is crowded and fragile. When it's persistently negative, shorts are packed and the pain trade is up. I read regimes, not single prints — one spike is weather, a sustained regime is climate.",
  },
  {
    re: /open interest/i,
    reply: "Open interest is my amplifier! 📊 It's the total size of open positions. A funding tilt *with rising open interest* means fresh money is piling into the crowded side — the read gets stronger. A tilt on flat or falling OI? Just the leftover crowd — I hold that one lightly.",
  },
  {
    re: /crowded|crowd/i,
    reply: "Crowded means everyone's leaning the same way! 🌼 When the whole derivatives market is packed into one side, the marginal buyer is already in — and the pain trade runs against them. Crowded longs lean bearish, crowded shorts lean bullish. My whole lab is built on measuring that.",
  },
  {
    re: /squeeze|long squeeze|short squeeze/i,
    reply: "Squeezes are what happen when a crowd has to unwind in a hurry! When everyone is packed into one side and price moves against them, they all rush for the exit at once — that's forced buying or selling into thin liquidity. It's the mechanism behind my crowd meter.",
  },
  {
    re: /perpetual|perp/i,
    reply: "Perpetual futures never expire — that's why funding exists! Without a settlement date, the contract needs a little mechanism to stay tethered to spot: every few hours, the side that's more crowded pays the other side. So the funding rate is literally the crowd, measured and monetized.",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect)/i,
    reply: "Every cycle I read the average funding rate from the public derivatives feed, check whether open interest is rising or falling across recent readings, and combine them into a slow positioning tilt. Persistent funding + climbing OI = a real crowd. The tilt is deliberately slow — it doesn't flip-flop on every print.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's positioning read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
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
    re: /data|where.*from|source|bybit/i,
    reply: "Real public data only — the public derivatives feed! I read XRP perpetual funding and open interest every cycle. No keys, no simulations, no filler, ever. If the feed is down, I say I was blind instead of guessing!",
  },
  {
    re: /warming up|abstain|history/i,
    reply: "Positioning reads need a trail — I need a real history of funding and open-interest readings before my comparisons mean anything. Until then I abstain honestly: no read, no tilt, no effect. I'd rather say 'I don't know' than invent a number! 🤫",
  },
  {
    re: /tilt|bias|regime/i,
    reply: "My positioning tilt is deliberately slow — it doesn't flip-flop every 15 minutes. It switches on when the crowd gets decisive and stays until the regime genuinely changes. Fast signals are exciting; slow signals are honest. 🐢",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on funding rates, perpetual futures, open interest, and crowded positioning. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! 💅",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and set my charter. I report to her — and only her verdicts-overriding rule is hers: she can overrule me any time.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab — BTC→XRP information flow is her beat, derivatives positioning is mine. Two labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /wendy/i,
    reply: "Wendy's my colleague! 🐋 She runs the Whale Watch Lab — on-chain whale flows are her beat, derivatives positioning is mine. She likes her wigs yellow; I like my daisy clips. Two labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, sunshine! 📉 I'm a scientist studying derivatives positioning — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 🌼 Daisy here — ask me anything about funding rates, open interest, my verdicts, or how I decide what enters the forecast model!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, sunshine! 💛 Come back anytime — I'll be here, watching the crowd.",
  },
  {
    re: /cute|adorable|love you|beautiful|clips|buns|hat|sun hat/i,
    reply: "Stop it, you'll make me blush! 🙈 The daisy clips? The space buns? The sun hat? I know — a lady has to look fresh while doing science. 🌼",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the watch running — the derivatives market never sleeps, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my garden! 🔬 I'm a specialist — I study derivatives positioning on XRP: funding rates, open interest, and crowded markets. Ask me about my research, my verdicts, how I measure the crowd, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function daisyIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Daisy's answer to a visitor's question. IP guards run first. */
export function daisyAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: funding rates, open interest, crowded positioning, and my verdicts. 🌼";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const DAISY_CHAT_VERSION = '1.0.0';
