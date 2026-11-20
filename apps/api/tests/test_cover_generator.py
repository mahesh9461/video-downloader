"""
Unit tests for Full HD viral cover generator.
"""

import subprocess
import shutil
from pathlib import Path
from app.config import FFMPEG_PATH
from app.cover_generator import (
    sanitize_cover_text,
    generate_viral_cover_image,
    get_available_cover_templates,
    attach_cover_intro_to_video,
)


def test_sanitize_cover_text():
    assert sanitize_cover_text("GTA 6 INSANE MOMENT 🔥") == "GTA 6 INSANE MOMENT"
    assert sanitize_cover_text("Title with 'quotes'") == "Title with quotes"
    long_text = sanitize_cover_text("Title with 'quotes' and colons: watch")
    assert "\n" in long_text
    assert "quotes" in long_text
    assert sanitize_cover_text("") == ""


def test_get_available_cover_templates():
    templates = get_available_cover_templates()
    assert len(templates) >= 3
    names = [t.name for t in templates]
    assert "gta6_cover_1.jpg" in names
    assert "gta6_cover_2.jpg" in names
    assert "gta6_cover_3.jpg" in names


def test_generate_viral_cover_image_synthetic(tmp_path):
    output_cover = tmp_path / "test_cover_synthetic.jpg"
    success = generate_viral_cover_image(
        video_path="",  # Test synthetic canvas fallback
        output_path=str(output_cover),
        hook_title="GTA 6 SECRET DETAIL",
        hook_style="hormozi_bold",
        badge_text="🔥 VIRAL SHORT",
        use_gta_template=False,
    )
    assert success is True
    assert output_cover.is_file()
    assert output_cover.stat().st_size > 1000


def test_generate_viral_cover_image_with_templates(tmp_path):
    templates = get_available_cover_templates()
    assert len(templates) > 0

    for i in range(min(3, len(templates))):
        out_cover = tmp_path / f"test_template_cover_{i}.jpg"
        success = generate_viral_cover_image(
            video_path="",
            output_path=str(out_cover),
            hook_title=f"INSANE GTA 6 CLOUD LEAK #{i + 1}",
            hook_style="hormozi_bold" if i % 2 == 0 else "mrbeast_urgency",
            badge_text="GTA 6 EXCLUSIVE",
            template_index=i,
            use_gta_template=True,
        )
        assert success is True
        assert out_cover.is_file()
        assert out_cover.stat().st_size > 10000


def test_attach_cover_intro_to_video(tmp_path):
    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg:
        import static_ffmpeg
        static_ffmpeg.add_paths()
        ffmpeg = shutil.which("ffmpeg")

    cover = tmp_path / "cover.jpg"
    video = tmp_path / "video.mp4"
    merged = tmp_path / "merged.mp4"

    # Create dummy 1080x1920 cover
    subprocess.run(
        [ffmpeg, "-y", "-f", "lavfi", "-i", "color=c=red:s=1080x1920:d=1", "-vframes", "1", str(cover)],
        check=True,
        capture_output=True,
    )
    # Create dummy 1-second 1080x1920 video with audio
    subprocess.run(
        [
            ffmpeg, "-y",
            "-f", "lavfi", "-i", "color=c=blue:s=1080x1920:d=1",
            "-f", "lavfi", "-i", "sine=f=440:d=1",
            "-c:v", "libx264", "-c:a", "aac",
            str(video),
        ],
        check=True,
        capture_output=True,
    )

    success = attach_cover_intro_to_video(
        video_path=str(video),
        cover_path=str(cover),
        output_path=str(merged),
        duration=0.35,
    )
    assert success is True
    assert merged.is_file()
    assert merged.stat().st_size > 10000
