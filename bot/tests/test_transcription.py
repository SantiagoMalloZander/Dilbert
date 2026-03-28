import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
BOT_DIR = Path(__file__).resolve().parents[1]
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

import transcription


class FakeTelegramFile:
    def __init__(self, payload: bytes):
        self.payload = payload

    async def download_as_bytearray(self):
        return bytearray(self.payload)


class FakeMedia:
    def __init__(self, payload: bytes, *, file_name=None, mime_type=None, file_size=None):
        self._payload = payload
        self.file_name = file_name
        self.mime_type = mime_type
        self.file_size = file_size

    async def get_file(self):
        return FakeTelegramFile(self._payload)


class TranscriptionTests(unittest.IsolatedAsyncioTestCase):
    async def test_download_telegram_audio_uses_media_metadata(self) -> None:
        media = FakeMedia(b"voice-bytes", file_name="voice.ogg", mime_type="audio/ogg", file_size=42)

        downloaded = await transcription.download_telegram_audio(media, "fallback.ogg")

        self.assertEqual(b"voice-bytes", downloaded.content)
        self.assertEqual("voice.ogg", downloaded.filename)
        self.assertEqual("audio/ogg", downloaded.mime_type)
        self.assertEqual(42, downloaded.file_size)

    async def test_transcribe_audio_bytes_returns_text_from_openai_client(self) -> None:
        fake_client = SimpleNamespace(
            audio=SimpleNamespace(
                transcriptions=SimpleNamespace(
                    create=AsyncMock(return_value=SimpleNamespace(text="cliente mariana usd 5000"))
                )
            )
        )
        downloaded = transcription.DownloadedAudio(
            content=b"voice-bytes",
            filename="voice.ogg",
            mime_type="audio/ogg",
            file_size=42,
        )

        with patch.object(transcription, "get_openai_client", return_value=fake_client):
            text = await transcription.transcribe_audio_bytes(downloaded)

        self.assertEqual("cliente mariana usd 5000", text)


if __name__ == "__main__":
    unittest.main()
