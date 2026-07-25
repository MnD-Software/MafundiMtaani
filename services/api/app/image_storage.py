"""Provider-neutral image normalization before durable storage."""

from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError


def optimize_upload(content: bytes, content_type: str, filename: str) -> tuple[bytes, str, str]:
    if not content_type.startswith("image/"):
        return content, content_type, filename
    try:
        with Image.open(BytesIO(content)) as source:
            image = ImageOps.exif_transpose(source)
            if image.width > 2048 or image.height > 2048:
                image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
            if image.mode not in {"RGB", "RGBA"}:
                image = image.convert("RGBA" if "transparency" in image.info else "RGB")
            output = BytesIO()
            image.save(output, "WEBP", quality=84, method=6)
            optimized = output.getvalue()
            if len(optimized) >= len(content):
                return content, content_type, filename
            stem = filename.rsplit(".", 1)[0]
            return optimized, "image/webp", f"{stem}.webp"
    except (UnidentifiedImageError, OSError, ValueError):
        return content, content_type, filename
