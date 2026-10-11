import zipfile,sys
from pathlib import Path
from shutil import copyfileobj
args=sys.argv[1:]
if len(args)%3: raise SystemExit('arguments must be groups: deck, output directory, mapping list')
for i in range(0,len(args),3):
 p=Path(args[i]); out=Path(args[i+1]); mappings=args[i+2];out.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(p) as z:
  for pair in mappings.split(','):
   media,alias=pair.split('='); src=f'ppt/media/{media}.mp4'
   try: info=z.getinfo(src)
   except KeyError: print('MISSING',p.name,src);continue
   dest=out/(alias+'.mp4')
   with z.open(src) as s, open(dest,'wb') as d: copyfileobj(s,d)
   print(p.name,src,info.file_size,'->',dest)
