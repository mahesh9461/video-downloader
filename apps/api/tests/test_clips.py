import json
import os
import pytest
from unittest.mock import patch, MagicMock

from app.clip_scorer import (
    parse_timestamp_to_seconds,
    parse_vtt_or_srt,
    parse_json3_captions,
    parse_transcript,
    group_words_into_sentences,
    build_sentence_aligned_windows,
    evaluate_hook_score,
    evaluate_dialogue_pacing,
    generate_hook_title,
    analyze_and_score_clips,
    _generate_fallback_candidates,
)
from app.clip_renderer import (
    ClipRenderException,
    sanitize_drawtext_string,
    build_video_filtergraph,
    render_viral_clip,
    process_clip_render,
    generate_ass_subtitles,
    detect_and_trim_loop_silence,
    track_faces_in_clip,
    _require_ffmpeg,
    LAYOUT_PRESETS,
    MUSIC_PRESETS,
    HOOK_STYLES,
)
from app.schemas import VideoMetadata


# ---------------------------------------------------------------------------
# Unit tests: Clip Scorer
# ---------------------------------------------------------------------------


class TestClipScorer:

    def test_parse_timestamp_to_seconds(self):
        assert parse_timestamp_to_seconds("00:01:30.500") == 90.5
        assert parse_timestamp_to_seconds("01:15.200") == 75.2
        assert parse_timestamp_to_seconds("00:00:05,000") == 5.0
        assert parse_timestamp_to_seconds("42") == 42.0

    def test_parse_vtt(self):
        vtt_content = """WEBVTT

00:00:02.000 --> 00:00:06.000
Why do most startups fail in the first year?

00:00:06.500 --> 00:00:10.000
The truth is they ignore customer feedback.
"""
        cues = parse_vtt_or_srt(vtt_content)
        assert len(cues) == 2
        assert cues[0]["start"] == 2.0
        assert cues[0]["end"] == 6.0
        assert "Why do most startups fail" in cues[0]["text"]
        assert cues[1]["start"] == 6.5

    def test_parse_srt(self):
        srt_content = """1
00:00:01,000 --> 00:00:04,500
Have you ever heard of this insane productivity hack?

2
00:00:05,000 --> 00:00:08,000
It literally doubles your output.
"""
        cues = parse_vtt_or_srt(srt_content)
        assert len(cues) == 2
        assert cues[0]["start"] == 1.0
        assert cues[0]["end"] == 4.5
        assert "insane productivity hack" in cues[0]["text"]

    def test_evaluate_hook_score_high_curiosity(self):
        score, reason = evaluate_hook_score("Why do 99% of people fail? Here is the secret truth.")
        assert score >= 35
        assert "Opening Question" in reason or "Curiosity Question" in reason

    def test_evaluate_hook_score_low(self):
        score, reason = evaluate_hook_score("Hello everyone today we are sitting in the room.")
        assert score == 0
        assert reason == "Conversational Opening"

    def test_evaluate_dialogue_pacing(self):
        # 140 words in 60s = 140 WPM (ideal)
        words_ideal = ["word"] * 140
        score_ideal, reason_ideal = evaluate_dialogue_pacing(words_ideal, 60.0)
        assert score_ideal == 35
        assert "High-energy cadence" in reason_ideal

        # 20 words in 60s = 20 WPM (sparse)
        words_sparse = ["word"] * 20
        score_sparse, reason_sparse = evaluate_dialogue_pacing(words_sparse, 60.0)
        assert score_sparse <= 15
        assert "Sparse speech" in reason_sparse

    def test_generate_hook_title(self):
        title1 = generate_hook_title("Why do most people make this huge mistake in life?")
        assert "WHY" in title1 or "MISTAKE" in title1
        assert len(title1) > 0
        # Ensure emojis are avoided so FFmpeg fonts don't render tofu boxes
        assert not any(e in title1 for e in ["🤔", "⚠️", "🔥"])

        title2 = generate_hook_title("The secret nobody talks about", fallback_topic="Finance")
        assert "SECRET" in title2

    def test_analyze_and_score_clips_with_cues(self):
        cues = [
            {"start": 10.0, "end": 14.0, "text": "Why is everyone obsessed with this secret strategy?"},
            {"start": 14.0, "end": 25.0, "text": "It completely changed how we build modern software forever."},
            {"start": 25.0, "end": 45.0, "text": "Nobody expected results this crazy and unbelievable in the industry."},
            {"start": 80.0, "end": 85.0, "text": "Now let us move to part two of this tutorial discussion."},
            {"start": 85.0, "end": 120.0, "text": "We will configure the server settings one by one."},
        ]
        clips = analyze_and_score_clips(cues, total_duration=180.0, video_title="Software Mastery", max_clips=3)
        assert len(clips) > 0
        assert clips[0].viral_score >= 60
        assert clips[0].duration >= 15.0
        # Ensure clips don't overlap completely
        if len(clips) > 1:
            assert clips[0].clip_id != clips[1].clip_id

    def test_analyze_and_score_clips_fallback_without_cues(self):
        clips = analyze_and_score_clips(None, total_duration=200.0, video_title="Tech Talk", max_clips=4)
        assert len(clips) == 4
        assert all(c.viral_score > 0 for c in clips)
        assert clips[0].start_time < clips[1].start_time

    def test_parse_json3_captions(self):
        raw_json = {
            "events": [
                {
                    "tStartMs": 2000,
                    "dDurationMs": 3000,
                    "segs": [
                        {"utf8": "Why", "tOffsetMs": 0},
                        {"utf8": " did", "tOffsetMs": 300},
                        {"utf8": " this", "tOffsetMs": 600},
                        {"utf8": " happen?", "tOffsetMs": 900},
                    ],
                }
            ]
        }
        cues = parse_json3_captions(raw_json)
        assert len(cues) == 1
        assert cues[0]["start"] == 2.0
        assert cues[0]["end"] >= 5.0
        assert len(cues[0]["words"]) == 4
        assert cues[0]["words"][0]["word"] == "Why"
        assert cues[0]["words"][0]["start"] == 2.0

    def test_parse_transcript_auto_detect(self):
        json_str = '{"events": [{"tStartMs": 1000, "dDurationMs": 2000, "segs": [{"utf8": "Hello world"}]}]}'
        cues_json = parse_transcript(json_str)
        assert len(cues_json) == 1
        assert cues_json[0]["text"] == "Hello world"

        vtt_str = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello VTT world\n"
        cues_vtt = parse_transcript(vtt_str)
        assert len(cues_vtt) == 1
        assert "Hello VTT" in cues_vtt[0]["text"]

    def test_group_words_into_sentences(self):
        cues = [
            {
                "start": 0.0,
                "end": 2.0,
                "text": "First sentence here.",
                "words": [
                    {"word": "First", "start": 0.0, "end": 0.5},
                    {"word": "sentence", "start": 0.5, "end": 1.2},
                    {"word": "here.", "start": 1.2, "end": 2.0},
                ],
            },
            {
                "start": 2.5,
                "end": 4.5,
                "text": "Second sentence follows!",
                "words": [
                    {"word": "Second", "start": 2.5, "end": 3.0},
                    {"word": "sentence", "start": 3.0, "end": 3.8},
                    {"word": "follows!", "start": 3.8, "end": 4.5},
                ],
            },
        ]
        sentences = group_words_into_sentences(cues)
        assert len(sentences) == 2
        assert sentences[0]["text"] == "First sentence here."
        assert sentences[1]["text"] == "Second sentence follows!"

    def test_analyze_and_score_clips_breakdown_metrics(self):
        cues = [
            {"start": 5.0, "end": 9.0, "text": "Why does nobody talk about this insane trick?"},
            {"start": 9.0, "end": 22.0, "text": "It completely revolutionizes everything you do online."},
            {"start": 22.0, "end": 35.0, "text": "Wait till you see the final result in action."},
        ]
        clips = analyze_and_score_clips(cues, total_duration=60.0, video_title="Viral Tricks", max_clips=2)
        assert len(clips) > 0
        c = clips[0]
        assert c.hook_score is not None and c.hook_score >= 0
        assert c.pacing_score is not None and c.pacing_score >= 0
        assert c.audio_energy_score is not None and c.audio_energy_score >= 0
        assert c.visual_motion_score is not None and c.visual_motion_score >= 0
        assert c.loop_rating in ("Seamless Loop", "High Loopability", "Standard")
        assert c.speaker_tracking_applied is True


