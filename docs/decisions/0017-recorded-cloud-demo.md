# 0017: Recorded Foundry output for the public cloud demo

## Decision

Deploy Go publicly and Python internally on Azure Container Apps. Use `recorded`
agent mode for this public build: the reviewed CASUAL/en-GB corner response from
the successful Foundry workflow is packaged in `agents/recordings`. No model key
is deployed. The browser labels its independently checked cue `Verified (recorded)`.

Each recording is validated at startup and keyed by the complete request,
including the fact pack. Other requests use deterministic templates. Go still
recomputes the pack and checks wording and complete evidence before publishing.
Recordings survive process restarts; mutable in-process live caches do not.

## Why

The live workflow cap is per process, not a durable spending limit. Cold starts
would reset that cap. A public demo must not expose uncontrolled paid workflows.
Live `foundry` mode remains available for explicitly capped developer tests;
broader model evaluation and durable budget enforcement remain future work.

## Hosting limits

Both services use 0.25 vCPU/0.5 GiB, zero minimum and one maximum replica.
Cold starts are expected. ACR Basic, image builds, logs and active compute can
still consume credits. Resource-group budget alerts do not stop spending.
The Go image includes all scenario data, not just the authored sample.
