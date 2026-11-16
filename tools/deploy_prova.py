# Pubblica SOLO i file indicati (di base prova/index.html) su Netlify, lasciando intatto tutto il resto del sito
# (compresi installatore Windows e APK, che non sono in questo contenitore): deploy "a impronte".
import json, hashlib, subprocess, sys, time, urllib.request
SITE="d34b7ae6-c7c7-450c-a8f4-b66e0d63053f"; API="https://api.netlify.com/api/v1"
def call(method, url, data=None, ctype="application/json"):
    cmd=["curl","-sS","-X",method,url]
    if data is not None: cmd+=["-H","Content-Type: "+ctype,"--data-binary","@-"]
    r=subprocess.run(cmd,input=data,capture_output=True)
    return r.stdout
site=json.loads(call("GET",f"{API}/sites/{SITE}"))
cur=site["published_deploy"]["id"]
files=json.loads(call("GET",f"{API}/deploys/{cur}/files"))
mp={f["id"]:f["sha"] for f in files}
print("file online ora:",len(mp)); 
# uso: deploy_prova.py [/percorso/sul/sito=file_locale ...]   (senza argomenti: solo /prova/index.html)
local={"/prova/index.html":"prova/index.html"}
if len(sys.argv)>1: local={a.split("=",1)[0]:a.split("=",1)[1] for a in sys.argv[1:]}
for k,v in local.items(): mp[k]=hashlib.sha1(open(v,"rb").read()).hexdigest()
d=json.loads(call("POST",f"{API}/sites/{SITE}/deploys",json.dumps({"files":mp}).encode()))
dep=d["id"]; req=d.get("required",[]); print("deploy",dep,"da caricare:",len(req))
by_sha={}
for k,v in local.items(): by_sha[mp[k]]=(k,v)
for sha in req:
    path,src=by_sha[sha]
    out=call("PUT",f"{API}/deploys/{dep}/files{path}",open(src,"rb").read(),"application/octet-stream"); print("caricato",path,len(out))
for i in range(60):
    st=json.loads(call("GET",f"{API}/deploys/{dep}"))["state"]
    if st=="ready": break
    if st=="error": sys.exit("ERRORE: deploy fallito")
    time.sleep(3)
assert st=="ready", st
live=json.loads(call("GET",f"{API}/sites/{SITE}"))["published_deploy"]["id"]
assert live==dep, ("online c'è ancora", live)
new={f["id"]:f["sha"] for f in json.loads(call("GET",f"{API}/deploys/{dep}/files"))}
changed=[k for k in set(new)|set(mp) if new.get(k)!=({f['id']:f['sha'] for f in files}).get(k)]
print("OK: pubblicato. File cambiati rispetto a prima:",changed); print("file online adesso:",len(new))
assert set(new)>= set(f["id"] for f in files), "mancano file rispetto a prima!"
