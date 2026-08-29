---
'@awc-ui/showcase-kit': minor
---

**wealth:** new filter fields so a screen can facet without filtering a
selector's result.

`ProposalFilter` gains `minDaysOpen` and `minEstimatedValue`; `OrderFilter`
gains `advisorId` and `fromProposal`. Two threshold constants come with them,
`PROPOSAL_AGEING_DAYS` (45) and `PROPOSAL_HIGH_VALUE_EUR` (2,000,000).

All four exist because the proposals and orders tables grew filter-chip sets,
and the alternative was a `.filter()` in the screen — which the wealth app's own
contract forbids ("nothing that is not a view lives in the app", and the
proposals screen states it again at the top of the file). A threshold is the
book's opinion about its own data, so it belongs beside the fixture that
justifies it: both are chosen against the real spread rather than picked round,
and the reasoning is recorded next to the constants.

`fromProposal` is deliberately distinct from the existing `proposalId`: that one
narrows to a single proposal, this one asks only whether there is one at all —
the difference between "this order's advice" and "orders that came from advice
rather than an ad-hoc ticket".

`minDaysOpen` and `minEstimatedValue` compare with `!= null` rather than
truthiness, so a floor of `0` is honoured rather than silently dropped.
