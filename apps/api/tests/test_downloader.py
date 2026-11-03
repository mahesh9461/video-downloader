import asyncio
import os
import pytest
from unittest.mock import patch, MagicMock
import yt_dlp

from app.downloader import (
    detect_platform,
    map_ytdlp_error,
    format_bytes,
    format_seconds,
    safe_int,
    sanitize_filename,
    extract_youtube_id,
    extract_metadata,
    fetch_youtube_innertube,
    download_youtube_innertube_stream,
    download_via_cobalt,
    download_video_stream,
    is_youtube_cooldown_active,
    trigger_youtube_cooldown,
    reset_youtube_cooldown,
    get_base_ydl_opts,
    YOUTUBE_CLIENT_PROFILES,
    DownloadException,
)
from app.schemas import VideoMetadata


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


def test_detect_platform_instagram():
    urls = [
        "https://www.instagram.com/reel/C3bXYZ123/",
        "https://instagram.com/reels/C3bXYZ123/",
        "https://www.instagram.com/p/C3bXYZ123/",
        "https://www.instagram.com/tv/C3bXYZ123/",
        "https://www.instagram.com/share/reel/C3bXYZ123/",
    ]
    for url in urls:
        assert detect_platform(url) == "instagram"


def test_detect_platform_invalid():
    with pytest.raises(DownloadException) as exc:
        detect_platform("https://vimeo.com/123456")
    assert exc.value.error_type == "invalid_url"


def test_map_ytdlp_error_categories():
    # Bot check & Player response extraction failure
    err_bot = map_ytdlp_error("ERROR: [youtube] Sign in to confirm you're not a bot. This helps protect our community.")
    assert err_bot.error_type == "bot_check"
    assert err_bot.status_code == 503
    assert "YouTube is blocking this server right now" in err_bot.detail

    err_player = map_ytdlp_error("ERROR: [youtube] d-hhix_uHUY: Failed to extract any player response; please report this issue")
    assert err_player.error_type == "bot_check"
    assert err_player.status_code == 503

    # Private
    err_private = map_ytdlp_error("Private video. Sign in if you've been granted access to this video")
    assert err_private.error_type == "private"
    assert err_private.status_code == 403

    # Geo restricted
    err_geo = map_ytdlp_error("This video is not available in your country")
    assert err_geo.error_type == "geo_restricted"
    assert err_geo.status_code == 403

    # Deleted / 404
    err_deleted = map_ytdlp_error("Video unavailable. This video has been removed by the user")
    assert err_deleted.error_type == "deleted"
    assert err_deleted.status_code == 404

    # Rate limit (429)
    err_rate = map_ytdlp_error("HTTP Error 429: Too Many Requests")
    assert err_rate.error_type == "rate_limit"
    assert err_rate.status_code == 429

    # Unknown
    err_unknown = map_ytdlp_error("Something weird went wrong on the transport layer")
    assert err_unknown.error_type == "unknown"
    assert err_unknown.status_code == 400


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


def test_safe_int():
    assert safe_int(None) is None
    assert safe_int(None, default=0) == 0
    assert safe_int(42) == 42
    assert safe_int("128") == 128
    assert safe_int(" 256 ") == 256
    assert safe_int("not_a_number", default=10) == 10
    assert safe_int([], default=5) == 5


def test_extract_youtube_id():
    assert extract_youtube_id("https://www.youtube.com/watch?v=BOJw7TYH-fE") == "BOJw7TYH-fE"
    assert extract_youtube_id("https://youtu.be/BOJw7TYH-fE") == "BOJw7TYH-fE"
    assert extract_youtube_id("https://www.youtube.com/shorts/BOJw7TYH-fE") == "BOJw7TYH-fE"
    assert extract_youtube_id("https://tiktok.com/@user/video/123") is None


def test_sanitize_filename():
    assert sanitize_filename("Video? With / Invalid : Chars *") == "Video With  Invalid  Chars"
    assert sanitize_filename("") == "video"


