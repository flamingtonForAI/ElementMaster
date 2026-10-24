#!/usr/bin/env python3
"""前三关的合成环境声层：road 荒风枯草、bamboo 竹叶竹腔、mountain 山风低鸣。

python3 tools/audio/early_ambience.py original.wav mixed.wav road|bamboo|mountain [relative_db]
与音乐一起交给 loop_intro.py；不产生会与战斗预警混淆的狼嚎、怪叫或落石撞击。
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np


def main():
    src, dst, terrain = sys.argv[1:4]
    profiles = {
        'road': {'seed': 20261051, 'db': -14, 'period': 11, 'bands': [(450, 400, 1), (1700, 850, 0.3)]},
        'bamboo': {'seed': 20261052, 'db': -12, 'period': 5, 'bands': [(2400, 1200, 1), (650, 320, 0.35)]},
        'mountain': {'seed': 20261053, 'db': -14, 'period': 16, 'bands': [(400, 380, 1), (100, 60, 0.2)]},
    }
    profile = profiles[terrain].copy()
    if len(sys.argv) > 4:
        profile['db'] = float(sys.argv[4])
        if not np.isfinite(profile['db']) or not -60 <= profile['db'] <= 0:
            raise ValueError('relative_db must be between -60 and 0')
    sr = 48000
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '2', '-ar', str(sr), '-'],
        capture_output=True, check=True,
    ).stdout
    music = np.frombuffer(raw, np.float32).reshape(-1, 2)
    n = len(music)
    count = (n + 1) // 2
    time = np.arange(count) / 24000
    freq = np.fft.rfftfreq(count, 1 / 24000)
    shape = sum(weight * np.exp(-0.5 * ((freq - center) / width) ** 2)
                for center, width, weight in profile['bands'])
    shape *= (1 - np.exp(-(freq / 65) ** 4)) / np.maximum(freq, 1) ** 0.35
    rng = np.random.default_rng(profile['seed'])

    def noise():
        wave = np.fft.irfft(np.fft.rfft(rng.standard_normal(count)) * shape, n=count)
        return wave / max(float(np.sqrt(np.mean(wave ** 2))), 1e-9)

    shared = noise()
    ambience = np.empty((n, 2), np.float32)
    full_time = np.arange(n) / sr
    for channel in range(2):
        gust = 0.25 + 0.75 * (0.5 + 0.5 * np.sin(2 * np.pi * time / profile['period'] + channel)) ** 2
        wave = (0.6 * shared + 0.6 * noise()) * gust
        if terrain == 'bamboo':
            # 轻短竹叶摩擦随风簇拥，竹腔共鸣是柔和擦鸣，不充当节拍或攻击音效。
            wave *= 0.4 + 0.6 * (0.5 + 0.5 * np.sin(2 * np.pi * time / 1.7 + channel * 0.4)) ** 3
            for start in np.arange(4 + channel * 3, time[-1] - 2, 17):
                at = np.flatnonzero((time >= start) & (time < start + 1.6))
                t = time[at] - start
                wave[at] += 0.12 * np.sin(np.pi * t / 1.6) ** 2 * np.sin(2 * np.pi * (230 * t + 18 * t * t))
        ambience[:, channel] = np.interp(full_time, time, wave)
    target = float(np.sqrt(np.mean(music ** 2))) * 10 ** (profile['db'] / 20)
    ambience *= target / max(float(np.sqrt(np.mean(ambience ** 2))), 1e-9)
    ambience *= (np.minimum(full_time / 0.6, 1) * np.minimum((n / sr - full_time) / 2, 1))[:, None]
    mixed = music + ambience
    gain = min(1, 0.94 / max(float(np.max(np.abs(mixed))), 1e-9))
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-n', '-f', 'f32le', '-ar', str(sr), '-ac', '2', '-i', '-',
         '-c:a', 'pcm_s24le', dst], input=(mixed * gain).astype(np.float32).tobytes(), check=True,
    )
    metadata = {'source': src, 'terrain': terrain, 'profile': profile,
                'headroom_gain': gain, 'duration_sec': n / sr, 'sample_rate': sr}
    Path(dst + '.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()
