"""Use persisted transforms; hidden objects have unevaluated world matrices after reload."""
import hashlib, array

def persistent_signature(ob):
    transform=(ob.type,tuple(ob.location),ob.rotation_mode,tuple(ob.rotation_euler),
               tuple(ob.rotation_quaternion),tuple(ob.rotation_axis_angle),tuple(ob.scale),
               tuple(ob.delta_location),tuple(ob.delta_rotation_euler),tuple(ob.delta_rotation_quaternion),tuple(ob.delta_scale),
               ob.parent.name if ob.parent else None,ob.parent_type,ob.parent_bone,
               tuple(tuple(row) for row in ob.matrix_parent_inverse),ob.hide_render)
    h=hashlib.sha256(str(transform).encode())
    if ob.type=='MESH':
        a=array.array('f',[0])*(len(ob.data.vertices)*3);ob.data.vertices.foreach_get('co',a);h.update(a.tobytes())
        a=array.array('i',[0])*len(ob.data.loops);ob.data.loops.foreach_get('vertex_index',a);h.update(a.tobytes())
        h.update(str((len(ob.data.polygons),[m.name if m else None for m in ob.data.materials])).encode())
    if ob.animation_data and ob.animation_data.action:h.update(ob.animation_data.action.name.encode())
    return h.hexdigest()
