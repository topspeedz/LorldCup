"""Use T93b's exact Draco flags on the saved T101 scene."""
from pathlib import Path
ART = Path(__file__).resolve().parent
source = (ART/'t93b-export.py').read_text(encoding='utf-8')
source = source.replace("'temp/T93b'", "'temp/T101'").replace('barclays-arena-t93b.blend','barclays-arena-t101.blend')
exec(compile(source,str(ART/'t93b-export.py'),'exec'),globals())
