"""Reuse T93's lossless WebP pass and its image-name cache."""
from pathlib import Path

ART = Path(__file__).resolve().parent
source = (ART / 't75-webp.py').read_text(encoding='utf-8')
source = source.replace("OUT = ROOT / 'temp/T75'", "OUT = ROOT / 'temp/T93b'")
source = source.replace("final_path = OUT / 'arena-final.glb'", "final_path = OUT / 'backup/arena-v2.glb'")
source = source.replace("cached[image['bufferView']]", "cached[image.get('name')]")
source = source.replace("cached.get(image['bufferView'])", "cached.get(image.get('name'))")
exec(compile(source, str(ART / 't75-webp.py'), 'exec'), globals())
