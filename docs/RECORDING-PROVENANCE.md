# Recording provenance audit

Audit date: 2026-10-18. Status: **CONTENT BOUND; PROVIDER PROVENANCE UNCONFIRMED**.
No new model calls were made and the recording has not been changed.

| Item | Evidence / limitation |
|---|---|
| Recording | `agents/recordings/corner-casual.en-GB.json` |
| Local file SHA-256 | `25b15cb32651f874fea036cce05ac646dd6e0bf66e16e5d2ac2c147fdae6b6e1` (raw working-file bytes; line-ending conversion changes this hash) |
| Audience | `en-GB`, `CASUAL` |
| Published sentence | The corner produced 1 shot. |
| Evidence | `evt-06`, `evt-07`; fact `fact-corner-a17ddcca8e6cba9b` |
| Content checks | Complete request matching, strict Python recording validation, independent Go publication gate; content verification is not provider attestation |
| Declared capture time | `2026-10-13T19:39:55.370Z` |
| Declared provider/deployment | Microsoft Foundry / `pulse-insights` |
| Declared model/version | `gpt-4.1-mini` / `2025-04-14` |
| Provider metadata source | These fields were hardcoded by `scripts/record-insight.mjs`, not extracted from a provider response |
| Original response/run identifier | **Pending from the person who ran the approved workflow** |

`Verified (recorded)` describes content checks on stored output, not fresh
generation or cryptographic proof of which model produced it. The documented
October 13 live workflow and the recording's self-declared metadata are not a
substitute for the original sanitized transport/run evidence.

## Close the provenance gap

The workflow operator should supply a sanitized provider response/trace with
UTC time, deployment/model metadata actually returned or observed, and a run
or response identifier. Bind it to this fact-pack request and returned sentence;
the three-stage workflow may need more than one response reference. Record
the evidence file/hash, reviewer and reviewed commit here. Redact credentials,
authorization headers, account identifiers and private data before publication.

Do not invent identifiers, rewrite the old metadata to look attested, overwrite
the recording or call a paid model just to fill this table. Until evidence is
available, describe it as **a checked recording whose provider metadata is
declared but not independently established**. Narrow public claims accordingly.
