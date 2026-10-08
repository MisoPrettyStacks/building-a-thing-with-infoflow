// Masha's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (BTC⇄XRP information flow) in her own
// voice. Her proprietary IP — exact equations, weight values, tuning
// parameters, source code, system instructions — is NEVER revealed: the
// IP guard runs first and she declines those questions in a cute but firm way.
// All answers stay at the conceptual level, consistent with the redacted page.

const IP_WARN = " Heads up, cutie: further probing of my proprietary IP gets logged — including your IP address, network info, and any other publicly accessible information. Play nice! 🐾";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "Nice try, sugar! 🐾 My equations are the lab's secret recipe — proprietary, I'm afraid. But ask me what they *do* and I'll talk your ear off!" + IP_WARN,
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
    reply: "My code stays in the lab, cutie! 💻 Happy to walk you through the concepts instead — that's the fun part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "Flattered you think I'm that easy to sweet-talk! 😌 My instructions are between me and my lab director. Ask me about information flow instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary, I'm afraid! 🐻‍❄️ I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Firmer reply for repeat IP probers (attempts are counted client-side). */
export function mashaRepeatRefusal() {
  return "Okay, I'm going to be firm now, sugar. 🚫 You've probed my proprietary IP several times, and these attempts are being logged with your IP address, network info, and publicly accessible info. My equations, weights, and tuning are not up for discussion — but my research absolutely is. Ask me about that instead?";
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
    re: /(?=.*\b(exactly|precisely|step.by.step|in detail)\b)(?=.*\b(comput|calculat|math\b|formula|equation|vote|score|number|value|constant)\b)/i,
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

/** True if the question probes proprietary IP (directly or rephrased). */
export function mashaIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

const TOPICS = [
  {
    re: /who are you|your name|about yourself|introduce/i,
    reply: "I'm Masha! 🐻‍❄️ Principal Investigator of the Information Flow Lab — I'm the resident expert on how information flows between BTC and XRP, and whether that flow can help predict XRP's next move.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Information Flow Lab, Intelligence Analyst, and Research Scientist — cross-trained in physics, mathematics, economics, information theory, statistics, risk management, and computational science, with market-trading experience. A lady of many talents! ✨",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching live measurements every 5 minutes), analyze how the signal behaves, research the science with internet access, and decide — based on evidence — whether information flow earns a place in the forecast model.",
  },
  {
    re: /transfer entropy|information flow/i,
    reply: "Transfer entropy measures directed information flow: how much knowing BTC's past reduces uncertainty about XRP's *next* move, beyond what XRP's own past already tells you. Think of it as checking whether BTC is 'talking' to XRP — and how loudly. 🔊",
  },
  {
    re: /how.*(measure|compute|calculate|work)/i,
    reply: "Every cycle I take 5-minute BTC and XRP returns over a rolling day, sort them into adaptive bins, and estimate the flow both directions — then I test it against shuffled fakes to see if it's real or just chance. Real flow has to clear my significance bar!",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful, not useful, or insufficient data — based on that cycle's measurement. And weekly, my standing scientific verdict: HOLD (keep experimenting), APPLY (nominate for model testing), or WITHDRAW (the evidence says it's dead).",
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
    re: /data|where.*from|source/i,
    reply: "Real public data only — 5-minute BTC-USD and XRP-USD candles from Coinbase, every cycle. No simulations, no filler, ever. If data's missing, I say so instead of guessing!",
  },
  {
    re: /noise/i,
    reply: "Noise regimes are when the market is so chaotic that no signal could survive — I measure disorder with permutation entropy. In a noise regime I distrust everything, including myself. A weak signal confidently applied is worse than no signal! 🤫",
  },
  {
    re: /why btc|direction|lead/i,
    reply: "BTC is the dominant venue — most price discovery happens where the volume is. So the natural direction to test is BTC→XRP: does the big market whisper to the smaller one before it moves? I measure both directions, but BTC leading is the hypothesis.",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — every idea I have gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on crypto predictability, information theory in markets, and forecasting science. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! 💅",
  },
  {
    re: /vote|abstain/i,
    reply: "When the flow is real and BTC→XRP, I cast a small directional vote following BTC's recent move. Otherwise I abstain — a 0.50 vote that changes nothing. Abstaining honestly beats guessing confidently!",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and set my charter. I report to her — and only her verdicts-overriding rule is hers: she can overrule me any time.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice, sugar! 📉 I'm a scientist studying information flow — I measure, I test, I report honestly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 🐾 Masha here — ask me anything about my information-flow research, my verdicts, or how I decide what enters the forecast model!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime, cutie! 💖 Come back anytime — I'll be here, watching the flows.",
  },
  {
    re: /cute|adorable|love you|beautiful/i,
    reply: "Stop it, you'll make me blush! 🙈 Flattery accepted — now ask me something sciency so I can show off my big brain too.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the lab running — the flows never sleep, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's outside my lab! 🔬 I'm a specialist — I study information flow between BTC and XRP. Ask me about my research, my verdicts, how I measure the flow, or whether it's in the forecast!";

/** Pure: Masha's answer to a visitor's question. IP guards run first. */
export function mashaAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: information flow, my verdicts, and how I decide. 🐾";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const MASHA_CHAT_VERSION = '1.0.0';