@patch("app.downloader.yt_dlp.YoutubeDL")
def test_extract_metadata_success_path(mock_ydl_class):
    mock_ydl = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl
    mock_ydl.extract_info.return_value = {
        "id": "BOJw7TYH-fE",
        "title": "Clean YouTube Video",
        "uploader": "Test Creator",
        "duration": 120,
        "thumbnail": "https://example.com/thumb.jpg",
        "formats": [
            {"height": 1080, "vcodec": "avc1", "ext": "mp4"},
            {"height": 720, "vcodec": "avc1", "ext": "mp4"},
            {"vcodec": "none", "acodec": "mp4a", "ext": "m4a"},
        ],
    }

    meta = extract_metadata("https://www.youtube.com/watch?v=BOJw7TYH-fE")
    assert meta.id == "BOJw7TYH-fE"
    assert meta.title == "Clean YouTube Video"
    assert meta.downloads_available is True
    assert meta.notice is None
    assert len(meta.formats) > 0


@patch("app.downloader.yt_dlp.YoutubeDL")
def test_extract_metadata_instagram_success(mock_ydl_class):
    mock_ydl = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl
    mock_ydl.extract_info.return_value = {
        "id": "C3bXYZ123",
        "title": "Amazing Instagram Reel",
        "uploader": "insta_creator",
        "duration": 30,
        "thumbnail": "https://example.com/ig_thumb.jpg",
        "formats": [
            {"format_id": "0", "ext": "mp4", "width": 1080, "height": 1920},
        ],
    }

    meta = extract_metadata("https://www.instagram.com/reel/C3bXYZ123/")
    assert meta.id == "C3bXYZ123"
    assert meta.platform == "instagram"
    assert meta.title == "Amazing Instagram Reel"
    assert meta.creator == "insta_creator"
    assert len(meta.formats) == 2
    format_ids = [f.format_id for f in meta.formats]
    assert "instagram-video" in format_ids
    assert "instagram-audio" in format_ids


@patch("app.downloader.fetch_youtube_oembed")
@patch("app.downloader.yt_dlp.YoutubeDL")
def test_extract_metadata_bot_block_oembed_fallback(mock_ydl_class, mock_oembed):
    mock_ydl = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl
    mock_ydl.extract_info.side_effect = yt_dlp.utils.DownloadError("Sign in to confirm you're not a bot.")

    mock_oembed.return_value = VideoMetadata(
        id="BOJw7TYH-fE",
        platform="youtube",
        title="Test oEmbed Video",
        creator="Channel",
        creator_avatar=None,
        duration=0,
        thumbnail="https://example.com/thumb.jpg",
        formats=[],
        downloads_available=False,
        notice="Preview only: downloads are temporarily unavailable for this video.",
    )

    metadata = extract_metadata("https://www.youtube.com/watch?v=BOJw7TYH-fE")
    assert metadata.title == "Test oEmbed Video"
    assert metadata.downloads_available is False
    assert metadata.formats == []
    assert "Preview only" in metadata.notice
    assert is_youtube_cooldown_active()


@patch("app.downloader.fetch_youtube_oembed")
@patch("app.downloader.yt_dlp.YoutubeDL")
def test_extract_metadata_bot_block_and_oembed_failure(mock_ydl_class, mock_oembed):
    mock_ydl = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl
    mock_ydl.extract_info.side_effect = yt_dlp.utils.DownloadError("Sign in to confirm you're not a bot.")
    mock_oembed.return_value = None

    with pytest.raises(DownloadException) as exc:
        extract_metadata("https://www.youtube.com/watch?v=BOJw7TYH-fE")

    assert exc.value.error_type == "bot_check"
    assert exc.value.status_code == 503


@patch("app.downloader.fetch_youtube_oembed")
@patch("app.downloader.yt_dlp.YoutubeDL")
def test_cooldown_skips_ytdlp(mock_ydl_class, mock_oembed):
    mock_ydl = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl
    mock_ydl.extract_info.side_effect = yt_dlp.utils.DownloadError("Sign in to confirm you're not a bot.")

    mock_oembed.return_value = VideoMetadata(
        id="BOJw7TYH-fE",
        platform="youtube",
        title="Cooldown Video",
        creator="Channel",
        duration=0,
        thumbnail="",
        formats=[],
        downloads_available=False,
        notice="Preview only",
    )

    # First call: hits yt-dlp across all client profiles before triggering cooldown
    extract_metadata("https://www.youtube.com/watch?v=BOJw7TYH-fE")
    first_call_count = mock_ydl.extract_info.call_count
    assert first_call_count == len(YOUTUBE_CLIENT_PROFILES)  # Retried all profiles before cooldown
    assert is_youtube_cooldown_active()

    # Second call: skips yt-dlp entirely!
    extract_metadata("https://www.youtube.com/watch?v=BOJw7TYH-fE")
    assert mock_ydl.extract_info.call_count == first_call_count  # Did NOT call yt_dlp again