# ---------------------------------------------------------------------------
# Unit tests: Clip Renderer
# ---------------------------------------------------------------------------


class TestClipRenderer:

    def test_require_ffmpeg_found(self):
        with patch("app.clip_renderer.FFMPEG_PATH", "/usr/bin/ffmpeg"):
            assert _require_ffmpeg() == "/usr/bin/ffmpeg"

    def test_require_ffmpeg_missing(self):
        with patch("app.clip_renderer.FFMPEG_PATH", None), patch("shutil.which", return_value=None):
            with pytest.raises(ClipRenderException) as exc:
                _require_ffmpeg()
            assert exc.value.error_type == "missing_dependency"

    def test_sanitize_drawtext_string(self):
        raw = "DON'T MISS THIS: 100% CRAZY!"
        sanitized = sanitize_drawtext_string(raw)
        assert "'" not in sanitized
        assert ":" not in sanitized
        assert "%%" in sanitized

    def test_build_video_filtergraph_all_layouts(self):
        for layout in ["blurred_background", "center_crop", "fit_black"]:
            fg = build_video_filtergraph(layout, hook_title="VIRAL MOMENT 🔥", hook_style="yellow_box")
            assert "1080" in fg
            assert "1920" in fg
            assert "drawtext" in fg

    def test_build_video_filtergraph_no_hook(self):
        # Without hook title and without progress bar -> null[v]
        fg_clean = build_video_filtergraph("blurred_background", hook_title=None, progress_bar=False)
        assert "drawtext" not in fg_clean
        assert "null[v]" in fg_clean

        # Without hook title but with kinetic progress bar -> drawbox in fg
        fg_with_pb = build_video_filtergraph("blurred_background", hook_title=None, progress_bar=True)
        assert "drawtext" not in fg_with_pb
        assert "drawbox" in fg_with_pb

    def test_render_viral_clip_invalid_range(self):
        with patch("app.clip_renderer._require_ffmpeg", return_value="/usr/bin/ffmpeg"):
            with pytest.raises(ClipRenderException) as exc:
                render_viral_clip("/tmp/in.mp4", "/tmp/out.mp4", start_time=50.0, end_time=40.0)
            assert exc.value.error_type == "invalid_time_range"

    def test_render_viral_clip_duration_too_long(self):
        with patch("app.clip_renderer._require_ffmpeg", return_value="/usr/bin/ffmpeg"):
            with pytest.raises(ClipRenderException) as exc:
                render_viral_clip("/tmp/in.mp4", "/tmp/out.mp4", start_time=0.0, end_time=350.0)
            assert exc.value.error_type == "duration_too_long"

    @patch("app.clip_renderer._require_ffmpeg", return_value="/usr/bin/ffmpeg")
    @patch("subprocess.Popen")
    def test_render_viral_clip_success(self, mock_popen, mock_ffmpeg, tmp_path):
        out_file = tmp_path / "clip.mp4"
        out_file.write_bytes(b"dummy rendered mp4 video")

        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.communicate.return_value = ("", "")
        mock_popen.return_value = mock_proc

        res = render_viral_clip(
            input_path="/tmp/input.mp4",
            output_path=str(out_file),
            start_time=10.0,
            end_time=40.0,
            layout="blurred_background",
            hook_title="AMAZING MOMENT 🔥",
            background_music="lofi_chill",
        )
        assert res["filename"] == "clip.mp4"
        assert res["duration"] == 30.0
        assert res["filesize"] > 0
        mock_popen.assert_called()

    def test_build_video_filtergraph_anti_copyright(self):
        fg = build_video_filtergraph(
            layout="center_crop",
            hook_title="TEST",
            anti_copyright_shield=True,
        )
        assert "eq=contrast=" in fg

    @patch("subprocess.Popen")
    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    def test_render_viral_clip_anti_copyright_and_mute(self, mock_which, mock_popen, tmp_path):
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.communicate.return_value = ("", "")
        mock_popen.return_value = mock_proc

        out_file = tmp_path / "clip_shield.mp4"
        out_file.write_bytes(b"dummy mp4 data")

        res = render_viral_clip(
            input_path="/tmp/input.mp4",
            output_path=str(out_file),
            start_time=0.0,
            end_time=20.0,
            anti_copyright_shield=True,
            mute_original_audio=True,
            background_music="lofi_chill",
        )
        assert res["duration"] == 20.0
        cmd_args = " ".join(mock_popen.call_args[0][0])
        assert "[1:a]volume=1.0" in cmd_args
        assert "loudnorm=I=-14:TP=-1.5:LRA=11" in cmd_args

    def test_generate_ass_subtitles_kinetic_karaoke(self, tmp_path):
        cues = [
            {
                "start": 1.0,
                "end": 4.0,
                "text": "Check this insane trick",
                "words": [
                    {"word": "Check", "start": 1.0, "end": 1.5},
                    {"word": "this", "start": 1.5, "end": 2.0},
                    {"word": "insane", "start": 2.0, "end": 2.8},
                    {"word": "trick", "start": 2.8, "end": 3.8},
                ],
            }
        ]
        sub_file = tmp_path / "test.ass"
        ok = generate_ass_subtitles(cues, start_time=0.0, end_time=5.0, output_path=str(sub_file))
        assert ok is True
        content = sub_file.read_text()
        assert "[Script Info]" in content
        assert "ViralKaraoke" in content
        assert "MarginV" in content
        assert "\\kf" in content
        assert "&H0000E6FF&" in content or "&H0000FFFF&" in content
        assert "\\fscx112\\fscy112" in content

    def test_build_video_filtergraph_two_speaker_split(self):
        ft_data = {
            "mode": "two_speaker_split",
            "left_x_expr": "120",
            "right_x_expr": "850",
            "speaker_tracking_applied": True,
        }
        fg = build_video_filtergraph("center_crop", face_tracking_data=ft_data)
        assert "vstack=inputs=2" in fg
        assert "1080:960" in fg
        assert "120" in fg
        assert "850" in fg

    @patch("subprocess.Popen")
    @patch("shutil.which", return_value="/usr/bin/ffmpeg")
    @patch("os.path.exists", return_value=True)
    def test_detect_and_trim_loop_silence(self, mock_exists, mock_which, mock_popen):
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.communicate.return_value = (
            "",
            "[silencedetect @ 0x123] silence_start: 2.5\n[silencedetect @ 0x123] silence_end: 4.0",
        )
        mock_popen.return_value = mock_proc

        trimmed_end = detect_and_trim_loop_silence("/fake/video.mp4", start_time=0.0, end_time=25.0)
        # Probe start is 25 - 4 = 21. Silence start 2.5 -> 21 + 2.5 = 23.5
        assert trimmed_end == 23.5



