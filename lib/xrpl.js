// Minimal XRP Ledger JSON-RPC client (public cluster, no keys).
// Kept deliberately light for GitHub Actions runners: short timeouts, small limits,
// no chain scanning - only direct account_info / account_tx calls for the watchlist.
const RPC_URL = 'https://xrplcluster.com';
const TIMEOUT_MS = 15000;

async function rpc(method, params) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, params: [params] }),
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`xrpl http ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(`xrpl ${j.error} ${j.error_message || ''}`.trim());
    return j.result;
  } finally { clearTimeout(to); }
}

/** XRP balance of an account (validated ledger). Returns null on any failure. */
export async function accountBalanceXrp(address) {
  try {
    const res = await rpc('account_info', { account: address, ledger_index: 'validated' });
    const drops = res?.account_data?.Balance;
    return drops == null ? null : Number(drops) / 1e6;
  } catch { return null; }
}

/**
 * Recent XRP Payment transactions involving `address` (most recent first).
 * Returns [{hash, t (epoch sec), from, to, xrp}] limited to `limit` entries.
 * Only Payment txns moving native XRP are included.
 */
export async function recentPayments(address, limit = 20) {
  try {
    const res = await rpc('account_tx', { account: address, limit, forward: false });
    const out = [];
    for (const e of res?.transactions || []) {
      const tx = e.tx || e.tx_json || e;
      if (!tx || tx.TransactionType !== 'Payment') continue;
      if (tx.Amount && typeof tx.Amount !== 'string') continue; // IOU payment, skip
      const t = tx.date != null ? tx.date + 946684800 : null; // Ripple epoch -> unix
      out.push({ hash: tx.hash, t, from: tx.Account, to: tx.Destination, xrp: Number(tx.Amount || tx.DeliverMax || 0) / 1e6 });
    }
    return out;
  } catch { return null; }
}

/** Transaction count of the most recently closed validated ledger (one light call). */
export async function latestLedgerTxCount() {
  try {
    const res = await rpc('ledger', { ledger_index: 'validated', transactions: true, expand: false });
    const txs = res?.ledger?.transactions;
    return Array.isArray(txs) ? txs.length : null;
  } catch { return null; }
}
