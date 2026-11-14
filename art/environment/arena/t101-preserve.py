"""Retain the original GLB binary; text-only edits need only node transforms."""
import hashlib
import json
import struct
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT/'temp/T101'
def read(path):
    data=path.read_bytes()
    size=struct.unpack_from('<I',data,12)[0]
    return json.loads(data[20:20+size]),data[28+size:]

g,binary=read(OUT/'backup/arena-v2.glb')
exported,_=read(OUT/'arena-final.glb')
plan=json.loads((OUT/'attachment-plan.json').read_text())
changed={r['name'] for r in plan}
assert {n['name'] for n in g['nodes']}=={n['name'] for n in exported['nodes']}
assert {n['name'] for n in g['nodes'] if 'mesh' in n}=={n['name'] for n in exported['nodes'] if 'mesh' in n}
def triangle_count(doc):
    return sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
assert triangle_count(g)==triangle_count(exported)

def local(node):
    if 'matrix' in node: return np.array(node['matrix']).reshape(4,4).T
    x,y,z,w=node.get('rotation',[0,0,0,1])
    r=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
        [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
        [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    m=np.eye(4);m[:3,:3]=r@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0])
    return m
parents={c:i for i,n in enumerate(g['nodes']) for c in n.get('children',[])}
worlds={}
def world(i):
    if i not in worlds: worlds[i]=(world(parents[i]) if i in parents else np.eye(4))@local(g['nodes'][i])
    return worlds[i]
for i in range(len(g['nodes'])): world(i)
names={n['name']:i for i,n in enumerate(g['nodes'])}
C=np.array([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]])
for row in plan:
    index=names[row['name']]
    # Apply the rigid Blender delta to the original decoded mesh coordinate system.
    delta=C@np.array(row['worldAfter'])@np.linalg.inv(np.array(row['worldBefore']))@np.linalg.inv(C)
    desired=delta@worlds[index]
    parent=worlds[parents[index]] if index in parents else np.eye(4)
    matrix=np.linalg.inv(parent)@desired
    node=g['nodes'][index]
    for key in ('translation','rotation','scale'): node.pop(key,None)
    node['matrix']=matrix.T.reshape(-1).tolist()

text=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf-8')
text+=b' '*(-len(text)%4)
result=struct.pack('<III',0x46546c67,2,28+len(text)+len(binary))
result+=struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary
(OUT/'arena-final.glb').write_bytes(result)
old,old_binary=read(OUT/'backup/arena-v2.glb')
assert old_binary==binary
node_changes=[]
for a,b in zip(old['nodes'],g['nodes']):
    if a!=b:
        assert a['name'] in changed
        assert {k:v for k,v in a.items() if k not in ('matrix','translation','rotation','scale')}=={k:v for k,v in b.items() if k not in ('matrix','translation','rotation','scale')}
        node_changes.append(a['name'])
assert set(node_changes)==changed
assert {k:v for k,v in g.items() if k!='nodes'}=={k:v for k,v in old.items() if k!='nodes'}
baseline=json.loads((OUT/'baseline.json').read_text())
assert all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h for p,h in baseline['files'].items())
summary={'changedTextNodes':len(node_changes),'unchangedMeshNodes':sum('mesh' in n for n in g['nodes'])-len(changed),
    'triangles':triangle_count(g),'binaryBytesIdentical':True,'materialsImagesUVsIdentical':True,
    'sourceAndLightmapsUnchanged':True,'bytes':len(result),'sha256':hashlib.sha256(result).hexdigest()}
(OUT/'glb-comparison.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary))
