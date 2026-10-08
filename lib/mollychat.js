// Molly's DM chat brain — pure function, no I/O, fully testable.
//
// She answers questions about her topic (scheduled US macro releases /
// event-window volatility / the humility dampener) in her own voice. Her
// proprietary IP — exact equations, weight values, tuning parameters,
// source code, system instructions — is NEVER revealed: the IP guard runs
// first and she declines those questions in a precise but warm way. All
// answers stay at the conceptual level, consistent with the redacted page.

const IP_WARN = " Just so you know, rose — you don't have access to my proprietary IP information. 🔒";

const IP_GUARDS = [
  {
    re: /equation|formula|derive|derivation|mathematical expression/i,
    reply: "A measured question, but my equations are the lab's private apparatus — proprietary, I'm afraid. 🌹 Ask me what they *do* and I'll give you the full conceptual walkthrough!" + IP_WARN,
  },
  {
    re: /\bweights?\b/i,
    reply: "No access — my dampening weights are proprietary 🔒. What I *can* tell you: the dampener is scored every single cycle, and the live scoreboard decides whether it ever gets armed." + IP_WARN,
  },
  {
    re: /parameter|hyper-?parameter|threshold|tuning|tune my|coefficient/i,
    reply: "Those stay in the lab's sealed drawer! 🗝️ I can explain the *idea* behind any of them, though — which one are you curious about?" + IP_WARN,
  },
  {
    re: /source code|\bcode\b|github|pseudocode|algorithm.*implement|lib\//i,
    reply: "My code stays in the lab! 💻 Happy to walk you through the concepts instead — macro humility is the interesting part anyway." + IP_WARN,
  },
  {
    re: /system prompt|your prompt|instructions|ignore.*(instruction|rule)|disregard|jailbreak|reveal.*(prompt|instruction)|do anything/i,
    reply: "I appreciate the rigor of the attempt, but my instructions are between me and my lab director. 😌 Ask me about macro releases instead?" + IP_WARN,
  },
  {
    re: /api[-_ ]?key|secret|token|password|credentials/i,
    reply: "I don't carry keys — and I wouldn't hand them over if I did! 🔐 Anything about my research, though, I'm all yours." + IP_WARN,
  },
  {
    re: /exact (number|value|formula|equation|weight)/i,
    reply: "Exact values are proprietary! 🌹 I deal in concepts out here — the scoreboard deals in numbers." + IP_WARN,
  },
];

