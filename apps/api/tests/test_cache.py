import time
from app.cache import TTLCache, clear_all_caches, metadata_cache, subtitle_cache, duration_cache


def test_ttl_cache_basic_get_set():
    cache = TTLCache(maxsize=3, default_ttl=60.0)
    cache.set("key1", "val1")
    assert cache.get("key1") == "val1"
    assert "key1" in cache
    assert cache.get("missing") is None


def test_ttl_cache_expiration():
    cache = TTLCache(maxsize=3, default_ttl=0.05)
    cache.set("short_key", "val", ttl=0.05)
    assert cache.get("short_key") == "val"
    time.sleep(0.06)
    assert cache.get("short_key") is None
    assert "short_key" not in cache


def test_ttl_cache_lru_eviction():
    cache = TTLCache(maxsize=2, default_ttl=60.0)
    cache.set("a", 1)
    cache.set("b", 2)
    # Access "a" so "b" becomes the oldest
    assert cache.get("a") == 1
    # Adding "c" should evict "b"
    cache.set("c", 3)
    assert cache.get("a") == 1
    assert cache.get("c") == 3
    assert cache.get("b") is None


def test_ttl_cache_delete_and_clear():
    cache = TTLCache(maxsize=5, default_ttl=60.0)
    cache.set("k1", 100)
    assert cache.delete("k1") is True
    assert cache.delete("nonexistent") is False
    assert cache.get("k1") is None

    cache.set("k2", 200)
    cache.clear()
    assert len(cache) == 0


def test_clear_all_caches():
    metadata_cache.set("m1", {"title": "Test"})
    subtitle_cache.set("s1", [{"text": "Hello"}])
    duration_cache.set("/tmp/test.mp4", 45.0)

    assert "m1" in metadata_cache
    assert "s1" in subtitle_cache
    assert "duration_cache" not in duration_cache
    assert duration_cache.get("/tmp/test.mp4") == 45.0

    clear_all_caches()

    assert metadata_cache.get("m1") is None
    assert subtitle_cache.get("s1") is None
    assert duration_cache.get("/tmp/test.mp4") is None
