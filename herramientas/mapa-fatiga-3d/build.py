import json,struct,numpy as np
from load import load
P,N,U,F=load()
def pad(b,c=b'\0'): return b+c*((4-len(b)%4)%4)
pos=P.astype('<f4').tobytes(); nor=N.astype('<f4').tobytes(); uv=U.astype('<f4').tobytes()
idx=F.astype('<u2').ravel().tobytes()
img=open('n1024.webp','rb').read()
chunks=[pos,nor,uv,idx,img]; offs=[];b=b''
for c in chunks: offs.append(len(b)); b+=pad(c)
bv=[{'buffer':0,'byteOffset':offs[i],'byteLength':len(chunks[i]),**({'target':34962} if i<3 else {'target':34963} if i==3 else {})} for i in range(5)]
j={'asset':{'version':'2.0','generator':'cadencia'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':'cuerpo'}],
 'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'TEXCOORD_0':2},'indices':3,'material':0}]}],
 'materials':[{'name':'piel','pbrMetallicRoughness':{'baseColorFactor':[.62,.62,.64,1],'metallicFactor':0,'roughnessFactor':.62},'normalTexture':{'index':0}}],
 'textures':[{'source':0,'sampler':0}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],
 'images':[{'bufferView':4,'mimeType':'image/webp'}],
 'accessors':[{'bufferView':0,'componentType':5126,'count':len(P),'type':'VEC3','min':P.min(0).tolist(),'max':P.max(0).tolist()},
  {'bufferView':1,'componentType':5126,'count':len(P),'type':'VEC3'},{'bufferView':2,'componentType':5126,'count':len(P),'type':'VEC2'},
  {'bufferView':3,'componentType':5123,'count':F.size,'type':'SCALAR'}],
 'bufferViews':bv,'buffers':[{'byteLength':len(b)}],'extensionsUsed':['EXT_texture_webp'],'extensionsRequired':[]}
j['textures'][0]['extensions']={'EXT_texture_webp':{'source':0}}; 
# fallback sin extensión: PNG sería necesario; GLTFLoader (three) soporta EXT_texture_webp
js=pad(json.dumps(j).encode(),b' ')
out=b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(b))+struct.pack('<I',len(js))+b'JSON'+js+struct.pack('<I',len(b))+b'BIN\0'+b
open('cuerpo.glb','wb').write(out); print(len(out))
