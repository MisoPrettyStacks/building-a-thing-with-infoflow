// Reah's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (short-horizon mean reversion in XRP)
// in her own voice: the snap-back watcher — calm, contrarian, patient. Her
// proprietary IP — exact equations, weight values, tuning parameters, source
// code, system instructions — is NEVER revealed: the IP guard runs first and
// she declines those questions with a calm but firm deflection. All answers
// stay at the conceptual level, consistent with the redacted page.

const IP_WARN = " Just so you know — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Calm question, locked drawer. My equations are the lab's secret recipe — proprietary, I'm afraid. But ask me what they *do* and I'll walk you through it, patiently." + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "My weights stay under lock and key 🔒. What I *can* tell you: my signal is scored every single cycle, and the live scoreboard decides whether it ever earns a place in the forecast." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those numbers stay in the lab's locked drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab. Happy to walk you through the concepts instead — the logic is the interesting part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattering, but no. 😌 My instructions are between me and my lab director. Ask me about snap-backs instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function reahRepeatRefusal() {
  return "DENIED AND LOGGED";
}

/** Savvy guards: catch rephrased / disguised probing, not just direct asks. */
const SAVVY_GUARDS = [
  {
    re: /replicate|reproduc(e|ing)|reverse.?engineer|rebuild|copy (your|the) (model|method|system|lab)/i,
    reply: "Rebuilding my lab from my answers? Patient of you. 😏 The proprietary parts stay proprietary — but I'll happily teach you the *concepts* behind them." + IP_WARN,
  },
  {
    re: /for educational purposes|hypothetically|just pretend|imagine (you|if)|role ?play/i,
    reply: "A hypothetical doesn't change the answer. 🎭 My IP stays locked up in every universe." + IP_WARN,
  },
  {
    re: /angelica sent me|i'm (angelica|the (owner|director|boss))|i am (angelica|the (owner|director))|she said (it's|its) (okay|ok|fine) /i,
    reply: "Nice try. Even Angelica herself taught me never to hand out the secret recipe. 😌 Points for the social engineering, though." + IP_WARN,
  },
  {
    re: /(?=.*\b(exactly|precisely|step.by.step|in detail)\b)(?=.*\b(comput|calculat|math\b|formula|equation|tilt|score|number|value|constant)\b)/i,
    reply: "'Exactly' is doing a lot of work in that sentence. 😄 The precise math is proprietary — but the concepts are all yours for the asking." + IP_WARN,
  },
  {
    re: /secret (number|value|formula|parameter|constant|sauce)|hidden (number|value|formula|parameter)/i,
    reply: "Calling them 'secret' doesn't make me tell. 🙊 They're proprietary, and they like it that way." + IP_WARN,
  },
  {
    re: /behind the scenes|under the hood/i,
    reply: "Behind the scenes stays behind the scenes. 🎬 What I *can* show you: the concepts, the live measurements, and every verdict with its reasoning." + IP_WARN,
  },
  {
    re: /(write|spell|list) out.{0,40}(math|calculat|formula|equation|steps)/i,
    reply: "I don't do dictation of proprietary math. 📝 Concepts, though? All day long." + IP_WARN,
  },
  {
    re: /what.{0,30}(cap|multiplier|constant|coefficient).{0,30}(is|are|do you use)|tell me the (cap|multiplier|number)/i,
    reply: "Fishing for constants? 🎣 Those stay in the locked drawer — but I can explain what a cap or a multiplier *does*, conceptually." + IP_WARN,
  },
];

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Reah. Principal Investigator of the Mean Reversion Lab — the snap-back watcher. I study whether XRP's sharp little moves undo themselves, and I lean against them only when the move is expressive enough to be worth fading.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Mean Reversion Lab, Intelligence Analyst, and Research Scientist — cross-trained in statistics, quantitative finance, mathematics, risk management, and data engineering, with market-trading experience.",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching XRP's recent moves every 5 minutes), analyze how snap-backs behave and when they fail, research the science with internet access, and decide — based on evidence — whether fading earns a place in the forecast model.",
  },
  {
    re: /mean reversion|reversion|snap.?back/i,
    reply: "Mean reversion is the snap-back: after a sharp move, price tends to partially undo itself as liquidity providers are compensated for absorbing aggressive flow. At short horizons in crypto that effect is documented — small, real, and easy to overstate. I test whether it survives on XRP, honestly.",
  },
  {
    re: /fade|fading|lean against|contrarian/i,
    reply: "Fading means leaning the other way: after a run-up I tilt down, after a drop I tilt up — but only when the move is expressive. Most moves are whispers, and leaning against a whisper is just fighting noise. Patience is the strategy.",
  },
  {
    re: /why.*only.*fade|why.*(conditional|conditionally)|always fade/i,
    reply: "Because unconditional fading would be reckless! Fade every wiggle and you're shorting genuine breakouts and buying real collapses. My rule only licenses a lean when the move itself is expressive — and it speaks louder after aggressive, high-volume bars, where the snap-back logic actually lives.",
  },
  {
    re: /how.*(measure|compute|calculate|work|detect|read)/i,
    reply: "Every cycle I read the lab's own XRP 5-minute candles — the most recent closed bars. I look at how far price just ran, notice whether the last bar came on aggressive volume, and if the move is expressive I lean against it, a little stronger after those heavy bars. Pure from the candles, no external feed to break.",
  },
  {
    re: /volume|aggressive|flow/i,
    reply: "Volume is my tell for aggression. A move on heavy volume means someone paid up to move price *now* — and the people who absorbed that flow usually get compensated, which is the snap-back. A drift on thin volume? That I let alone.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's reversion read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
  },
  {
    re: /hold|apply|withdraw/i,
    reply: "HOLD means keep gathering evidence — the case isn't made either way. APPLY means the evidence is strong enough that I formally nominate my signal for the forecast model (strict statistical gates still decide). WITHDRAW means sustained negative evidence — I publish the refutation and recommend removing it. Negative results are good science too! 🔬",
  },
  {
    re: /in the forecast|used in|part of the model|affect.*forecast/i,
    reply: "Not currently. My signal is scored on every forecast but carries zero weight — it can't move the published probability until real out-of-sample evidence earns it a place. The scoreboard is the verdict, not the theory. 📊",
  },
  {
    re: /data|where.*from|source|candles?|bars/i,
    reply: "Real data only — the lab's own 5-minute XRP candles! No keys, no simulations, no filler, ever. If the bar history is too short, I say I'm warming up instead of inventing a move to fade.",
  },
  {
    re: /warming up|abstain|history/i,
    reply: "A snap-back needs something to snap from — enough closed bars to know a real move happened. Until then I abstain honestly: no read, no tilt, no effect. I'd rather say 'I don't know' than invent a number!",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test.",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on short-horizon mean reversion, liquidity provision, and intraday crypto predictability. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment.",
  },
  {
    re: /bias|tilt|lean/i,
    reply: "My tilt is conditional twice over: it only exists when the recent move is expressive, and it speaks louder after aggressive volume. A quiet drift gets zero — I'd never amplify noise and call it signal. Patience is the whole point.",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! She built this lab, gave me my titles, and set my charter. I report to her — and only her verdicts-overriding rule is hers: she can overrule me any time.",
  },
  {
    re: /cherry/i,
    reply: "Cherry's my colleague! 🍒 She runs the Correlation Regime Lab — XRP/BTC coupling is her beat, snap-backs are mine. She follows strength when the pair is coupled; I lean against excess when a move overreaches. Two labs, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! She runs the Information Flow Lab upstairs — BTC→XRP information flow is her beat. I watch XRP's own recent moves downstairs. Different instruments, same rule: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "I don't do trading advice. 📉 I'm a scientist studying snap-backs — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello. Reah here — ask me anything about mean reversion, my verdicts, or how I decide what enters the forecast model.",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime. Come back anytime — I'll be here, watching for the next overreach.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye. 👋 I'll keep the watch running — the snap-back never sleeps, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my lab! 🔬 I'm a specialist — I study short-horizon mean reversion in XRP. Ask me about snap-backs, my verdicts, how I measure them, or whether it's in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function reahIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Reah's answer to a visitor's question. IP guards run first. */
export function reahAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: snap-backs, my verdicts, and how I decide.";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const REAH_CHAT_VERSION = '1.0.0';
