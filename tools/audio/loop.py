#!/usr/bin/env python3
"""把生成的曲子切成可无缝循环的一段：整小节、按节拍对齐、尾部交叉淡入循环起点、响度统一。
usage: loop.py in.mp3 out.mp3 bpm start_sec [bars] [lufs]
"""
import subprocess, sys
import numpy as np

SR = 48000


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def onset_env(x, hop=480):
    m = x.mean(1)
    n = len(m) // hop
    e = np.sqrt((m[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)
    d = np.maximum(0, np.diff(np.log(e), prepend=np.log(e[0])))
    return d - d.mean()


def main():
    src, dst, bpm, start = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
    want_bars = int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != '0' else 0
    lufs = float(sys.argv[6]) if len(sys.argv) > 6 else -16
    x = decode(src)
    bar = 4 * 60 / bpm
    # 尾部低于 -45dB 的部分算静音，再留出收尾淡出的余量
    amp = np.abs(x).max(1)
    last = np.nonzero(amp > 10 ** (-45 / 20))[0][-1] / SR
    usable_end = last - (2 * bar if len(sys.argv) <= 7 else float(sys.argv[7]))
    L0 = start
    xf = bar  # 交叉淡化一小节
    bars = want_bars or int((usable_end - L0) // bar)
    # 用起音包络找最像循环起点的结束位置：在整小节附近 ±120ms 内找相关最大的点
    env = onset_env(x)
    hop_s = 480 / SR
    win = int(bar / hop_s)
    i0 = int(L0 / hop_s)
    ref = env[i0:i0 + win]
    best, best_c = None, -1e9
    for b in ([want_bars] if want_bars else range(max(4, bars - 2), bars + 1)):
        nominal = L0 + b * bar
        if nominal > usable_end + 0.01:
            continue
        for k in range(-12, 13):
            j = int(nominal / hop_s) + k
            seg = env[j:j + win]
            if len(seg) < win:
                continue
            c = float(np.dot(ref, seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-9))
            if c > best_c:
                best, best_c = j * hop_s, c
    L1 = best
    s0, s1, n = int(L0 * SR), int(L1 * SR), int(xf * SR)
    body = x[s0:s1].copy()
    # 结尾一小节淡出，同时淡入循环起点之前的那一小节，这样跳回 L0 时信号连续
    pre = x[s0 - n:s0] if s0 >= n else np.vstack([np.zeros((n - s0, 2), np.float32), x[:s0]])
    t = np.linspace(0, 1, n, dtype=np.float32)[:, None]
    fo, fi = np.cos(t * np.pi / 2), np.sin(t * np.pi / 2)
    body[-n:] = body[-n:] * fo + pre * fi
    # 前后各留余量，循环点在代码里用 loopStart/loopEnd 指定，避开 MP3 编码延迟造成的偏移
    m = int(0.25 * SR)
    head = x[s0 - m:s0] if s0 >= m else np.vstack([np.zeros((m - s0, 2), np.float32), x[:s0]])
    body = np.vstack([head, body, x[s0:s0 + m]])
    import json
    json.dump({'loopStart': round(m / SR, 4), 'loopEnd': round((m + s1 - s0) / SR, 4)}, open(dst + '.json', 'w'))
    print(f'{src}: loop {L0:.2f}-{L1:.2f}s ({(L1 - L0) / bar:.2f} bars, corr {best_c:.2f})')
    pcm = body.astype(np.float32).tobytes()
    inp = ['ffmpeg', '-v', 'info', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-']
    # 先测整段响度
    r = subprocess.run(inp + ['-af', f'loudnorm=I={lufs}:TP=-1.5:LRA=20:print_format=json', '-f', 'null', '-'],
                       input=pcm, capture_output=True, check=True).stderr.decode()
    meas = json.loads(r[r.rindex('{'):r.rindex('}') + 1])
    # 固定增益 + 限幅；loudnorm 的 linear 模式碰到峰值超限会退回动态模式，接缝处音量就对不上了
    af = f"volume={lufs - float(meas['input_i']):.2f}dB,alimiter=limit=0.84:attack=5:release=50:level=false"
    subprocess.run(inp + ['-af', af, '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', '128k', dst],
                   input=pcm, capture_output=True, check=True)


main()
