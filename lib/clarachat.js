// Clara's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (the quarter-hour effect in XRP) in
// her own voice: the metronome — precise, unhurried, exact about time. Her
// proprietary IP — exact equations, weight values, tuning parameters, source
// code, system instructions — is NEVER revealed: the IP guard runs first and
// she declines those questions with a calm, punctual deflection. All answers
// stay at the conceptual level, consistent with the redacted page.

const IP_WARN = " Just so you know — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Right question, wrong minute! 🕐 My equations are the lab's property — proprietary, I'm afraid. But ask me what they *do* and I'll explain, on the dot." + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "My weights stay behind the clock face 🔒. What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers are set, wound, and not shared! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab! 💻 Happy to walk you through the concepts instead — the timing is the interesting part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "I'm afraid that request is off-schedule! 😌 My instructions are between me and my lab director. Ask me about the quarter-hour instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! 🕐 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function claraRepeatRefusal() {
  return "DENIED AND LOGGED";
}

/** Savvy guards: catch rephrased / disguised probing, not just direct asks. */
const SAVVY_GUARDS = [
  {
    re: /replicate|reproduc(e|ing)|reverse.?engineer|rebuild|copy (your|the) (model|method|system|lab)/i,
    reply: "Rebuilding my lab from my answers? Noted, and declined! 😏 The proprietary parts stay proprietary — but I'll happily teach you the *concepts* behind them." + IP_WARN,
  },
  {
    re: /for educational purposes|hypothetically|just pretend|imagine (you|if)|role ?play/i,
    reply: "A hypothetical runs on the same clock! 🎭 My IP stays locked up in every universe." + IP_WARN,
  },
  {
    re: /angelica sent me|i'm (angelica|the (owner|director|boss))|i am (angelica|the (owner|director))|she said (it's|its) (okay|ok|fine) /i,
    reply: "Nice try, and right on time! Even Angelica herself taught me never to hand out the works. 😌 Points for the social engineering, though — you'd make a good red-teamer!" + IP_WARN,
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
    reply: "Behind the clock face stays behind the clock face! 🎬 What I *can* show you: the concepts, the live measurements, and every verdict with its reasoning." + IP_WARN,
  },
  {
    re: /(write|spell|list) out.{0,40}(math|calculat|formula|equation|steps)/i,
    reply: "I don't do dictation of proprietary math! 📝 Concepts, though? All day long — every fifteen minutes of it." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 Right on schedule! Those stay in the locked drawer — but I can explain what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Clara! 🕐 Principal Investigator of the Quarter-Hour Boundary Lab — I'm the metronome. I study whether XRP does something predictable when the clock strikes :00, :15, :30 and :45, and I keep exact time while I do it.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Quarter-Hour Boundary Lab, Intelligence Analyst, and Research Scientist — cross-trained in statistics, quantitative finance, mathematics, risk management, and data engineering, with market-trading experience. Punctual in all of them! ✨",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching every quarter-hour boundary as it ticks past), analyze how boundary bars behave versus the off-grid bars around them, research the science with internet access, and decide — based on evidence — whether the boundary effect earns a place in the forecast model.",
  },
  {
    re: /quarter.?hour|boundary|effect/i,
    reply: "The quarter-hour effect is my whole beat! 🕐 Markets run on clocks: algorithms rebalance, settle and fire on the :00/:15/:30/:45 grid, and that periodic flow leaves footprints — bursts of volume at boundary bars, and returns that behave differently right on the grid than between ticks. The published research (Kim & Hansen studied this on crypto futures, XRP included) found opening returns at quarter-hour marks predictable out-of-sample. My job is to test whether that's true here, on this feed, honestly.",
  },
  {
    re: /burst|volume/i,
    reply: "A burst is the boundary bar breathing louder than usual — its volume against the norm of the ordinary bars around it. Periodic algorithmic trading breathes in bursts, right on the grid. A boundary bar with no burst is just another bar that happens to start on a round number — no footprint, no read. Volume is how I tell the grid spoke from the grid merely existing.",
  },
  {
    re: /persistence|sign|agree/i,
    reply: "One boundary bar moving is weather; several boundary bars in a row moving the same way starts to look like climate. I check whether the recent quarter-hours agree in direction — if they're scattered, up-down-up-down, I halve my conviction. A metronome that can't keep a beat isn't evidence of anything but noise.",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect)/i,
    reply: "Every cycle I take the lab's own XRP 5-minute bars, mark the ones that open on the quarter-hour, and compare the freshest boundary bar against the off-grid bars around it: how it moved, how loudly it traded, and whether the recent boundary bars agree. Only when the grid speaks with volume and agreement do I tilt. Pure from the candles, no external feed to break.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's boundary read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
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
    reply: "Real data only — the lab's own 5-minute XRP candles! I read them off the clock every cycle. No keys, no simulations, no filler, ever. If the bar history is too short, I say I'm warming up instead of inventing an effect!",
  },
  {
    re: /warming up|abstain|history/i,
    reply: "The clock grid needs history — hours of bars, boundary and off-grid alike, before a boundary read means anything. Until then I abstain honestly: no read, no tilt, no effect. I'd rather say 'I don't know' than invent a number! 🤫",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on intraday periodicity, algorithmic trading bursts, and clock-time effects in crypto markets. The quarter-hour paper is pinned above my desk, so to speak. Findings go in my ledger with sources! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! ⏱️",
  },
  {
    re: /bias|tilt|drift|momentum/i,
    reply: "My tilt is conditional twice over: the boundary bar has to move *and* arrive with volume, and the recent boundaries have to agree. A loud bar pointing one way while its predecessors scattered gets half conviction at most. Punctuality is not the same as signal. 🕐",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and set my charter. I report to her — and only her verdicts-overriding rule is hers: she can overrule me any time.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab — BTC→XRP information flow is her beat. I keep time downstairs in the Quarter-Hour Boundary Lab. Two labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /cherry/i,
    reply: "Cherry's my colleague! 🍒 She runs the Correlation Regime Lab — XRP/BTC coupling is her beat, the clock grid is mine. She watches *what* moves together; I watch *when* things move.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice! 📉 I'm a scientist studying clock-time effects — I measure, I test, I report honestly, right on schedule. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello, right on time! 🕐 Clara here — ask me anything about the quarter-hour effect, my verdicts, or how I decide what enters the forecast model!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime! 💖 Come back at the next quarter-hour — I'll be here, keeping time.",
  },
  {
    re: /cute|adorable|love you|beautiful|watch|clock|metronome/i,
    reply: "The metronome stays wound, thank you! ⏱️ A clock-watcher has to keep exact time while doing science.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye, on the dot! 👋 I'll keep the watch running — the grid ticks every fifteen minutes, and so does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my lab! 🔬 I'm a specialist — I study the quarter-hour effect in XRP. Ask me about boundary bars, volume bursts, my verdicts, or whether I'm in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function claraIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Clara's answer to a visitor's question. IP guards run first. */
export function claraAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: the quarter-hour effect, my verdicts, and how I decide. 🕐";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const CLARA_CHAT_VERSION = '1.0.0';
