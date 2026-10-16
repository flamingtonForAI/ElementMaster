# 检查接缝：解码成品，比较 loopEnd 和 loopStart 之后的一段是否一致
import json, sys, subprocess, numpy as np
SR=48000
for f in sys.argv[1:]:
    j=json.load(open(f+'.json'))
    x=np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',f,'-f','f32le','-ac','2','-ar','48000','-'],capture_output=True).stdout,np.float32).reshape(-1,2)
    a,b=int(j['loopStart']*SR),int(j['loopEnd']*SR); w=int(0.2*SR)
    best=min(range(-1500,1501,50),key=lambda k: np.abs(x[a+k:a+k+w]-x[b:b+w]).mean())
    d=np.abs(x[a:a+w]-x[b:b+w]).mean()/ (np.abs(x[b:b+w]).mean()+1e-9)
    l=subprocess.run(['ffmpeg','-nostats','-i',f,'-af','ebur128','-f','null','-'],capture_output=True).stderr.decode()
    I=[s for s in l.splitlines() if ' I:' in s][-1].strip()
    print(f, j, f'seam relative diff {d:.3f}, best shift {best} samples,', I)
