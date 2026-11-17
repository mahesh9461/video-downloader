import asyncio
import json
import os
import subprocess
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.watermark import (
    WatermarkException,
    PLATFORM_PRESETS,
    MAX_UPLOAD_BYTES,
    ALLOWED_EXTENSIONS,
    _require_ffmpeg,
    _validate_extension,
    _scale_regions,
    _build_delogo_filter,
    remove_watermark,
    process_watermark_removal,
    auto_detect_watermark_regions,
)


# ---------------------------------------------------------------------------
# Unit tests: helpers
# ---------------------------------------------------------------------------


class TestRequireFFmpeg:
    """Verify that _require_ffmpeg raises when FFmpeg is missing."""

    def test_ffmpeg_found(self):
        with patch("app.watermark.FFMPEG_PATH", "/usr/bin/ffmpeg"):
            assert _require_ffmpeg() == "/usr/bin/ffmpeg"

    def test_ffmpeg_not_found_raises(self):
        with patch("app.watermark.FFMPEG_PATH", None), patch("shutil.which", return_value=None):
            with pytest.raises(WatermarkException) as exc:
                _require_ffmpeg()
            assert exc.value.error_type == "missing_dependency"
            assert exc.value.status_code == 503


class TestValidateExtension:
    """Verify extension validation."""

    def test_valid_extensions(self):
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            _validate_extension(f"video{ext}")  # Should not raise

    def test_invalid_extension(self):
        with pytest.raises(WatermarkException) as exc:
            _validate_extension("document.pdf")
        assert exc.value.error_type == "invalid_file"

    def test_case_insensitive(self):
        _validate_extension("video.MP4")  # Should not raise


class TestScaleRegions:
    """Verify region scaling from reference to actual dimensions."""

    def test_no_scaling_same_dims(self):
        regions = [{"x": 100, "y": 200, "w": 50, "h": 30}]
        result = _scale_regions(regions, 1080, 1920, 1080, 1920)
        assert result[0]["x"] == 100
        assert result[0]["y"] == 200

    def test_scaling_half_resolution(self):
        regions = [{"x": 100, "y": 200, "w": 50, "h": 30, "label": "test"}]
        result = _scale_regions(regions, 1080, 1920, 540, 960)
        assert result[0]["x"] == 50
        assert result[0]["y"] == 100
        assert result[0]["w"] == 25
        assert result[0]["h"] == 15
        assert result[0]["label"] == "test"

    def test_scaling_double_resolution(self):
        regions = [{"x": 100, "y": 200, "w": 50, "h": 30}]
        result = _scale_regions(regions, 1080, 1920, 2160, 3840)
        assert result[0]["x"] == 200
        assert result[0]["y"] == 400


class TestBuildDelogoFilter:
    """Verify FFmpeg delogo filter string generation."""

    def test_single_region(self):
        regions = [{"x": 10, "y": 20, "w": 100, "h": 50}]
        result = _build_delogo_filter(regions)
        assert result == "delogo=x=10:y=20:w=100:h=50:band=4"

    def test_multiple_regions(self):
        regions = [
            {"x": 10, "y": 20, "w": 100, "h": 50},
            {"x": 800, "y": 1700, "w": 200, "h": 120},
        ]
        result = _build_delogo_filter(regions)
        assert "," in result
        assert result.count("delogo=") == 2

    def test_custom_band(self):
        regions = [{"x": 10, "y": 20, "w": 100, "h": 50}]
        result = _build_delogo_filter(regions, band=10)
        assert "band=10" in result


# ---------------------------------------------------------------------------
# Unit tests: platform presets
# ---------------------------------------------------------------------------


class TestPlatformPresets:
    """Verify platform preset data integrity."""

    def test_tiktok_preset_exists(self):
        assert "tiktok" in PLATFORM_PRESETS

    def test_tiktok_has_regions(self):
        preset = PLATFORM_PRESETS["tiktok"]
        assert len(preset["regions"]) >= 2
        assert preset["reference_width"] == 1080
        assert preset["reference_height"] == 1920

    def test_all_presets_have_required_fields(self):
        for name, preset in PLATFORM_PRESETS.items():
            assert "label" in preset, f"Preset '{name}' missing 'label'"
            assert "description" in preset, f"Preset '{name}' missing 'description'"
            assert "regions" in preset, f"Preset '{name}' missing 'regions'"
            assert "reference_width" in preset, f"Preset '{name}' missing 'reference_width'"
            assert "reference_height" in preset, f"Preset '{name}' missing 'reference_height'"
            for r in preset["regions"]:
                assert all(k in r for k in ("x", "y", "w", "h")), f"Region in '{name}' missing coordinates"


