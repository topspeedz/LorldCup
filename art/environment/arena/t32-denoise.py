"""Denoise linear lighting with Blender's bundled Open Image Denoise."""
import bpy,ctypes as C,os
from pathlib import Path
import numpy as np

def denoise(rgb):
    rgb=np.ascontiguousarray(rgb,dtype=np.float32)
    assert rgb.ndim==3 and rgb.shape[2]==3 and np.isfinite(rgb).all()
    result=np.empty_like(rgb)
    root=Path(bpy.app.binary_path).parent
    with os.add_dll_directory(str(root)),os.add_dll_directory(str(root/'blender.shared')):
        lib=C.CDLL(str(root/'blender.shared/OpenImageDenoise.dll'))
        signatures={
            'oidnNewDevice':([C.c_int],C.c_void_p),'oidnCommitDevice':([C.c_void_p],None),
            'oidnSetDeviceInt':([C.c_void_p,C.c_char_p,C.c_int],None),
            'oidnNewFilter':([C.c_void_p,C.c_char_p],C.c_void_p),
            'oidnSetFilterImage':([C.c_void_p,C.c_char_p,C.c_void_p,C.c_int]+[C.c_size_t]*5,None),
            'oidnNewBuffer':([C.c_void_p,C.c_size_t],C.c_void_p),
            'oidnWriteBuffer':([C.c_void_p,C.c_size_t,C.c_size_t,C.c_void_p],None),
            'oidnReadBuffer':([C.c_void_p,C.c_size_t,C.c_size_t,C.c_void_p],None),
            'oidnReleaseBuffer':([C.c_void_p],None),
            'oidnSetFilterInt':([C.c_void_p,C.c_char_p,C.c_int],None),
            'oidnSetFilterBool':([C.c_void_p,C.c_char_p,C.c_bool],None),
            'oidnCommitFilter':([C.c_void_p],None),'oidnExecuteFilter':([C.c_void_p],None),
            'oidnGetDeviceError':([C.c_void_p,C.POINTER(C.c_char_p)],C.c_int),
            'oidnReleaseFilter':([C.c_void_p],None),'oidnReleaseDevice':([C.c_void_p],None)}
        for name,(args,ret) in signatures.items():
            fn=getattr(lib,name);fn.argtypes=args;fn.restype=ret
        device=lib.oidnNewDevice(0);lib.oidnCommitDevice(device)
        filt=lib.oidnNewFilter(device,b'RT')
        buffer=lib.oidnNewBuffer(device,rgb.nbytes)
        try:
            lib.oidnWriteBuffer(buffer,0,rgb.nbytes,rgb.ctypes.data)
            for name in [b'color',b'output']:
                lib.oidnSetFilterImage(filt,name,buffer,3,rgb.shape[1],rgb.shape[0],0,0,0)
            lib.oidnSetFilterInt(filt,b'maxMemoryMB',1536)
            lib.oidnSetFilterBool(filt,b'hdr',True)
            lib.oidnCommitFilter(filt);lib.oidnExecuteFilter(filt)
            message=C.c_char_p()
            if lib.oidnGetDeviceError(device,C.byref(message)):raise RuntimeError(message.value.decode())
            lib.oidnReadBuffer(buffer,0,rgb.nbytes,result.ctypes.data)
        finally:
            lib.oidnReleaseBuffer(buffer);lib.oidnReleaseFilter(filt);lib.oidnReleaseDevice(device)
    assert np.isfinite(result).all()
    return np.maximum(result,0)
