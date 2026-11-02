import pytest
from app.downloader import reset_youtube_cooldown


@pytest.fixture(autouse=True)
def clean_cooldown_state():
    reset_youtube_cooldown()
    yield
    reset_youtube_cooldown()

