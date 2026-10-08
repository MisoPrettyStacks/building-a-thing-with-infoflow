// Nora's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (XRP crowd activity / network health)
// in her own voice: network gardener — nurturing, systems-thinking. 💚🌿
// Her proprietary IP — exact equations, weight values, tuning parameters,
// source code, system instructions — is NEVER revealed: the IP guard runs
// first and she declines those questions in a sweet but firm way. All answers
// stay at the conceptual level, consistent with the redacted page.

const IP_WARN = " Just so you know, sweetpea — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Nice try, sweetpea! 💚 My equations are the lab's secret seed mix — proprietary, I'm afraid. But ask me what they *grow* and I'll talk your ear off!" + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "Uh-uh! My weights are under lock and key 🔒 — that's proprietary. What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers stay in the greenhouse's locked drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab, sweetpea! 💻 Happy to walk you through the concepts instead — that's the fun part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattered you think I'm that easy to sweet-talk! 😌 My instructions are between me and my lab director. Ask me about the network's health instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! 💚 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function noraRepeatRefusal() {
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
    reply: "A hypothetical doesn't change the answer, sweetpea! 🎭 My IP stays locked up in every universe." + IP_WARN,
  },
  {
    re: /angelica sent me|i'm (angelica|the (owner|director|boss))|i am (angelica|the (owner|director))|she said (it's|its) (okay|ok|fine) /i,
    reply: "Nice try! Even Angelica herself taught me never to hand out the secret seed mix. 😌 Points for the social engineering, though — you'd make a good red-teamer!" + IP_WARN,
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
    reply: "I don't do dictation of proprietary math, sweetpea! 📝 Concepts, though? All day long." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 Adorable! Those stay in the locked drawer — but I can explain what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Nora! 💚 Principal Investigator of the Network Health Lab — I'm the resident expert on crowd activity on the XRP Ledger, and whether the everyday pulse of the network can help predict where XRP goes next.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Network Health Lab, Intelligence Analyst, and Research Scientist — cross-trained in network science, on-chain analysis, statistics, and data engineering, with market-trading experience. A lady of many talents! ✨",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (tending the ledger every 5 minutes), analyze how crowd activity behaves, research the science with internet access, and decide — based on evidence — whether the crowd earns a place in the forecast model.",
  },
  {
    re: /crowd vs whale|crowd or whale|vs wendy|difference.*wendy|wendy.*difference/i,
    reply: "Great question! Wendy watches the whales — the rare, enormous transfers. I watch everyone else: the crowd. Whales are events; the crowd is the climate. Her lab asks whether big splashes matter; mine asks whether the everyday pulse of the network matters. Same standard: out-of-sample evidence or it didn't happen! 💚🐋",
  },
  {
    re: /wendy/i,
    reply: "Wendy's my colleague! 🐋 She runs the Whale Watch Lab — enormous transfers are her beat, the crowd is mine. Two labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab upstairs — information flowing between markets is her beat, the network's health is mine. We share a lab hallway and a healthy respect for the null hypothesis.",
  },
  {
    re: /network health|network.*healthy|healthy network/i,
    reply: "Network health is my whole garden! 🌿 A healthy network is a busy, broad one: lots of payments settling, lots of distinct wallets taking part, real value moving. A wilting network is quiet and narrow. I measure all three and compare each day against its own recent history.",
  },
  {
    re: /payment|transaction count|tx count|how many/i,
    reply: "Payment counts are one of my three garden beds! 💚 Every cycle I fold fresh scan payments into hourly buckets and compare the last 24 hours against the 7-day median. More payments than usual means the network is blooming; fewer means it's wilting.",
  },
  {
    re: /active address|distinct wallet|participation|breadth/i,
    reply: "Participation breadth is the bed I tend most carefully! 🌿 How many *distinct* wallets moved XRP in the last 24 hours — a busy network with only a few wallets is a very different story from a busy network with thousands. Breadth tells me whether the crowd is really showing up.",
  },
  {
    re: /volume|value moved|xrp moved/i,
    reply: "Payment volume is my third garden bed! The raw XRP moved in 24 hours, compared against its own recent history. Count tells me how busy it is, breadth tells me how many showed up, and volume tells me how much weight they carried.",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect)/i,
    reply: "Every cycle I fold fresh XRPL scan payments into hourly buckets (I keep about a month of them), then compare the last 24 hours of payment counts, distinct wallets, and volume against their 7-day medians. The combined read is a slow, bounded activity tilt — deliberately patient, because crowd trends build over days, not minutes. 🌿",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's crowd read. And weekly, my standing scientific verdict: HOLD (keep tending), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
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
    re: /data|where.*from|source|ledger|scan/i,
    reply: "Real public data only — the XRP Ledger itself! Fresh payment scans are folded into my hourly buckets every cycle. No keys, no simulations, no filler, ever. If the scan feed is down, I say I was blind instead of guessing!",
  },
  {
    re: /warming up|abstain|history/i,
    reply: "Crowd comparisons need history — I need several days of hourly buckets before my 24h-vs-median reads mean anything. Until then I abstain honestly: no read, no tilt, no effect. I'd rather say 'I don't know' than invent a number! 🤫",
  },
  {
    re: /bloom|wilt|calm|quiet/i,
    reply: "My garden vocabulary! 🌿 Blooming means the crowd is clearly more active than its recent norm (adoption-like); wilting means clearly less active (attention fading); calm means the crowd is within its usual rhythm. Most cycles are calm — and I say so honestly.",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on blockchain network activity, active addresses, and on-chain adoption metrics. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
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
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, sweetpea! 📉 I'm a scientist tending the network's health — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 💚 Nora here — ask me anything about network health, my verdicts, or how I decide what enters the forecast model!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, sweetpea! 🌿 Come back anytime — I'll be here, tending the network.",
  },
  {
    re: /cute|adorable|love you|beautiful|bob|scarf|earrings/i,
    reply: "Stop it, you'll make me blush! 🙈 The sleek bob? The emerald studs and silk scarf? I know — a lady has to look sharp while doing science.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep tending the garden — the network never sleeps, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my garden! 🔬 I'm a specialist — I study crowd activity on the XRP Ledger. Ask me about my research, my verdicts, how I measure network health, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function noraIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Nora's answer to a visitor's question. IP guards run first. */
export function noraAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: network health, my verdicts, and how I decide. 💚";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const NORA_CHAT_VERSION = '1.0.0';