# ---------------------------------------------------------------------------
# API tests: Viral Clips
# ---------------------------------------------------------------------------


class TestClipAPI:

    @pytest.fixture(autouse=True)
    def reset_rate_limit(self):
        from app.main import rate_limits
        from app.cache import clear_all_caches
        rate_limits.clear()
        clear_all_caches()
        yield
        rate_limits.clear()
        clear_all_caches()

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    def test_get_clip_presets(self, client):
        resp = client.get("/api/clips/presets")
        assert resp.status_code == 200
        data = resp.json()
        assert "layouts" in data
        assert "music_presets" in data
        assert "hook_styles" in data
        layout_ids = [l["id"] for l in data["layouts"]]
        assert "blurred_background" in layout_ids
        music_ids = [m["id"] for m in data["music_presets"]]
        assert "lofi_chill" in music_ids

    @patch("app.main.extract_metadata")
    def test_analyze_viral_clips_success(self, mock_meta, client):
        mock_meta.return_value = VideoMetadata(
            id="test_vid_123",
            platform="youtube",
            title="How to Build High-Performance AI Apps",
            creator="Tech Creator",
            duration=300,
            thumbnail="https://example.com/thumb.jpg",
            formats=[],
            downloads_available=True,
        )

        resp = client.post(
            "/api/clips/analyze",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "max_clips": 3},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["video_id"] == "test_vid_123"
        assert len(data["clips"]) <= 3
        assert data["clips"][0]["viral_score"] >= 0
        assert "hook_title" in data["clips"][0]

    def test_analyze_viral_clips_empty_url(self, client):
        resp = client.post("/api/clips/analyze", json={"url": "   "})
        assert resp.status_code == 400

    @patch("app.main.process_clip_render")
    def test_render_viral_clip_endpoint(self, mock_render, client, tmp_path):
        mock_render.return_value = {
            "filename": "viral_clip_1.mp4",
            "filesize": 4096000,
            "duration": 30.0,
            "download_url": "/api/file/viral_clip_1.mp4",
            "layout": "blurred_background",
            "hook_title": "THE SECRET REVEALED 🔥",
        }

        # Mock an existing file in DOWNLOAD_DIR
        from app.config import DOWNLOAD_DIR
        dummy_file = DOWNLOAD_DIR / "local_test_video.mp4"
        dummy_file.write_bytes(b"dummy video")

        try:
            resp = client.post(
                "/api/clips/render",
                json={
                    "url": "local_test_video.mp4",
                    "start_time": 10.0,
                    "end_time": 40.0,
                    "layout": "blurred_background",
                    "hook_title": "THE SECRET REVEALED 🔥",
                    "background_music": "lofi_chill",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["filename"] == "viral_clip_1.mp4"
            assert data["duration"] == 30.0
            assert data["download_url"] == "/api/file/viral_clip_1.mp4"
        finally:
            if dummy_file.exists():
                dummy_file.unlink(missing_ok=True)

    @patch("app.main.generate_ai_hook")
    def test_ai_hook_endpoint_fallback(self, mock_ai_hook, client):
        mock_ai_hook.return_value = {
            "transcript": "Transcript of the clip.",
            "hook_title": "The Secrets of Startup Success",
            "source": "local_heuristic",
        }
        resp = client.post(
            "/api/clips/ai-hook",
            json={
                "url": "local_video.mp4",
                "start_time": 10.0,
                "end_time": 40.0,
                "video_title": "The Secrets of Startup Success",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["hook_title"] == "The Secrets of Startup Success"
        assert "transcript" in data
        assert "source" in data

    @patch("app.ai_hook.generate_hook_from_free_open_llm")
    def test_generate_ai_hook_with_free_open_llm(self, mock_free_llm):
        from app.ai_hook import generate_ai_hook
        mock_free_llm.return_value = "Brutal Startup Lessons"

        res = generate_ai_hook(
            video_path="",
            start_time=10.0,
            end_time=40.0,
            video_title="Startup Advice",
            clip_dialogue="Here is why 90 percent of companies fail.",
            provider="free_open_llm",
        )
        assert res["hook_title"] == "Brutal Startup Lessons"
        assert res["source"] == "free_open_llm"

    def test_generate_ai_hook_with_local_nlp(self):
        from app.ai_hook import generate_ai_hook

        res = generate_ai_hook(
            video_path="",
            start_time=10.0,
            end_time=40.0,
            video_title="Secret Startup Strategies",
            clip_dialogue="Why do people never talk about this secret rule?",
            provider="local_nlp",
        )
        assert len(res["hook_title"]) > 0
        assert res["source"] in ("free_open_llm", "local_nlp")