# ---------------------------------------------------------------------------
# Unit tests: core remove_watermark function
# ---------------------------------------------------------------------------


class TestRemoveWatermark:
    """Verify the FFmpeg-based watermark removal."""

    def test_no_regions_raises(self):
        with pytest.raises(WatermarkException) as exc:
            remove_watermark("/tmp/input.mp4", "/tmp/output.mp4", [])
        assert exc.value.error_type == "no_regions"

    @patch("app.watermark.FFMPEG_PATH", "/usr/bin/ffmpeg")
    @patch("subprocess.run")
    def test_successful_removal(self, mock_subprocess_run, tmp_path):
        input_file = tmp_path / "input.mp4"
        output_file = tmp_path / "output.mp4"
        input_file.write_bytes(b"fake video data")
        output_file.write_bytes(b"processed video data with watermark removed")

        mock_subprocess_run.return_value = MagicMock(returncode=0, stderr="")

        regions = [{"x": 10, "y": 20, "w": 100, "h": 50}]
        result = remove_watermark(str(input_file), str(output_file), regions)

        assert result["filename"] == "output.mp4"
        assert result["filesize"] > 0
        mock_subprocess_run.assert_called_once()

        # Verify FFmpeg was called with delogo filter
        cmd_args = mock_subprocess_run.call_args[0][0]
        vf_idx = cmd_args.index("-vf")
        assert "delogo=" in cmd_args[vf_idx + 1]

    @patch("app.watermark.FFMPEG_PATH", "/usr/bin/ffmpeg")
    @patch("subprocess.run")
    def test_ffmpeg_failure_raises(self, mock_subprocess_run, tmp_path):
        input_file = tmp_path / "input.mp4"
        input_file.write_bytes(b"fake video data")

        mock_subprocess_run.return_value = MagicMock(
            returncode=1,
            stderr="Error: invalid filter",
        )

        regions = [{"x": 10, "y": 20, "w": 100, "h": 50}]
        with pytest.raises(WatermarkException) as exc:
            remove_watermark(str(input_file), str(tmp_path / "out.mp4"), regions)
        assert exc.value.error_type == "ffmpeg_error"

    @patch("app.watermark.FFMPEG_PATH", "/usr/bin/ffmpeg")
    @patch("subprocess.run")
    def test_timeout_raises(self, mock_subprocess_run, tmp_path):
        input_file = tmp_path / "input.mp4"
        input_file.write_bytes(b"fake video data")

        mock_subprocess_run.side_effect = subprocess.TimeoutExpired(cmd="ffmpeg", timeout=300)

        regions = [{"x": 10, "y": 20, "w": 100, "h": 50}]
        with pytest.raises(WatermarkException) as exc:
            remove_watermark(str(input_file), str(tmp_path / "out.mp4"), regions)
        assert exc.value.error_type == "timeout"
        assert exc.value.status_code == 408


# ---------------------------------------------------------------------------
# Integration tests: process_watermark_removal
# ---------------------------------------------------------------------------


