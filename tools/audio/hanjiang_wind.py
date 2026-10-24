#!/usr/bin/env python3
"""为寒江配乐烘焙持续的暴风雪声底，之后交给 loop_intro.py 一起切循环。

用法：python3 tools/audio/hanjiang_wind.py original.wav blizzard.wav
保留原音乐动态；风声 RMS 比音乐低 11 dB，独立左右声道产生宽阔风雪感。
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np


def main():
    src, dst = sys.argv[1:3]
    sr = 48000
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '2', '-ar', str(sr), '-'],
        capture_output=True, check=True,
    ).stdout
    music = np.frombuffer(raw, np.float32).reshape(-1, 2)
    n = len(music)
    rng = np.random.default_rng(20261047)
    # 24 kHz 制作环境层，最后插值到配乐采样率；避开低鼓频段和尖锐高频。
    count = (n + 1) // 2
    time = np.arange(count) / 24000
    freq = np.fft.rfftfreq(count, 1 / 24000)
    pink = 1 / np.sqrt(np.maximum(freq, 1))
    body = np.exp(-0.5 * ((freq - 750) / 700) ** 2) * (1 - np.exp(-(freq / 220) ** 4))
    hiss = 0.22 * np.exp(-0.5 * ((freq - 3000) / 1100) ** 2)

    def noise():
        spectrum = np.fft.rfft(rng.standard_normal(count))
        wave = np.fft.irfft(spectrum * pink * (body + hiss), n=count)
        return wave / max(np.sqrt(np.mean(wave ** 2)), 1e-9)

    shared = noise()
    wind = np.empty((n, 2), np.float32)
    full_time = np.arange(n) / sr
    for channel in range(2):
        # 阵风有两种慢周期，强弱错开；保持底噪以免出现无风的空洞。
        gust = 0.3 + 0.5 * (0.5 + 0.5 * np.sin(2 * np.pi * time / 13 + channel * 0.7)) ** 2
        gust += 0.2 * (0.5 + 0.5 * np.sin(2 * np.pi * time / 7.3 + 1.4)) ** 3
        wave = (0.65 * shared + 0.55 * noise()) * gust
        wind[:, channel] = np.interp(full_time, time, wave)
    music_rms = float(np.sqrt(np.mean(music ** 2)))
    wind *= music_rms * 10 ** (-11 / 20) / max(float(np.sqrt(np.mean(wind ** 2))), 1e-9)
    # 尾部音乐本身会淡出；正式循环结束点沿用原音乐的有效区间。
    fade = np.minimum(full_time / 0.6, 1) * np.minimum((n / sr - full_time) / 2, 1)
    wind *= fade[:, None]
    mixed = music + wind
    peak = float(np.max(np.abs(mixed)))
    gain = min(1, 0.94 / max(peak, 1e-9))
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-n', '-f', 'f32le', '-ar', str(sr), '-ac', '2', '-i', '-',
         '-c:a', 'pcm_s24le', dst], input=(mixed * gain).astype(np.float32).tobytes(), check=True,
    )
    metadata = {'source': src, 'seed': 20261047, 'wind_relative_rms_db': -11,
                'headroom_gain': gain, 'duration_sec': n / sr, 'sample_rate': sr}
    Path(dst + '.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()
