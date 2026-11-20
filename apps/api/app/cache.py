"""
In-memory thread-safe TTL cache for video metadata, subtitle transcripts, and media durations.
Eliminates redundant network roundtrips and repeated disk probes.
"""

import time
import threading
from collections import OrderedDict
from typing import Any, Optional


class TTLCache:
    """Thread-safe in-memory LRU cache with time-to-live (TTL) expiration."""

    def __init__(self, maxsize: int = 100, default_ttl: float = 600.0):
        self.maxsize = maxsize
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = threading.RLock()

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            if key not in self._cache:
                return default
            expires_at, value = self._cache[key]
            if time.monotonic() > expires_at:
                del self._cache[key]
                return default
            # Move to end (most recently accessed)
            self._cache.move_to_end(key)
            return value

    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        with self._lock:
            expires_at = time.monotonic() + (ttl if ttl is not None else self.default_ttl)
            if key in self._cache:
                del self._cache[key]
            elif len(self._cache) >= self.maxsize:
                # Evict oldest entry
                self._cache.popitem(last=False)
            self._cache[key] = (expires_at, value)

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    def __contains__(self, key: str) -> bool:
        return self.get(key) is not None

    def __len__(self) -> int:
        with self._lock:
            now = time.monotonic()
            # Clean expired items on length check
            expired = [k for k, (exp, _) in self._cache.items() if now > exp]
            for k in expired:
                del self._cache[k]
            return len(self._cache)


# Global cache singletons
metadata_cache = TTLCache(maxsize=100, default_ttl=600.0)    # 10 min TTL for video info
subtitle_cache = TTLCache(maxsize=100, default_ttl=600.0)    # 10 min TTL for VTT/subtitles
duration_cache = TTLCache(maxsize=200, default_ttl=3600.0)   # 1 hour TTL for file duration probes


def clear_all_caches() -> None:
    """Clears all in-memory caches. Useful in test teardown."""
    metadata_cache.clear()
    subtitle_cache.clear()
    duration_cache.clear()
