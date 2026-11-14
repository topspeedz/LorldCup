"""Run the unchanged T93b lossless WebP and shared crest-alpha pass."""
from pathlib import Path
ART = Path(__file__).resolve().parent
source = (ART/'t93b-webp.py').read_text(encoding='utf-8').replace('temp/T93b','temp/T101')
exec(compile(source,str(ART/'t93b-webp.py'),'exec'),globals())
