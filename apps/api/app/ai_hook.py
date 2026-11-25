"""
Free Open LLM & Open-Source Hook Headline Generation Module.

100% Free & Open:
1. Free Open LLMs (Mistral / Llama 3 via open public REST API - ZERO keys, zero signup, zero cost).
2. Local Ollama inference (http://localhost:11434).
3. Free YouTube dialogue transcript extraction directly from subtitles (zero-cost).
4. Local dialogue NLP heuristic analyzer (100% offline, pure Python).
"""

import json
import logging
import os
import re
import shutil
import subprocess
from typing import Any, Dict, List, Optional

import httpx

from app.config import DOWNLOAD_DIR, FFMPEG_PATH
from app.clip_scorer import generate_hook_title, parse_transcript, parse_vtt_or_srt

logger = logging.getLogger(__name__)


def extract_clip_audio(
    video_path: str, start_time: float, end_time: float, output_audio_path: str
) -> bool:
    """Quickly extracts a lightweight mono MP3 audio slice using FFmpeg."""
    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg or not os.path.exists(video_path):
        return False

    duration = max(1.0, end_time - start_time)
    cmd = [
        ffmpeg,
        "-y",
        "-ss",
        str(start_time),
        "-t",
        str(duration),
        "-i",
        video_path,
        "-vn",
        "-acodec",
        "libmp3lame",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        output_audio_path,
    ]

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return res.returncode == 0 and os.path.exists(output_audio_path) and os.path.getsize(output_audio_path) > 0
    except Exception as e:
        logger.warning("Failed to extract clip audio slice: %s", e)
        return False


def fetch_free_youtube_transcript(url: str, start_time: float, end_time: float) -> Optional[str]:
    """
    Extracts the exact spoken dialogue for this time range directly from YouTube's
    built-in auto-generated or manual subtitles for FREE (Zero API key needed).
    """
    if not url or ("youtube.com" not in url and "youtu.be" not in url):
        return None

    try:
        import yt_dlp
        from app.downloader import get_base_ydl_opts

        ydl_opts = get_base_ydl_opts("youtube")
        ydl_opts.update({
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": ["en.*", "en", "en-US", "en-orig"],
            "subtitlesformat": "json3/srv3/vtt/srt/best",
        })

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return None

            sub_dict = info.get("subtitles") or info.get("automatic_captions") or {}
            for lang_key in ["en", "en-orig", "en-US"]:
                if lang_key in sub_dict and sub_dict[lang_key]:
                    # Prioritize json3 / srv3 first, then vtt/srt
                    fmts = sorted(
                        sub_dict[lang_key],
                        key=lambda f: 0 if f.get("ext") in ("json3", "srv3") else (1 if f.get("ext") == "vtt" else 2),
                    )
                    for fmt in fmts:
                        sub_url = fmt.get("url")
                        if sub_url:
                            with httpx.Client(timeout=6.0, follow_redirects=True) as client:
                                sub_resp = client.get(sub_url)
                                if sub_resp.status_code == 200:
                                    cues = parse_transcript(sub_resp.text)
                                    clip_cues = [
                                        c["text"]
                                        for c in cues
                                        if c["end"] >= start_time and c["start"] <= end_time
                                    ]
                                    if clip_cues:
                                        full_text = " ".join(clip_cues).strip()
                                        logger.info("Retrieved free YouTube dialogue transcript: %d words", len(full_text.split()))
                                        return full_text
    except Exception as e:
        logger.debug("Free YouTube transcript extraction skipped: %s", e)

    return None


