import pytest
from app.downloader import (
    detect_platform,
    map_ytdlp_error,
    format_bytes,
    format_seconds,
    DownloadException,
)


def test_detect_platform_youtube():
    urls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]
    for url in urls:
        assert detect_platform(url) == "youtube"


def test_detect_platform_tiktok():
    urls = [
        "https://www.tiktok.com/@creator/video/1234567890123456789",
        "https://vm.tiktok.com/ZM1234567/",
        "https://vt.tiktok.com/ZS1234567/",
        "https://www.tiktok.com/t/ZT1234567/",
    ]
    for url in urls:
        assert detect_platform(url) == "tiktok"


def test_detect_platform_invalid():
    with pytest.raises(DownloadException) as exc:
        detect_platform("https://vimeo.com/123456")
    assert exc.value.error_type == "invalid_url"


def test_map_ytdlp_error_categories():
    err_private = map_ytdlp_error("Private video. Sign in if you've been granted access to this video")
    assert err_private.error_type == "private"
    assert err_private.status_code == 403

    err_geo = map_ytdlp_error("This video is not available in your country")
    assert err_geo.error_type == "geo_restricted"
    assert err_geo.status_code == 403

    err_deleted = map_ytdlp_error("Video unavailable. This video has been removed by the user")
    assert err_deleted.error_type == "deleted"
    assert err_deleted.status_code == 404

    err_rate = map_ytdlp_error("HTTP Error 429: Too Many Requests")
    assert err_rate.error_type == "rate_limit"
    assert err_rate.status_code == 429


def test_format_bytes():
    assert format_bytes(None) is None
    assert format_bytes(500) == "500.0 B"
    assert format_bytes(1024 * 1024 * 5) == "5.0 MB"
    assert format_bytes(1024 * 1024 * 1024 * 2) == "2.0 GB"


def test_format_seconds():
    assert format_seconds(None) is None
    assert format_seconds(45) == "00:45"
    assert format_seconds(125) == "02:05"
    assert format_seconds(3665) == "01:01:05"


def test_extract_youtube_id():
    from app.downloader import extract_youtube_id
    assert extract_youtube_id("https://www.youtube.com/watch?v=BOJw7TYH-fE") == "BOJw7TYH-fE"
    assert extract_youtube_id("https://youtu.be/BOJw7TYH-fE") == "BOJw7TYH-fE"
    assert extract_youtube_id("https://www.youtube.com/shorts/BOJw7TYH-fE") == "BOJw7TYH-fE"
    assert extract_youtube_id("https://tiktok.com/@user/video/123") is None


def test_sanitize_filename():
    from app.downloader import sanitize_filename
    assert sanitize_filename("Video? With / Invalid : Chars *") == "Video With  Invalid  Chars"
    assert sanitize_filename("") == "video"


from unittest.mock import patch, MagicMock

@patch("app.downloader.fetch_invidious_metadata")
@patch("app.downloader.yt_dlp.YoutubeDL")
def test_invidious_fallback_on_bot_block(mock_ydl_class, mock_invidious):
    from app.downloader import extract_metadata, VideoMetadata
    mock_ydl = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl
    # Simulate YouTube bot challenge block
    import yt_dlp
    mock_ydl.extract_info.side_effect = yt_dlp.utils.DownloadError("Sign in to confirm you're not a bot.")

    mock_invidious.return_value = VideoMetadata(
        id="BOJw7TYH-fE",
        platform="youtube",
        title="Test Invidious Video",
        creator="Channel",
        creator_avatar=None,
        duration=120,
        thumbnail="https://example.com/thumb.jpg",
        formats=[],
    )

    metadata = extract_metadata("https://www.youtube.com/watch?v=BOJw7TYH-fE")
    assert metadata.title == "Test Invidious Video"
    assert mock_invidious.called

