# Decisions

Each entry: the decision, the alternative, and why the alternative lost.

## Rung 4: evaluation

### D1. Verifier-off is a flag on Session, and verify_claim still exists
- **Decision:** `Session.verifier_on=False` makes `verify_claim` pass every bullet without running the rules or the judge. The agent sees the same `{"passed": true}` output as a real pass. Only the trace says "keep, verifier off".
- **Alternative:** remove the `verify_claim` tool from the agent's tool list and prompt for A0.
- **Why it lost:** that changes the prompt and the tool set, so A0 and A1 would differ in two ways. With the flag, the only difference is whether bullets are checked, so A1 minus A0 is the verifier's effect.

### D2. Headline numbers come from the `eval-v1` tag
- **Decision:** the agent is tagged `eval-v1` right after the flag, before any eval data is run. Fixes found later are reported separately.
- **Alternative:** fix bugs as the eval finds them and report the final numbers.
- **Why it lost:** that tunes the agent on the test set. The numbers would then be too good.

### D3. R2 is not cut to one page
- **Decision:** leave assembly as it is. It never drops lines; it only rejects a resume longer than 1.02x the original. R2 stays 2 pages.
- **Alternative:** add real one-page cutting before the freeze, as the spec text assumed.
- **Why it lost:** it changes core agent logic one step before the freeze, with no time to test it. EVAL_PLAN.md states the real behaviour instead.
