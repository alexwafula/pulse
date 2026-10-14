"""Bounded agent calls and in-process cache; template mode costs nothing."""

import asyncio
from collections import OrderedDict
from copy import deepcopy
import hashlib
import json
import logging
import threading
import time

from .contracts import InsightRequest, InsightResponse
from .pipeline import insights
from .workflow import AgentBackend, ShadowRun, run_agents


class AgentService:
    def __init__(self, backend: AgentBackend | None = None, max_requests: int = 10,
                 *, publish: bool = False, workflow_timeout_seconds: float = 12.0,
                 recordings: list[tuple[InsightRequest, InsightResponse]] | None = None):
        if not 0 <= max_requests <= 100:
            raise ValueError("Model workflow request cap must be from 0 to 100")
        self.backend = backend
        if not 0 < workflow_timeout_seconds <= 12:
            raise ValueError("Workflow timeout must be between zero and twelve seconds")
        self.publish = publish
        self.workflow_timeout_seconds = workflow_timeout_seconds
        self.max_requests = max_requests
        self.requests = 0
        self.cache: OrderedDict[str, InsightResponse] = OrderedDict()
        self.lock = threading.Lock()
        self.mode = ("foundry" if publish else "foundry-shadow") if backend else "template"
        self.recorded: dict[str, InsightResponse] = {}
        if recordings is not None:
            if backend is not None or not recordings:
                raise ValueError("Recorded mode must have recordings and no live backend")
            self.mode = "recorded"
            for request, response in recordings:
                self.recorded[self.request_key(request)] = deepcopy(response)

    @staticmethod
    def request_key(request: InsightRequest) -> str:
        return hashlib.sha256(json.dumps(request, sort_keys=True, allow_nan=False).encode()).hexdigest()

    def respond(self, request: InsightRequest) -> InsightResponse:
        fallback = insights(request)
        if request["locale"] != "en-GB":
            return fallback
        key = self.request_key(request)
        if key in self.recorded:
            return deepcopy(self.recorded[key])
        if self.backend is None:
            return fallback
        # One model workflow at a time. Concurrent/repeated requests get a
        # template or cache hit rather than generating more paid calls.
        if not self.lock.acquire(blocking=False):
            return fallback
        try:
            if key in self.cache:
                self.cache.move_to_end(key)
                return deepcopy(self.cache[key])
            if self.requests >= self.max_requests:
                return fallback
            self.requests += 1
            start = time.monotonic()
            async def bounded() -> ShadowRun:
                return await asyncio.wait_for(
                    run_agents(request, self.backend, timeout_seconds=4.5, publish=self.publish),
                    self.workflow_timeout_seconds)
            try:
                result = asyncio.run(bounded())
                response = result.response
                logging.info("pulse_agent_workflow mode=%s accepted=%s attempts=%d latency_ms=%d reasons=%s",
                             self.mode, result.accepted, result.narrator_attempts,
                             round((time.monotonic()-start)*1000), result.reasons)
            except TimeoutError:
                response = fallback
                logging.warning("pulse_agent_workflow mode=%s rejected=workflow_deadline latency_ms=%d",
                                self.mode, round((time.monotonic()-start)*1000))
            self.cache[key] = deepcopy(response)
            if len(self.cache) > 128:
                self.cache.popitem(last=False)
            return deepcopy(response)
        finally:
            self.lock.release()
