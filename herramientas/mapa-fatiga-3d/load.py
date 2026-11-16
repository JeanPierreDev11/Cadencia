import struct,json,numpy as np
def load(path='/mnt/user-data/uploads/2cee4d37-un-solo-maniqui-masculino-con-los-musculos.glb'):
    f=open(path,'rb').read()
    l,_=struct.unpack('<II',f[12:20]); j=json.loads(f[20:20+l]); b=20+l+8
    def acc(i):
        a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]
        n={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
        dt={5126:np.float32,5123:np.uint16,5125:np.uint32}[a['componentType']]
        o=b+bv.get('byteOffset',0)+a.get('byteOffset',0)
        return np.frombuffer(f,dt,a['count']*n,o).reshape(-1,n)
    p=j['meshes'][0]['primitives'][0]
    return acc(p['attributes']['POSITION']).astype(np.float64),acc(p['attributes']['NORMAL']).astype(np.float64),acc(p['attributes']['TEXCOORD_0']).astype(np.float64),acc(p['indices']).reshape(-1,3).astype(np.int64)