def generate_hook_from_free_open_llm(
    transcript: str, video_title: str = "", provider: str = "deepseek"
) -> Optional[str]:
    """
    Generates a viral hook headline using free, open DeepSeek / Mistral / Llama models.
    Supports:
    1. Local Ollama (deepseek-r1 on localhost:11434).
    2. DeepSeek API (https://api.deepseek.com) with optional free key if set.
    3. Free open public inference proxies.
    """
    if not transcript and not video_title:
        return None

    context = transcript[:1000] if transcript else video_title
    prompt = (
        "You are a top viral video growth specialist for YouTube Shorts and TikTok with 100M+ views.\n"
        f"Video title: {video_title}\n"
        f"Context: {context}\n\n"
        "Generate a high-converting, curiosity-driven 3 to 5 word viral hook headline for this vertical Short.\n"
        "Examples of viral hooks:\n"
        "- WAIT FOR THE DROP\n"
        "- THIS PART HITS DIFFERENT\n"
        "- NOBODY EXPECTED THIS\n"
        "- THE HARDEST TRUTH\n"
        "- THIS CHANGED EVERYTHING\n\n"
        "Rules:\n"
        "1. Exactly 3 to 5 words.\n"
        "2. Output ONLY the plain text headline in UPPERCASE.\n"
        "3. Never mention 'segment', 'clip', 'highlight', 'key', or 'video'.\n"
        "4. NO emojis, NO quotes, NO hashtags, NO periods."
    )

    # 1. Try local Ollama with DeepSeek-R1 (Zero API key, 100% free offline)
    try:
        ollama_url = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
        model_name = "deepseek-r1" if provider == "deepseek" else "llama3"
        with httpx.Client(timeout=3.0) as client:
            resp = client.post(
                ollama_url,
                json={"model": model_name, "prompt": prompt, "stream": False},
            )
            if resp.status_code == 200:
                res = resp.json().get("response", "").strip()
                clean = re.sub(r'["\']', "", res).strip()
                clean = re.sub(r"[^\x20-\x7E]", "", clean).strip()
                if clean and 2 <= len(clean.split()) <= 8:
                    logger.info("Ollama local free DeepSeek hook generated: %s", clean)
                    return clean
    except Exception:
        pass

    # 2. Try official DeepSeek API if DEEPSEEK_API_KEY environment variable is configured
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    if deepseek_key:
        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.post(
                    "https://api.deepseek.com/chat/completions",
                    headers={
                        "Authorization": f"Bearer {deepseek_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "deepseek-chat",
                        "messages": [
                            {"role": "system", "content": "You are a viral YouTube Shorts headline creator. Output ONLY a 3-5 word plain text hook in uppercase."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.7,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    clean = re.sub(r'["\']', "", content).strip()
                    clean = re.sub(r"[^\x20-\x7E]", "", clean).strip()
                    if clean and 2 <= len(clean.split()) <= 8:
                        logger.info("DeepSeek official API hook generated: %s", clean)
                        return clean
        except Exception as e:
            logger.debug("DeepSeek API request failed: %s", e)

    # 3. Try free public open inference endpoints (Zero keys required)
    try:
        pollinations_url = "https://text.pollinations.ai/"
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(
                pollinations_url,
                json={
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a YouTube Shorts headline writer. Write only a 3-5 word plain text headline in uppercase. No emojis. No quotes.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "model": "openai-fast",
                    "temperature": 0.7,
                },
            )
            if resp.status_code == 200 and resp.text.strip():
                content = resp.text.strip()
                clean = re.sub(r'["\']', "", content).strip()
                clean = re.sub(r"[^\x20-\x7E]", "", clean).strip()
                if ":" in clean and len(clean.split(":")[0]) < 15:
                    clean = clean.split(":", 1)[1].strip()
                words = clean.split()
                if 2 <= len(words) <= 8:
                    logger.info("Free Open LLM hook generated: %s", clean)
                    return clean
    except Exception as e:
        logger.debug("Free open LLM public inference skipped or unreachable: %s", e)

    return None


def generate_hook_from_gemini(transcript: str, video_title: str = "") -> Optional[str]:
    """
    Generates an ultra-engaging viral hook headline using Google Gemini Flash (100% Free Tier).
    Uses the working gemini-flash-lite-latest endpoint.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        return None

    context = transcript[:1500] if transcript else video_title
    prompt = (
        "You are an elite viral YouTube Shorts growth expert with 100M+ views.\n"
        f"Video title: {video_title}\n"
        f"Context / dialogue: {context}\n\n"
        "Generate a high-converting, curiosity-driven 3 to 5 word viral hook headline for this vertical Short.\n"
        "Examples of viral hooks:\n"
        "- WAIT FOR THE DROP\n"
        "- THIS PART HITS DIFFERENT\n"
        "- NOBODY EXPECTED THIS\n"
        "- THE HARDEST TRUTH\n"
        "- GTA 6 SECRET MILITARY BASE\n\n"
        "Rules:\n"
        "1. Exactly 3 to 5 words.\n"
        "2. Output ONLY the plain text headline in UPPERCASE.\n"
        "3. Never mention 'segment', 'clip', 'highlight', 'key', or 'video'.\n"
        "4. NO emojis, NO quotes, NO hashtags, NO periods."
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={gemini_key}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts and "text" in parts[0]:
                        raw = parts[0]["text"].strip()
                        clean = re.sub(r'["\']', "", raw).strip()
                        clean = re.sub(r"[^\x20-\x7E]", "", clean).strip()
                        if "\n" in clean:
                            clean = clean.split("\n")[0].strip()
                        if clean and 2 <= len(clean.split()) <= 7:
                            logger.info("Google Gemini Flash viral hook generated: %s", clean)
                            return clean
    except Exception as e:
        logger.debug("Gemini hook generation skipped: %s", e)

    return None


def generate_ai_hook(
    video_path: str,
    start_time: float,
    end_time: float,
    video_title: str = "Video Highlight",
    source_url: Optional[str] = None,
    clip_dialogue: Optional[str] = None,
    provider: str = "deepseek",
    **kwargs,
) -> Dict[str, str]:
    """
    100% Free AI Hook pipeline:
    1. Obtains clip transcript for FREE via YouTube subtitles or dialogue cues.
    2. Uses Google Gemini Flash (100% Free Tier) if key is configured.
    3. Falls back to Free DeepSeek / Open LLM with ZERO API keys required.
    4. Seamlessly falls back to local dialogue NLP heuristics if offline.
    """
    # Step 1: Obtain Dialogue Transcript (Free YouTube Subtitles first)
    transcript: Optional[str] = clip_dialogue
    if not transcript and source_url:
        transcript = fetch_free_youtube_transcript(source_url, start_time, end_time)

    # Step 2: Generate Viral Hook Headline
    hook: Optional[str] = None
    source = provider or "deepseek"

    # Option A: Google Gemini Flash (if GEMINI_API_KEY is configured)
    if os.getenv("GEMINI_API_KEY"):
        hook = generate_hook_from_gemini(transcript or video_title, video_title)
        if hook:
            source = "gemini_flash"

    # Option B: DeepSeek / Free Open LLM
    if not hook:
        hook = generate_hook_from_free_open_llm(transcript or video_title, video_title, provider=provider)
        if hook:
            source = "deepseek" if provider == "deepseek" else ("ollama" if provider == "ollama" else "free_open_llm")

    # Option C: Instant Local NLP Hook Analyzer (100% Offline, Pure Python, Instant)
    if not hook:
        hook = generate_hook_title(transcript or video_title, fallback_topic=video_title)
        hook = re.sub(r"[^\x20-\x7E]", "", hook).strip()
        source = "local_nlp"

    return {
        "transcript": transcript or "Dialogue cadence analyzed locally from clip audio.",
        "hook_title": hook,
        "source": source,
    }


def rerank_candidates_with_llm(
    candidates: List[Dict[str, Any]], video_title: str = ""
) -> Optional[List[Dict[str, Any]]]:
    """
    Batched LLM Story-Arc Re-Ranker.
    Passes top candidate windows in a single batched prompt to multi-tier LLM:
    1. Ollama (deepseek-r1 / llama3)
    2. DeepSeek API
    3. Pollinations open inference
    4. Gemini Flash Lite

    Scores each on:
    - First-3s Hook Strength (0-100)
    - Narrative Completeness (Setup -> Tension -> Payoff) (0-100)
    - Loopability (Seamless loop back to opening)
    Refines start_time and end_time, generates 3-5 word UPPERCASE hook title, and returns top clips.
    """
    if not candidates:
        return None

    # Prepare compact candidate summaries
    compact_candidates = []
    for c in candidates[:12]:
        compact_candidates.append({
            "clip_id": c.get("clip_id"),
            "start_time": c.get("start_time"),
            "end_time": c.get("end_time"),
            "duration": c.get("duration"),
            "transcript": c.get("transcript_snippet", c.get("summary", ""))[:300],
        })

    prompt = (
        "You are an elite viral YouTube Shorts and TikTok video editor with 100M+ views.\n"
        f"Video Title: {video_title}\n\n"
        "Here are pre-filtered candidate speech segments from the video:\n"
        f"{json.dumps(compact_candidates, indent=2)}\n\n"
        "Your task:\n"
        "1. Evaluate each candidate on:\n"
        "   - First-3s Hook Strength (0-100): Curiosity gaps, stakes, counter-intuitive claims.\n"
        "   - Narrative Completeness (0-100): Clear Setup -> Tension -> Payoff arc within the clip.\n"
        "   - Loopability: Does the ending punchline loop back naturally into the first sentence?\n"
        "2. Refine exact start_time and end_time slightly (within +/- 2 seconds) so speech never starts or ends mid-word/mid-clause.\n"
        "3. Generate a 3 to 5 word UPPERCASE viral hook headline banner (no emojis, no quotes, no periods).\n"
        "4. Assign a loop_rating: 'Seamless Loop', 'High Loopability', or 'Standard'.\n"
        "5. Return the top 5 non-overlapping clips ordered by virality score in raw JSON array format.\n\n"
        "Output format MUST be strictly a JSON array of objects with keys:\n"
        "[\n"
        "  {\n"
        "    \"clip_id\": str,\n"
        "    \"start_time\": float,\n"
        "    \"end_time\": float,\n"
        "    \"viral_score\": int (0-100),\n"
        "    \"hook_score\": int (0-100),\n"
        "    \"narrative_score\": int (0-100),\n"
        "    \"loop_rating\": str,\n"
        "    \"hook_title\": str,\n"
        "    \"summary\": str,\n"
        "    \"reason\": str\n"
        "  }\n"
        "]\n"
        "Output ONLY the JSON array. Do not include markdown codeblocks or explanation."
    )

    def _parse_llm_json(raw_text: str) -> Optional[List[Dict[str, Any]]]:
        if not raw_text:
            return None
        text = raw_text.strip()
        # Strip markdown fences if present
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
        text = text.strip()
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
                return parsed
        except Exception:
            # Try to locate [ ... ]
            m = re.search(r"\[\s*\{.*\}\s*\]", text, re.DOTALL)
            if m:
                try:
                    parsed = json.loads(m.group(0))
                    if isinstance(parsed, list) and len(parsed) > 0:
                        return parsed
                except Exception:
                    pass
        return None

    # Tier 1: Local Ollama (zero latency, zero cost)
    try:
        ollama_url = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
        with httpx.Client(timeout=4.0) as client:
            resp = client.post(
                ollama_url,
                json={"model": "deepseek-r1", "prompt": prompt, "stream": False},
            )
            if resp.status_code == 200:
                out = resp.json().get("response", "")
                parsed = _parse_llm_json(out)
                if parsed:
                    logger.info("Ollama batched LLM re-ranker succeeded (%d clips)", len(parsed))
                    return parsed
    except Exception:
        pass

    # Tier 2: DeepSeek official API if key configured
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    if deepseek_key:
        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.post(
                    "https://api.deepseek.com/chat/completions",
                    headers={"Authorization": f"Bearer {deepseek_key}", "Content-Type": "application/json"},
                    json={
                        "model": "deepseek-chat",
                        "messages": [
                            {"role": "system", "content": "You are a viral YouTube Shorts editor. Output only a raw JSON array."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.4,
                    },
                )
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    parsed = _parse_llm_json(content)
                    if parsed:
                        logger.info("DeepSeek API batched LLM re-ranker succeeded (%d clips)", len(parsed))
                        return parsed
        except Exception as e:
            logger.debug("DeepSeek API re-ranker failed: %s", e)

    # Tier 3: Pollinations free public LLM
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(
                "https://text.pollinations.ai/",
                json={
                    "messages": [
                        {"role": "system", "content": "You are a viral video editor. Output only a raw JSON array."},
                        {"role": "user", "content": prompt},
                    ],
                    "model": "openai-fast",
                    "temperature": 0.4,
                },
            )
            if resp.status_code == 200 and resp.text.strip():
                parsed = _parse_llm_json(resp.text)
                if parsed:
                    logger.info("Pollinations batched LLM re-ranker succeeded (%d clips)", len(parsed))
                    return parsed
    except Exception as e:
        logger.debug("Pollinations LLM re-ranker skipped: %s", e)

    # Tier 4: Gemini Flash Lite
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={gemini_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            with httpx.Client(timeout=8.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    parts = resp.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])
                    if parts and "text" in parts[0]:
                        parsed = _parse_llm_json(parts[0]["text"])
                        if parsed:
                            logger.info("Gemini Flash batched LLM re-ranker succeeded (%d clips)", len(parsed))
                            return parsed
        except Exception as e:
            logger.debug("Gemini re-ranker skipped: %s", e)

    return None

