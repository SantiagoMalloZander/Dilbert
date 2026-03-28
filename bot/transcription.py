import io
import logging
from dataclasses import dataclass
from typing import Optional

from extractor import get_openai_client

logger = logging.getLogger(__name__)


class AudioDownloadError(RuntimeError):
    pass


class AudioTranscriptionError(RuntimeError):
    pass


@dataclass(frozen=True)
class DownloadedAudio:
    content: bytes
    filename: str
    mime_type: Optional[str]
    file_size: Optional[int]


async def download_telegram_audio(media, fallback_filename: str) -> DownloadedAudio:
    try:
        telegram_file = await media.get_file()
        downloaded = await telegram_file.download_as_bytearray()
    except Exception as exc:
        raise AudioDownloadError(str(exc)) from exc

    filename = getattr(media, "file_name", None) or fallback_filename
    mime_type = getattr(media, "mime_type", None)
    file_size = getattr(media, "file_size", None)
    return DownloadedAudio(
        content=bytes(downloaded),
        filename=filename,
        mime_type=mime_type,
        file_size=file_size,
    )


async def transcribe_audio_bytes(audio: DownloadedAudio) -> str:
    client = get_openai_client()
    buffer = io.BytesIO(audio.content)
    buffer.name = audio.filename

    try:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=buffer,
        )
    except Exception as exc:
        raise AudioTranscriptionError(str(exc)) from exc

    if isinstance(response, str):
        text = response
    else:
        text = getattr(response, "text", None)

    if not text or not text.strip():
        raise AudioTranscriptionError("OpenAI returned an empty transcription.")

    logger.info("audio transcribed filename=%s chars=%d", audio.filename, len(text))
    return text.strip()