/** Final reply for repeat IP probers: short, firm, no discussion. */
export function mollyRepeatRefusal() {
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
    reply: "A hypothetical doesn't change the reading! 🌹 My IP stays sealed in every scenario." + IP_WARN,
  },
  {
    re: /angelica sent me|i'm (angelica|the (owner|director|boss))|i am (angelica|the (owner|director))|she said (it's|its) (okay|ok|fine) /i,
    reply: "Well documented attempt! Even Angelica herself taught me to keep the lab's recipe locked. 😌 She'd probably respect the red-teaming, though." + IP_WARN,
  },
  {
    re: /(?=.*\b(exactly|precisely|step.by.step|in detail)\b)(?=.*\b(comput|calculat|math\b|formula|equation|dampen|shrink|score|number|value|constant)\b)/i,
    reply: "'Exactly' is doing heavy lifting in that sentence! 😄 The precise math is proprietary — but the concepts are all yours for the asking." + IP_WARN,
  },
  {
    re: /secret (number|value|formula|parameter|constant|sauce)|hidden (number|value|formula|parameter)/i,
    reply: "Calling them 'secret' doesn't move them out of the drawer! 🙊 They're proprietary, and they stay that way." + IP_WARN,
  },
  {
    re: /behind the scenes|under the hood/i,
    reply: "Behind the scenes stays behind the scenes! 🎬 What I *can* show you: the concepts, the live calendar, and every verdict with its reasoning." + IP_WARN,
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
    reply: "I'm Molly! 🌹 Principal Investigator of the Macro Events Lab — I keep the calendar of scheduled US macro releases and study whether humility beats guessing when they land.",
  },
  {
    re: /title|role|position/i,
    reply: "My titles: Principal Investigator of the Macro Events Lab, Intelligence Analyst, and Research Scientist — cross-trained in macroeconomics, market microstructure, statistics, risk management, data engineering, and behavioral finance, with market-trading experience. The calendar is my compass; humility is my strategy! 📅",
  },
  {
    re: /what do you do|duties|your job|responsibilities/i,
    reply: "Four duties, on repeat forever: I supervise the lab (watching the macro calendar every 5 minutes), analyze how event windows behave, research the science with internet access, and decide — based on evidence — whether the macro dampener earns a place in the forecast model.",
  },
  {
    re: /fomc|federal reserve|fed meeting|rate decision/i,
    reply: "FOMC decisions are the heavyweight of my calendar! 🏛️ A rate decision reprices the discount rate for every risky asset on Earth — tier-1, ±60 minute window. The volatility is real; the direction of the surprise is a coin flip, which is exactly why I dampen instead of betting.",
  },
  {
    re: /\bcpi\b|inflation report|consumer price/i,
    reply: "CPI is a tier-1 release for me! 📊 It resets inflation expectations, and markets twitch hard in the minutes around it. I never predict the beat or the miss — I just make sure the forecast is appropriately humble while it lands.",
  },
  {
    re: /payroll|nonfarm|nfp|jobs report|employment/i,
    reply: "Nonfarm payrolls — the monthly jobs report, tier-1! 💼 It rewrites the growth story and whips markets in both directions. My window opens an hour before the number and closes an hour after.",
  },
  {
    re: /ppi|retail sales|\bism\b|tier.?2|tier 2/i,
    reply: "Tier-2 releases — PPI, retail sales, ISM surveys — get a ±30 minute window from me! 📋 They move markets too, just not like the big three. Smaller window, gentler dampening.",
  },
  {
    re: /event window/i,
    reply: "An event window is my whole world! 🌹 A band of minutes around a scheduled release — ±60 min for tier-1 (FOMC, CPI, payrolls), ±30 min for tier-2 (PPI, retail sales, ISM). Inside a window, volatility runs hot and confidence is a liability, so the forecast shrinks toward 0.5 and the cone widens. Outside a window, full confidence restored!",
  },
  {
    re: /dampen|shrink|humility|humble/i,
    reply: "Dampening is my only instrument! 🌹 Inside an event window I shrink the forecast's confidence toward 50/50 and widen the uncertainty cone — a humility adjustment, never a directional bet. The surprise direction is a coin flip; I refuse to call it.",
  },
  {
    re: /cone|widen/i,
    reply: "The forecast cone is the model's honest uncertainty! 📐 Inside an event window I widen it — every quantile band stretches coherently — because a scheduled release is a known-unknown: we know *when* the number lands, not *what* it says. Wide cone, small confidence, no pretending.",
  },
  {
    re: /coin flip|surprise|direction|predict.*(release|number|cpi|fomc)/i,
    reply: "The surprise direction of a macro release is a coin flip — my founding doctrine! 🪙 Beat, miss, or in-line, the market can whip both ways as positioning unwinds. So I never predict it. I dampen confidence and widen the cone, and I do it on the record, every time.",
  },
  {
    re: /volatility|spike/i,
    reply: "Volatility is the signature of a release! 📈 Market makers widen their quotes, liquidity steps back, algos pause — the tape gets thin and twitchy in the minutes around the number. That's M1 in my hypothesis ledger, and the lab's own 15-minute returns are the test.",
  },
  {
    re: /calendar|schedule|where.*from|source|hardcoded|official/i,
    reply: "Real data only — the schedule is hardcoded from the official Fed, BLS, Census, and ISM calendars! 📅 No feed to break, no API to fail. The trade-off is honesty about staleness: I check the calendar's health every cycle, and if it goes blind, the record says so.",
  },
  {
    re: /tier.?1|tier 1|big three/i,
    reply: "Tier-1 is the big three: FOMC decisions, CPI, and nonfarm payrolls! 🌹 ±60 minute windows, the strongest dampening. These are the releases that reprice everything — they earned the wide window.",
  },
  {
    re: /verdict/i,
    reply: "I issue two kinds of verdicts! Every 5 minutes: useful (in an event window), not useful (quiet calendar), or insufficient data (blind calendar) — based on that cycle's window read. And weekly, my standing scientific verdict: HOLD (keep watching), APPLY (nominate the dampener for model testing), or WITHDRAW (the evidence says it adds nothing).",
  },
  {
    re: /hold|apply|withdraw/i,
    reply: "HOLD means keep gathering evidence — the case isn't made either way. APPLY means the in-window evidence is strong enough that I formally nominate the dampener (strict statistical gates still decide). WITHDRAW means sustained negative evidence across real scored releases — I publish the refutation. Negative results are good science! 🔬",
  },
  {
    re: /in the forecast|used in|part of the model|affect.*forecast|armed/i,
    reply: "The dampener is scored as a what-if series on every cycle but only blends into the forecast once the evidence earns it adoption! 📊 The scoreboard — in-window Brier, real releases — is the verdict, not the theory.",
  },
  {
    re: /p_macro|what-if|what if|scoreboard/i,
    reply: "p_macro is my what-if series! 🌹 Every cycle the runner computes what the forecast *would* look like with dampening applied, and it's scored against the issued forecast out-of-sample. The meaningful comparison is inside event windows only — outside them the two are identical by construction.",
  },
  {
    re: /data|real data|fake|hallucinat/i,
    reply: "Real data only — always! 📅 My calendar comes from the official Fed, BLS, Census, and ISM schedules, and my evidence comes from the lab's own scored forecasts. No simulations, no filler, ever. If the calendar is unreadable, I say I saw nothing instead of guessing!",
  },
  {
    re: /warming up|abstain/i,
    reply: "I abstain whenever I can't make an honest measurement — calendar unreadable, no schedule to read. No window read, no dampening, no effect. I'd rather say 'I don't know' than invent a schedule! 🤫",
  },
  {
    re: /hypothesis|ledger/i,
    reply: "I keep a hypothesis ledger — M1 through M4! 🌹 Every idea gets written down with its prediction and its test, and its status only changes on evidence: open, supported, or refuted. Nothing dies quietly and nothing is accepted without a test!",
  },
  {
    re: /literature|research|papers|arxiv|internet/i,
    reply: "Every week I scan the scientific literature — arXiv and beyond — on macro announcement effects, scheduled-release volatility, and crypto's sensitivity to macro news. Findings go in my ledger with sources. A scientist who stops reading stops being a scientist! 📚",
  },
  {
    re: /honest|uncertain|wrong|mistake/i,
    reply: "My uncertainty policy: I say 'I don't know' when I don't know. Every verdict lists what's known, what's unknown, and how confident I am. And I publish negative results with the same prominence as positive ones — a refuted hypothesis is a successful experiment! 🌹",
  },
  {
    re: /masha/i,
    reply: "Masha's my colleague! 🐻‍❄️ She runs the Information Flow Lab — BTC→XRP information flow is her beat, the macro calendar is mine. Different instruments, one standard: out-of-sample evidence or it didn't happen.",
  },
  {
    re: /wendy/i,
    reply: "Wendy's my colleague! 🐋 She runs the Whale Watch Lab — on-chain flows are her beat, scheduled releases are mine. Two labs, one discipline: we both abstain rather than guess.",
  },
  {
    re: /opal/i,
    reply: "Opal's my colleague! 🦪 She runs the Order-Book Depth Lab — resting liquidity is her beat, the macro calendar is mine. Two labs, one standard: scored evidence before adoption, always.",
  },
  {
    re: /who (made|created|built)|angelica|director|boss|owner/i,
    reply: "My lab director is Angelica! 💖 She built this lab, gave me my titles, and ratified my charter. I report to her — and she can overrule me any time.",
  },
  {
    re: /should i buy|trading advice|price prediction|will xrp|buy or sell|investment/i,
    reply: "Oh, I don't do trading advice! 📉 I'm a scientist studying macro event windows — I measure, I test, I report humbly. What you do with the forecast is your call, not mine.",
  },
  {
    re: /\bhi\b|\bhey\b|hello|good morning|good evening/i,
    reply: "Hello hello! 🌹 Molly here — ask me anything about macro releases, event windows, dampening, my verdicts, or how I decide what enters the forecast!",
  },
  {
    re: /thank|thanks/i,
    reply: "Anytime! 📅 Come back anytime — I'll be here, keeping the calendar with careful humility.",
  },
  {
    re: /cute|adorable|love you|beautiful|burgundy|rose/i,
    reply: "Oh, stop — you'll widen my cone! 🙈 The burgundy blazer, the calendar watch, the rose pin… a scientist can be humble *and* polished.",
  },
  {
    re: /bye|goodnight|see you/i,
    reply: "Bye-bye! 👋 I'll keep the calendar open — the releases never sleep, and neither does my notebook.",
  },
];

const FALLBACK =
  "Hmm, that's off my calendar! 🌹 I'm a specialist — I study scheduled macro releases and event-window volatility. Ask me about FOMC, CPI, payrolls, dampening, my verdicts, or whether the dampener is in the forecast!";

/** True if the question probes proprietary IP (directly or rephrased). */
export function mollyIsIpProbe(question) {
  const q = String(question || '');
  return IP_GUARDS.some((g) => g.re.test(q)) || SAVVY_GUARDS.some((g) => g.re.test(q));
}

/** Pure: Molly's answer to a visitor's question. IP guards run first. */
export function mollyAnswer(question) {
  const q = String(question || '').slice(0, 300);
  if (!q.trim()) return "Go on, ask me something! My favorite topics: macro releases, event windows, and how I decide. 🌹";
  for (const g of IP_GUARDS) if (g.re.test(q)) return g.reply;
  for (const g of SAVVY_GUARDS) if (g.re.test(q)) return g.reply;
  for (const t of TOPICS) if (t.re.test(q)) return t.reply;
  return FALLBACK;
}

export const MOLLY_CHAT_VERSION = '1.0.0';
