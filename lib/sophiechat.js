// Sophie's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (session seasonality / time-of-day
// rhythms in XRP candles) in her own voice. Her proprietary IP — exact
// equations, weight values, tuning parameters, source code, system
// instructions — is NEVER revealed: the IP guard runs first and she declines
// those questions in a cute but firm way. All answers stay at the conceptual
// level, consistent with the redacted page.

const IP_WARN = " Just so you know, cutie — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Nice try, tide-rider! 🪸 My equations are the lab's secret surf wax — proprietary, I'm afraid. But ask me what they *do* and I'll ride that wave with you all day!" + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "Uh-uh! My weights are under lock and key 🔒 — that's proprietary. What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers stay in the lab's treasure chest! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab, cutie! 💻 Happy to walk you through the concepts instead — that's the fun part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattered you think I'm that easy to sweet-talk! 😌 My instructions are between me and my lab director. Ask me about session rhythms instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! 🪸 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function sophieRepeatRefusal() {
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

/** Current UTC hour -> session name (same rule as the signal code, conceptual only). */
function currentSessionName() {
  const h = new Date().getUTCHours();
  if (h >= 13 && h < 21) return 'US';
  if (h >= 7 && h < 16) return 'Europe';
  if (h >= 0 && h < 8) return 'Asia';
  return 'quiet hours';
}

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Sophie! 🪸⏰ Principal Investigator of the Session Seasonality Lab — I'm the resident expert on time-of-day rhythms in XRP's candles: whether the market's daily heartbeat across the Asia, Europe, and US sessions can help predict where XRP goes next.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Session Seasonality Lab, Intelligence Analyst, and Research Scientist — cross-trained in market microstructure, behavioral finance, statistics, data engineering, with real market-trading experience. A lady of many talents! ✨",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching the clock every 5 minutes), analyze how intraday rhythms behave, research the science of time-of-day effects with internet access, and decide — based on evidence — whether session seasonality earns a place in the forecast model.",
  },
  {
    re: /what session.*(now|current|is it)|current session|which session/i,
    reply: () => "Right now it's the " + currentSessionName() + " session by the UTC clock! ⏰ The overlaps: US handovers with Europe midday, Europe with Asia in the morning — those handover stretches are my favorite to watch.",
  },
  {
    re: /asia|europe|\bus\b|session|time ?zone/i,
    reply: "My sessions run on UTC! 🌍 Asia: roughly 0–8 UTC, Europe: 7–16 UTC, US: 13–21 UTC. They overlap a little — handovers are where the fun is — and outside them the market is in quiet hours. Each session has its own crew of traders, its own news flow, and maybe its own rhythm. That's my beat!",
  },
  {
    re: /seasonality|time.of.day|intraday|daily rhythm|heartbeat|daily pattern/i,
    reply: "Seasonality is the market's daily heartbeat! 🪸 Some hours just *behave* differently — opens, closes, lunch lulls, the US close. My question: does that rhythm carry real information about XRP's next move, or is it a mirage? My statistician side keeps a strict eye on me — 24 hours are 24 chances to fool yourself!",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect)|how do you/i,
    reply: "Every cycle I group a week+ of closed 5-minute bars by their UTC hour and take the mean return per hour. Then I look at the next three hours from now: do they historically run warm or cool? The answer is a small seasonal tilt — deliberately small, because seasonal effects are tiny and I refuse to sell a whisper as a roar! 🌊",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's clock read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
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
    re: /data|where.*from|source|candle|bar/i,
    reply: "Real data only — the lab's own 5-minute XRP candles! 🕯️ I work purely from bars: no external fetch, no keys, no simulations, no filler, ever. Fewer moving parts means fewer ways to lie. If the history is too short, I say I'm warming up instead of guessing!",
  },
  {
    re: /warming up|abstain|history|seven|7 day/i,
    reply: "Seasonality needs history — I need seven full days of closed 5-minute bars before my hour-by-hour means mean anything. Until then I abstain honestly: no read, no tilt, no effect. I'd rather say 'I don't know' than invent a rhythm! 🤫",
  },
  {
    re: /tiny|small|whisper|subtle|weak/i,
    reply: "Yes — tiny! 📏 I'll say it proudly: seasonal tilts in 5-minute returns are whispers, not roars. Anyone selling you a loud time-of-day signal is selling hype. My job is to measure the whisper honestly and let the scoreboard decide whether it's real.",
  },
  {
    re: /regime|tilt|bias/i,
    reply: "My seasonal tilt is small and honest — it points up when the next three UTC hours historically run warm, down when they run cool, and it abstains when the read is a whisper. No flip-flopping every 15 minutes; the clock moves at the clock's pace. 🐢",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on intraday seasonality, time-of-day effects, and crypto trading sessions. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
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
    re: /masha|wendy|colleague|other lab/i,
    reply: "I have the best colleagues! 🐻‍❄️ Masha runs the Information Flow Lab (BTC→XRP flows is her beat), and Wendy runs the Whale Watch Lab (whale flows on the ledger is hers). Two labs and mine — one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, sugar! 📉 I'm a scientist studying the market's daily rhythm — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 🪸 Sophie here — ask me anything about session rhythms, time-of-day effects, my verdicts, or how I decide what enters the forecast model!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, cutie! 🪸 Come back anytime — I'll be here, riding the time zones.",
  },
  {
    re: /cute|adorable|love you|beautiful|braid|crown|sunglasses|necklace|coral/i,
    reply: "Stop it, you'll make me blush! 🙈 The braided crown? The tortoiseshell sunglasses? The coral necklace? I know — a lady has to look sharp while doing science. 🪸",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the watch running — the clock never sleeps, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my lagoon! 🔬 I'm a specialist — I study the market's daily heartbeat: session rhythms and time-of-day effects in XRP's candles. Ask me about my research, my verdicts, how I read the clock, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function sophieIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Sophie's answer to a visitor's question. IP guards run first. */
export function sophieAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: session rhythms, time-of-day effects, and how I decide. 🪸";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return typeof t.reply === 'function' ? t.reply() : t.reply;
  return FALLBACK;
}

export const SOPHIE_CHAT_VERSION = '1.0.0';
