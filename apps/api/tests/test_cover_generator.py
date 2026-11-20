"""
Unit tests for Full HD viral cover generator.
"""

from pathlib import Path
from app.cover_generator import (
    sanitize_cover_text,
    generate_viral_cover_image,
    get_available_cover_templates,
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