@patch("app.downloader.yt_dlp.YoutubeDL")
def test_profile_fallback_succeeds_on_second_profile(mock_ydl_class):
    mock_ydl = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl
    # First profile hits bot check, second profile succeeds
    mock_ydl.extract_info.side_effect = [
        yt_dlp.utils.DownloadError("Sign in to confirm you're not a bot."),
        {
            "id": "BOJw7TYH-fE",
            "title": "Fallback Video",
            "uploader": "Channel",
            "duration": 60,
            "thumbnail": "https://example.com/thumb.jpg",
            "formats": [{"height": 720, "vcodec": "avc1", "ext": "mp4"}],
        },
    ]

    metadata = extract_metadata("https://www.youtube.com/watch?v=BOJw7TYH-fE")
    assert metadata.title == "Fallback Video"
    assert metadata.downloads_available is True
    assert mock_ydl.extract_info.call_count == 2
    # Cooldown should NOT have been activated since profile 2 succeeded
    assert not is_youtube_cooldown_active()


def test_get_base_ydl_opts_proxy_and_cookies():
    with patch.dict(
        os.environ,
        {
            "PROXY_URL": "http://user:pass@proxy.example.com:8080",
            "YOUTUBE_COOKIES_FILE": "/nonexistent/test_cookies.txt",
        },
        clear=False,
    ):
        opts = get_base_ydl_opts("youtube")
        assert opts.get("proxy") == "http://user:pass@proxy.example.com:8080"
        assert opts.get("quiet") is True


@patch("app.downloader.httpx.Client")
def test_fetch_youtube_innertube_success(mock_client_cls):
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "playabilityStatus": {"status": "OK"},
        "videoDetails": {
            "title": "Five Little Ducks",
            "author": "Rhyme Channel",
            "lengthSeconds": "150",
            "thumbnail": {"thumbnails": [{"url": "https://example.com/thumb.jpg"}]},
        },
        "streamingData": {
            "formats": [
                {
                    "itag": 22,
                    "qualityLabel": "720p",
                    "url": "https://rr.googlevideo.com/videoplayback?itag=22",
                    "contentLength": "15000000",
                    "mimeType": "video/mp4; codecs=avc1",
                }
            ],
            "adaptiveFormats": [
                {
                    "itag": 140,
                    "mimeType": "audio/mp4; codecs=mp4a",
                    "url": "https://rr.googlevideo.com/videoplayback?itag=140",
                    "contentLength": "2000000",
                    "bitrate": 128000,
                }
            ],
        },
    }
    mock_client.post.return_value = mock_resp

    meta = fetch_youtube_innertube("d-hhix_uHUY")
    assert meta is not None
    assert meta.id == "d-hhix_uHUY"
    assert meta.title == "Five Little Ducks"
    assert meta.downloads_available is True
    assert len(meta.formats) == 2
    f_ids = [f.format_id for f in meta.formats]
    assert "yt-720p" in f_ids
    assert "yt-audio-mp3" in f_ids


@patch("app.downloader.httpx.Client")
def test_download_youtube_innertube_stream_success(mock_client_cls, tmp_path):
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client

    # Mock metadata call
    mock_meta_resp = MagicMock()
    mock_meta_resp.status_code = 200
    mock_meta_resp.json.return_value = {
        "playabilityStatus": {"status": "OK"},
        "videoDetails": {"title": "Direct Duck Video"},
        "streamingData": {
            "formats": [
                {
                    "itag": 22,
                    "qualityLabel": "720p",
                    "url": "https://rr.googlevideo.com/videoplayback?test=1",
                    "contentLength": "1024",
                }
            ]
        },
    }
    mock_client.post.return_value = mock_meta_resp

    # Mock stream response
    mock_stream_resp = MagicMock()
    mock_stream_resp.status_code = 200
    mock_stream_resp.headers = {"content-length": "1024"}
    mock_stream_resp.iter_bytes.return_value = [b"A" * 1024]
    mock_client.stream.return_value.__enter__.return_value = mock_stream_resp

    loop = asyncio.new_event_loop()
    queue = asyncio.Queue()

    res = download_youtube_innertube_stream("vid_direct_test", "yt-720p", "test_job_1", loop, queue)
    assert res is not None
    assert "Direct Duck Video" in res["filename"]
    assert res["filesize"] == 1024


