// BL-066 — minting ids for teams and tasks.
//
// `Date.now()` alone was the id. Two objects minted in the same millisecond got
// the same id, and since both live in a `Map` keyed by it, the second `set`
// silently evicted the first: no error, no warning, an object simply gone. A
// human clicking the UI never collided; an orchestrator minting programmatically
// collides exactly the way a test loop does — so the defect grew more likely the
// more the autonomous path worked.
//
// The counter, not the timestamp, is what guarantees uniqueness. It advances on
// every mint, so no two ids from this process can be equal regardless of clock
// resolution, NTP skew, or a clock that steps backwards. The timestamp stays
// only because it makes an id legible and roughly sortable by eye — it is a
// convenience, and nothing may depend on it for identity.
let sequence = 0;

/**
 * Mint a process-unique id of the form `<prefix>-<epochMs>-<sequence>`.
 *
 * Uniqueness is guaranteed by `sequence`, never by the timestamp.
 */
export function mintId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}
