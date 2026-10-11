from pathlib import Path
import base64,json,re
root=Path(__file__).resolve().parents[1];dist=root/'dist'
html=(dist/'index.html').read_text();css=(dist/'style.css').read_text()
files=re.findall(r'<script src="([^"]+)"></script>',html)
js='\n'.join((dist/n).read_text() for n in files)
used=set(re.findall(r'assets/[A-Za-z0-9_.-]+',css+js+html));mapping={}
for name in used:
 p=dist/name
 mime='image/png' if p.suffix=='.png' else 'image/jpeg'
 mapping[name]='data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
css_vars={name:'--offline-'+re.sub('[^a-zA-Z0-9]','-',name) for name in used}
for name in used:
 css=css.replace("url('"+name+"')",'var('+css_vars[name]+')')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=re.sub(r'<script src="[^"]+"></script>','',html)
html=re.sub(r'src="(assets/[^"]+)"',r'data-offline-src="\1"',html)
bootstrap='window.OFFLINE_ASSETS='+json.dumps(mapping)+';\nconst offlineVars='+json.dumps(css_vars)+';\nfor(const [name,variable]of Object.entries(offlineVars)){document.documentElement.style.setProperty(variable,\'url("\'+OFFLINE_ASSETS[name]+\'")\')}\nfor(const el of document.querySelectorAll("[data-offline-src]")){el.src=OFFLINE_ASSETS[el.dataset.offlineSrc]}\n'
html=html.replace('</body>','<script>'+bootstrap+js+'</script></body>')
out=root/'review/yuhuan-guide-v9.html';out.write_text(html)
print(out, out.stat().st_size)