def test_cobalt_not_called_when_unset():
    with patch.dict(os.environ, {"COBALT_API_URL": ""}, clear=False):
        loop = asyncio.new_event_loop()
        queue = asyncio.Queue()
        res = download_via_cobalt("https://youtube.com/watch?v=123", "yt-720p", "job1", "title", loop, queue)
        assert res is None


@patch("app.downloader.httpx.Client")
def test_cobalt_called_with_video_quality_and_auth(mock_client_cls):
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "tunnel",
        "url": "https://stream.example.com/video.mp4",
    }
    mock_client.post.return_value = mock_resp

    mock_stream_resp = MagicMock()
    mock_stream_resp.status_code = 200
    mock_stream_resp.headers = {"content-length": "100"}
    mock_stream_resp.iter_bytes.return_value = [b"A" * 100]
    mock_client.stream.return_value.__enter__.return_value = mock_stream_resp

    with patch.dict(os.environ, {"COBALT_API_URL": "https://custom-cobalt.example.com", "COBALT_API_KEY": "secret-key"}):
        loop = asyncio.new_event_loop()
        queue = asyncio.Queue()
        res = download_via_cobalt("https://youtube.com/watch?v=123", "yt-1080p", "job1", "Test Title", loop, queue)

        assert res is not None
        assert "Test Title" in res["filename"]
        # Verify post payload and headers
        call_args = mock_client.post.call_args
        assert call_args[0][0] == "https://custom-cobalt.example.com/"
        payload = call_args[1]["json"]
        assert payload["videoQuality"] == "1080"
        assert payload["downloadMode"] == "auto"


@patch("app.downloader.httpx.Client")
def test_cobalt_error_response_handled_gracefully(mock_client_cls):
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client

    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = '{"status":"error","error":{"code":"error.api.auth.jwt.missing"}}'
    mock_client.post.return_value = mock_resp

    with patch.dict(os.environ, {"COBALT_API_URL": "https://custom-cobalt.example.com"}):
        loop = asyncio.new_event_loop()
        queue = asyncio.Queue()
        res = download_via_cobalt("https://youtube.com/watch?v=123", "yt-720p", "job1", "Test Title", loop, queue)
        assert res is None


@pytest.mark.anyio
@patch("app.downloader.yt_dlp.YoutubeDL")
async def test_run_download_none_info_emits_error(mock_ydl_class):
    mock_ydl = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl
    # yt-dlp returns None for info and creates no file
    mock_ydl.extract_info.return_value = None

    generator = download_video_stream("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "yt-720p")
    events = []
    async for item in generator:
        events.append(item)

    # Check that an error event was emitted, NEVER "complete"
    assert any('"status":"error"' in ev or '"status": "error"' in ev for ev in events)
    assert not any('"status":"complete"' in ev or '"status": "complete"' in ev for ev in events)


@pytest.mark.anyio
@patch("app.downloader.yt_dlp.YoutubeDL")
async def test_run_download_profile_fallback(mock_ydl_class, tmp_path):
    mock_ydl = MagicMock()
    mock_ydl_class.return_value.__enter__.return_value = mock_ydl

    # Setup dummy downloaded file
    fake_file = tmp_path / "job_test.mp4"
    fake_file.write_bytes(b"dummy video data")

    # First profile hits bot check, second profile succeeds
    mock_ydl.extract_info.side_effect = [
        yt_dlp.utils.DownloadError("Sign in to confirm you're not a bot."),
        {"id": "dQw4w9WgXcQ", "title": "Test Fallback Video"},
    ]
    mock_ydl.prepare_filename.return_value = str(fake_file)

    generator = download_video_stream("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "yt-720p")
    events = []
    async for item in generator:
        events.append(item)

    assert any('"status":"complete"' in ev or '"status": "complete"' in ev for ev in events)
    assert mock_ydl.extract_info.call_count == 2
    assert not is_youtube_cooldown_active()