class TestProcessWatermarkRemoval:

    @pytest.mark.anyio
    @patch("app.watermark._require_ffmpeg", return_value="/usr/bin/ffmpeg")
    @patch("app.watermark._probe_dimensions", return_value=(1080, 1920))
    @patch("app.watermark.remove_watermark")
    async def test_preset_mode_tiktok(self, mock_remove, mock_probe, mock_ffmpeg, tmp_path):
        input_file = tmp_path / "tiktok_video.mp4"
        input_file.write_bytes(b"fake tiktok video")

        mock_remove.return_value = {"filename": "clean_tiktok.mp4", "filesize": 5000}

        result = await process_watermark_removal(
            input_path=str(input_file),
            original_filename="tiktok_video.mp4",
            mode="preset",
            platform="tiktok",
        )

        assert result["filename"] == "clean_tiktok.mp4"
        mock_remove.assert_called_once()
        # Should have passed TikTok's preset regions
        call_regions = mock_remove.call_args[1].get("regions") or mock_remove.call_args[0][2]
        assert len(call_regions) >= 2  # TikTok has at least 2 watermark regions

    @pytest.mark.anyio
    @patch("app.watermark._require_ffmpeg", return_value="/usr/bin/ffmpeg")
    @patch("app.watermark._probe_dimensions", return_value=(1920, 1080))
    @patch("app.watermark.remove_watermark")
    async def test_manual_mode(self, mock_remove, mock_probe, mock_ffmpeg, tmp_path):
        input_file = tmp_path / "custom_video.mp4"
        input_file.write_bytes(b"fake custom video")

        mock_remove.return_value = {"filename": "clean_custom.mp4", "filesize": 3000}

        regions = [{"x": 100, "y": 50, "w": 200, "h": 60}]
        result = await process_watermark_removal(
            input_path=str(input_file),
            original_filename="custom_video.mp4",
            mode="manual",
            regions=regions,
        )

        assert result["filename"] == "clean_custom.mp4"

    @pytest.mark.anyio
    async def test_invalid_preset_raises(self, tmp_path):
        input_file = tmp_path / "video.mp4"
        input_file.write_bytes(b"data")

        with pytest.raises(WatermarkException) as exc:
            await process_watermark_removal(
                input_path=str(input_file),
                original_filename="video.mp4",
                mode="preset",
                platform="nonexistent_platform",
            )
        assert exc.value.error_type == "invalid_preset"

    @pytest.mark.anyio
    async def test_manual_no_regions_raises(self, tmp_path):
        input_file = tmp_path / "video.mp4"
        input_file.write_bytes(b"data")

        with pytest.raises(WatermarkException) as exc:
            await process_watermark_removal(
                input_path=str(input_file),
                original_filename="video.mp4",
                mode="manual",
                regions=None,
            )
        assert exc.value.error_type == "no_regions"

    @pytest.mark.anyio
    async def test_invalid_mode_raises(self, tmp_path):
        input_file = tmp_path / "video.mp4"
        input_file.write_bytes(b"data")

        with pytest.raises(WatermarkException) as exc:
            await process_watermark_removal(
                input_path=str(input_file),
                original_filename="video.mp4",
                mode="magic",
            )
        assert exc.value.error_type == "invalid_mode"

    @pytest.mark.anyio
    async def test_invalid_extension_raises(self, tmp_path):
        input_file = tmp_path / "document.pdf"
        input_file.write_bytes(b"data")

        with pytest.raises(WatermarkException) as exc:
            await process_watermark_removal(
                input_path=str(input_file),
                original_filename="document.pdf",
                mode="auto",
            )
        assert exc.value.error_type == "invalid_file"

    @pytest.mark.anyio
    @patch("app.watermark._require_ffmpeg", return_value="/usr/bin/ffmpeg")
    @patch("app.watermark._probe_dimensions", return_value=(1080, 1920))
    @patch("app.watermark.remove_watermark")
    async def test_manual_clamps_regions(self, mock_remove, mock_probe, mock_ffmpeg, tmp_path):
        """Verify that regions exceeding video bounds are clamped."""
        input_file = tmp_path / "video.mp4"
        input_file.write_bytes(b"data")

        mock_remove.return_value = {"filename": "out.mp4", "filesize": 1000}

        # Region that extends past the right edge
        regions = [{"x": 1000, "y": 1800, "w": 500, "h": 300}]
        await process_watermark_removal(
            input_path=str(input_file),
            original_filename="video.mp4",
            mode="manual",
            regions=regions,
        )

        call_regions = mock_remove.call_args[1].get("regions") or mock_remove.call_args[0][2]
        r = call_regions[0]
        # x + w should not exceed video width (1080)
        assert r["x"] + r["w"] <= 1080


# ---------------------------------------------------------------------------
# Unit tests: auto detection
# ---------------------------------------------------------------------------


