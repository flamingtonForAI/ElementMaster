#!/usr/bin/env python3
"""把生成的曲子切成「前奏播一次 + 主体无缝循环」的 BGM 文件。

usage: loop_intro.py in.(mp3|mp4|wav) out.mp3 bpm start_hint end_limit [lufs]

- start_hint：循环起点的大概位置（秒），会吸附到附近 ±0.25 秒内最强的起音；之前的部分作为前奏只播一次
- end_limit：循环终点不能超过的位置（秒），设在曲子收尾、淡出之前
- 终点取起点之后整小节附近（±120ms）起音包络和起点最像的位置；最后一小节与起点前一小节交叉淡化
- 整体用固定增益统一到 lufs（默认 -16），再限幅，接缝两侧音量一致
- 输出 out.mp3 和 out.mp3.json（loopStart / loopEnd，填进 src/audio/tracks.ts 的 BGM_FILES），并打印接缝误差
"""
import json
import subprocess
import sys

import numpy as np

SR = 48000
HOP = 480


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def onset_env(x):
    m = x.mean(1)
    n = len(m) // HOP
    e = np.sqrt((m[:n * HOP].reshape(n, HOP) ** 2).mean(1) + 1e-12)
    d = np.maximum(0, np.diff(np.log(e), prepend=np.log(e[0])))
    return d - d.mean()


def main():
    src, dst = sys.argv[1], sys.argv[2]
    bpm, hint, end_limit = float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
    lufs = float(sys.argv[6]) if len(sys.argv) > 6 else -16
    x = decode(src)
    bar = 4 * 60 / bpm
    hop_s = HOP / SR
    env = onset_env(x)

    # 起点吸附到最强起音
    i_lo, i_hi = int((hint - 0.25) / hop_s), int((hint + 0.25) / hop_s)
    i0 = i_lo + int(np.argmax(env[i_lo:i_hi]))
    L0 = i0 * hop_s

    win = int(bar / hop_s)
    ref = env[i0:i0 + win]
    best, best_c = None, -1e9
    bars = int((end_limit - L0) // bar)
    for b in range(max(4, bars - 2), bars + 1):
        nominal = L0 + b * bar
        for k in range(-12, 13):
            j = int(nominal / hop_s) + k
            if j * hop_s > end_limit:
                continue
            seg = env[j:j + win]
            if len(seg) < win:
                continue
            c = float(np.dot(ref, seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-9))
            if c > best_c:
                best, best_c = j * hop_s, c
    L1 = best

    s0, s1, n = int(L0 * SR), int(L1 * SR), int(bar * SR)
    # 前奏 + 主体；主体最后一小节淡出，同时淡入起点之前的那一小节，跳回起点时信号连续
    body = x[:s1].copy()
    pre = x[s0 - n:s0] if s0 >= n else np.vstack([np.zeros((n - s0, 2), np.float32), x[:s0]])
    t = np.linspace(0, 1, n, dtype=np.float32)[:, None]
    body[-n:] = body[-n:] * np.cos(t * np.pi / 2) + pre * np.sin(t * np.pi / 2)
    # 终点后再接 0.25 秒起点的内容，避开 MP3 解码边界
    m = int(0.25 * SR)
    body = np.vstack([body, x[s0:s0 + m]])
    meta = {'loopStart': round(L0, 4), 'loopEnd': round(L1, 4)}
    json.dump(meta, open(dst + '.json', 'w'))

    pcm = body.astype(np.float32).tobytes()
    inp = ['ffmpeg', '-v', 'info', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-']
    r = subprocess.run(inp + ['-af', f'loudnorm=I={lufs}:TP=-1.5:LRA=20:print_format=json', '-f', 'null', '-'],
                       input=pcm, capture_output=True, check=True).stderr.decode()
    meas = json.loads(r[r.rindex('{'):r.rindex('}') + 1])
    # 固定增益 + 限幅；loudnorm 的 linear 模式碰到峰值超限会退回动态模式，接缝处音量就对不上了
    af = f"volume={lufs - float(meas['input_i']):.2f}dB,alimiter=limit=0.84:attack=5:release=50:level=false"
    subprocess.run(inp + ['-af', af, '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', '128k', dst],
                   input=pcm, capture_output=True, check=True)
    # 游戏优先加载的 Opus 版（同名 .webm），MP3 留作不支持 Opus 的浏览器兜底
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', dst, '-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on',
                    '-application', 'audio', dst.rsplit('.', 1)[0] + '.webm'], check=True)

    # 接缝检查：成品里 loopEnd 之后与 loopStart 之后的 0.2 秒应当几乎一致
    y = decode(dst)
    a, b, w = int(L0 * SR), int(L1 * SR), int(0.2 * SR)
    diff = np.abs(y[a:a + w] - y[b:b + w]).mean() / (np.abs(y[b:b + w]).mean() + 1e-9)
    print(f'{src}: intro {L0:.2f}s, loop {L0:.2f}-{L1:.2f}s ({(L1 - L0) / bar:.2f} bars, corr {best_c:.2f}), '
          f'seam diff {diff:.3f}, {json.dumps(meta)}')


main()
