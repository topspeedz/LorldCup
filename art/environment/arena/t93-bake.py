"""Run the existing four-atlas transport bake once through Blender2."""
from pathlib import Path
ART = Path(__file__).resolve().parent
source = (ART / 't75-bake.py').read_text(encoding='utf-8')
source = source.replace("OUT=ROOT/'temp/T75'", "OUT=ROOT/'temp/T93'")
source = source.replace("['owner']=='T75'", "['owner']=='task_33ae3c9bb210'")
source = source.replace('barclays-arena-t75.blend', 'barclays-arena-t93-crowd.blend')
source = source.replace('barclays-arena-t75-baked.blend', 'barclays-arena-t93-baked.blend')
source = source.replace("or o.name.endswith('__lod10')", "or o.name.endswith('__lod10') or o.name.endswith('__barrier')")
exec(compile(source, str(ART / 't75-bake.py'), 'exec'), globals())