class TestAutoDetectWatermark:
    """Verify auto-detection using synthetic sampled frames."""

    @patch("app.watermark._probe_dimensions", return_value=(1080, 1920))
    @patch("subprocess.run")
    def test_auto_detect_synthetic_static_watermark(self, mock_run, mock_probe):
        sample_w, sample_h = 160, 284
        num_frames = 10
        frame_size = sample_w * sample_h

        # Create 10 frames where a top-left corner box (16x16) is static white (255)
        # while the rest of the frame varies wildly between frames (video movement)
        frames_bytes = bytearray()
        for f in range(num_frames):
            frame = bytearray()
            for y in range(sample_h):
                for x in range(sample_w):
                    if x < 20 and y < 20:
                        frame.append(255)  # static watermark
                    else:
                        frame.append((f * 37 + x * 3 + y * 7) % 256)  # dynamic content
            frames_bytes.extend(frame)

        mock_run.return_value = MagicMock(returncode=0, stdout=bytes(frames_bytes), stderr="")

        regions = auto_detect_watermark_regions("/tmp/sample.mp4", "/usr/bin/ffmpeg", sample_count=10)
        assert len(regions) > 0
        top_left = regions[0]
        # Should detect region in the top-left corner
        assert top_left["x"] <= 50
        assert top_left["y"] <= 50

    @patch("app.watermark._probe_dimensions", return_value=(1080, 1920))
    @patch("subprocess.run")
    def test_auto_detect_ffmpeg_failure(self, mock_run, mock_probe):
        mock_run.return_value = MagicMock(returncode=1, stdout=b"", stderr="error")
        regions = auto_detect_watermark_regions("/tmp/sample.mp4", "/usr/bin/ffmpeg")
        assert regions == []


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


class TestWatermarkAPI:
    """Test watermark removal API endpoints."""

    @pytest.fixture(autouse=True)
    def reset_rate_limit(self):
        from app.main import rate_limits
        rate_limits.clear()
        yield
        rate_limits.clear()

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    def test_get_presets(self, client):
        resp = client.get("/api/watermark/presets")
        assert resp.status_code == 200
        data = resp.json()
        assert "presets" in data
        assert len(data["presets"]) > 0
        # Check TikTok preset
        tiktok = [p for p in data["presets"] if p["platform"] == "tiktok"]
        assert len(tiktok) == 1
        assert len(tiktok[0]["regions"]) >= 2

    @patch("app.main.process_watermark_removal")
    def test_upload_and_remove_preset(self, mock_process, client, tmp_path):
        mock_process.return_value = {
            "filename": "clean_video.mp4",
            "filesize": 5000,
        }

        fake_video = b"fake mp4 video content bytes"
        resp = client.post(
            "/api/watermark/remove",
            data={"mode": "preset", "platform": "tiktok"},
            files={"video": ("my_video.mp4", fake_video, "video/mp4")},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["filename"] == "clean_video.mp4"
        assert data["filesize"] == 5000
        assert "/api/file/" in data["download_url"]

    @patch("app.main.process_watermark_removal")
    def test_upload_and_remove_manual(self, mock_process, client):
        mock_process.return_value = {
            "filename": "clean_manual.mp4",
            "filesize": 3000,
        }

        regions = json.dumps([{"x": 100, "y": 50, "w": 200, "h": 60}])
        resp = client.post(
            "/api/watermark/remove",
            data={"mode": "manual", "regions_json": regions},
            files={"video": ("video.mp4", b"fake video", "video/mp4")},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["filename"] == "clean_manual.mp4"

    @patch("app.main.process_watermark_removal")
    def test_upload_auto_detect(self, mock_process, client):
        mock_process.return_value = {
            "filename": "clean_auto.mp4",
            "filesize": 4000,
            "detected_regions": [{"x": 800, "y": 50, "w": 200, "h": 60}],
        }

        resp = client.post(
            "/api/watermark/remove",
            data={"mode": "auto"},
            files={"video": ("video.mp4", b"fake video", "video/mp4")},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["detected_regions"] is not None
        assert len(data["detected_regions"]) == 1

    def test_unsupported_file_type(self, client):
        resp = client.post(
            "/api/watermark/remove",
            data={"mode": "auto"},
            files={"video": ("document.pdf", b"fake pdf", "application/pdf")},
        )
        assert resp.status_code == 400
        assert "invalid_file" in resp.json().get("error_type", "")

    def test_invalid_regions_json(self, client):
        resp = client.post(
            "/api/watermark/remove",
            data={"mode": "manual", "regions_json": "not valid json"},
            files={"video": ("video.mp4", b"fake video", "video/mp4")},
        )
        assert resp.status_code == 400
        assert "invalid_regions" in resp.json().get("error_type", "")
