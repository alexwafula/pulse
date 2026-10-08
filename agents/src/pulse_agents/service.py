"""Bounded shadow calls and in-process cache; template mode costs nothing."""

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
from .workflow import AgentBackend, run_shadow


class AgentService:
    def __init__(self, backend: AgentBackend | None = None, max_requests: int = 10):
        if not 0 <= max_requests <= 100:
            raise ValueError("Model workflow request cap must be from 0 to 100")
        self.backend = backend
        self.max_requests = max_requests
        self.requests = 0
        self.cache: OrderedDict[str, InsightResponse] = OrderedDict()
        self.lock = threading.Lock()
        self.mode = "foundry-shadow" if backend else "template"

    def respond(self, request: InsightRequest) -> InsightResponse:
        fallback = insights(request)
        if self.backend is None:
            return fallback
        key = hashlib.sha256(json.dumps(request, sort_keys=True, allow_nan=False).encode()).hexdigest()
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
            result = asyncio.run(run_shadow(request, self.backend, timeout_seconds=4.5))
            logging.info("pulse_agent_shadow accepted=%s attempts=%d latency_ms=%d reasons=%s",
                         result.accepted, result.narrator_attempts,
                         round((time.monotonic()-start)*1000), result.reasons)
            self.cache[key] = deepcopy(result.response)
            if len(self.cache) > 128:
                self.cache.popitem(last=False)
            return result.response
        finally:
            self.lock.release()
