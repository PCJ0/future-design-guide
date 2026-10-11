import zipfile, posixpath, re, sys, os
from xml.etree import ElementTree as ET
from pathlib import Path
ppt=Path(sys.argv[1]); out=Path(sys.argv[2]); mapping={int(x.split('=')[0]):x.split('=')[1] for x in sys.argv[3:]}; out.mkdir(parents=True,exist_ok=True)
ns={'r':'http://schemas.openxmlformats.org/package/2006/relationships'}
with zipfile.ZipFile(ppt) as z:
 names=set(z.namelist())
 for slide,alias in mapping.items():
  relpath=f'ppt/slides/_rels/slide{slide}.xml.rels'
  if relpath not in names: print('MISSING',slide); continue
  root=ET.fromstring(z.read(relpath)); imgs=[]
  for rel in root:
   typ=rel.attrib.get('Type',''); target=rel.attrib.get('Target','')
   if typ.endswith('/image'):
    path=posixpath.normpath(posixpath.join('ppt/slides',target))
    if path in names and not path.endswith('image1.png'):
     imgs.append((z.getinfo(path).file_size,path))
  imgs.sort(reverse=True)
  if not imgs: print('NOIMAGE',slide);continue
  size,path=imgs[0]; ext=Path(path).suffix.lower(); dest=out/(alias+ext);dest.write_bytes(z.read(path));print(slide,alias,size,path,dest)
