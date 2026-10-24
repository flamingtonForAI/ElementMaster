# 关卡战斗音乐

2026-10-24–25：第 1–10 关已由 Windows Studio 的 ACE-Step 1.5 turbo q8_0 生成战斗配乐。第四关沿用用户确认的赤焰谷 battle-v2，第七关已强化暴风雪；第 1–3 关按地形加入独立环境层，第一关另有紧张版。统一使用纯器乐、稳定战斗脉冲，配器随关卡地形改变。

用户修订方向：第一版赤焰谷过于欢快。关卡配乐应先满足战斗节奏，再表现地形与威胁；避免明亮跳跃的庆典旋律。唢呐可以作为短促警鸣，不必全程领唱。寒江首版的寒冷与暴风雪不够明显，修订版让持续阵风、冰雪噪声和冰冷弓弦成为可辨认的主体氛围。第一、二关的后续反馈是偏平缓：保留地形声底，但让连续鼓点、短拨弦与紧迫感占主导，减少长音留白。

| 关卡 | 地形与威胁 | 配器方向 | 生成 BPM | 前奏 / 循环主体 |
| --- | --- | --- | ---: | ---: |
| 1 荒郊古道 | 乱石、古碑、枯草与迫近的妖物 | 连续强鼓、快速古琴与短低箫，荒风退后 | 128 | 3.74 / 101.25 秒 |
| 1 紧张版 | 半场妖群围拢 | 同动机方向，密集滚奏、持续低弦、高压推进 | 144 | 3.31 / 98.42 秒 |
| 2 竹林 | 密竹缺口、藤怪、竹叶青伏击 | 快速竹梆木鱼、紧鼓、琵琶古琴短句，竹叶声底 | 140 | 3.44 / 102.84 秒 |
| 3 山林 | 岩壁山道、落石、山魈震山 | 穿谷山风、低频岩壁回响、沉重战鼓与低弦 | 120 | 7.82 / 91.99 秒 |
| 4 赤焰谷 | 玄武岩窄谷、熔岩、余火、毕方 | 连续低鼓、古琴低音、短唢呐警鸣 | 132 | 7.20 / 43.59 秒 |
| 5 兵冢古战场 | 拒马、剑阵、铁甲列阵、复活残兵 | 沉重战鼓、低编钟、干戈金属节奏 | 112 | 8.57 / 81.34 秒 |
| 6 云梦泽 | 泥潭、毒瘴、缠根、水鬼 | 闷鼓、古琴重复低音、错位木鱼、低箫 | 120 | 8.01 / 81.98 秒 |
| 7 寒江 | 冰面、冰崖缺口、暴风雪 | 持续阵风与冰雪噪声、冰冷弓弦、低箫气息、闷鼓 | 128 | 7.51 / 80.62 秒 |
| 8 大漠 | 流沙、沙暴、雅丹、旱魃 | 干燥低鼓、细密打击、低笛短句、稀疏金属铃 | 126 | 7.79 / 81.96 秒 |
| 9 东海归墟 | 潮水与海底火山、水火交替 | 浪涌战鼓、古琴与唢呐交替、深锣 | 136 | 6.92 / 79.33 秒 |
| 10 昆仑 | 玉崖、五气轮转、五种地形威胁 | 琴、笛、唢呐、编钟轮流显露，层叠战鼓持续推进 | 144 | 6.64 / 80.12 秒 |

BPM、调性与配器是生成要求，不代表逐音人工校对。第四关方向已试听确认；其余关卡已完成技术验证，听感仍可逐关微调。第一关两版按相同 D F G A G F D 动机与配器要求生成，实际旋律并未逐音校对。归墟与昆仑的配器变化写在音轨内，不与游戏相位实时同步。

## 文件与调用

- 游戏素材：`public/audio/bgm_level1` 至 `bgm_level10`，以及 `bgm_level1_danger`，各有 MP3 与 WebM/Opus 两版，旁附 `.mp3.json` 循环点。
- 播放注册：`src/audio/tracks.ts` 的 `BGM_FILES`。关卡原本就使用对应的 `level1`–`level10`，第一关半场使用 `level1_danger`，无需修改关卡或播放系统。
- 游戏优先下载 WebM；不支持或解码失败时回退 MP3。保留原有程序化备份、Boss 切曲以及局势强度滤波/增益行为。
- 生成参数、seed、任务 ID、处理参数：`battle-levels.json`。第 5、6、8–10 关实际 prompt 为各自 `prompt` 加 `common_prompt`；第 1–3 关、第一关紧张版、第四关与第七关修订版的 `prompt` 是完整原文。`track` 字段对应实际播放 key，`key` 字段是生成调性。全部使用 8 步、`lyrics="[Instrumental]"`、WAV 源文件。
- 原始 WAV 与完整任务回执位于 `.gitignore` 排除的 `output/music/`，路径见参数表。网关凭证没有写入项目。

## 循环处理

复用 `loop_intro.py`：保留一次性前奏，起点吸附到起音；在整小节附近选择终点；最后一小节交叉淡入起点之前的一小节；终点后保留 0.25 秒解码余量。固定增益与限幅统一响度，避免动态响度处理让同一接缝两侧出现不同增益。

```sh
# 已确认的第四关；其余关的 bpm/start_hint/end_limit 见 battle-levels.json。
python3 tools/audio/loop_intro.py \
  output/music/level4-ace-20261024-battle-v2/level4-battle-v2-original.wav \
  public/audio/bgm_level4.mp3 132 7.27 52 -16

python3 tools/audio/check.py public/audio/bgm_level{4,5,6,7,8,9,10}.mp3
```

## 验证记录

- 七首 MP3 完整解码通过；重复接缝样本的最佳时间偏移均为 0，编码后的整体响度为 −16.4 至 −16.2 LUFS。
- Chrome 实测 28 组：七首 × MP3/WebM × 44.1/48 kHz。均可通过 `decodeAudioData` 解码，循环点位于缓冲区内；真实 `OfflineAudioContext` 循环跳转后的样本与循环起点对应，未出现静音间隙或超阈值跳变。
- 实际 Phaser 场景逐关启动验证：第 4–10 关均进入 `FilePlayer`，加载对应 WebM，`loop=true` 且循环点匹配；验证时 AudioContext 处于 running。测试页屏蔽存档写入，结果保存于 `output/music/battle-levels-20261024/game-verification.json`。
- 临时循环检查与接缝试听页：开发服务的 `/output/music/battle-levels-20261024/browser-check.html`。该页位于忽略目录，不随生产构建发布。
- `npm run build` 通过；构建仍提示原有 `fusion-pixel-12px.woff2` 路径留待运行时解析。

### 寒江暴风雪修订版

第七关重新生成 96 秒音轨，128 BPM、D minor，突出风啸、空旷冰冷弓弦、气息低箫与克制的金属短击。随后用 `hanjiang_wind.py` 加入确定性合成的宽声场阵风与冰雪噪声（RMS 比原音乐低 11 dB），避免只靠配器名称暗示寒冷。风声与配乐一起切循环；这是音乐中的持续环境层，不与游戏实时暴风雪事件同步。

```sh
python3 tools/audio/hanjiang_wind.py \
  output/music/level7-blizzard-v2-20261024/level7-original.wav \
  output/music/level7-blizzard-v2-20261024/level7-blizzard-mix.wav
# 然后按 battle-levels.json 的第七关 loop_processing 参数运行 loop_intro.py。
```

新循环点 7.51–88.13 秒，主体 80.62 秒；MP3 接缝最佳偏移 0、相对误差 0.026，响度 −16.3 LUFS。上一版成品与参数保存在 `output/music/level7-blizzard-v2-20261024/previous/`。

寒江修订版再次通过 Chrome 的 4 项解码与真实循环跳转检查（MP3/WebM × 44.1/48 kHz），循环后样本误差为 0；新素材已包含于通过构建的 dist。详情见 `output/music/level7-blizzard-v2-20261024/browser-verification.json`。

### 前三关地形氛围修订

第 1–3 关与第一关紧张版各生成 112 秒。环境层由 `early_ambience.py` 合成：`road` 是荒风与枯草摩擦，`bamboo` 是竹叶簇拥摩擦与柔和竹腔擦鸣，`mountain` 是穿谷风与低频岩壁回响。声底 RMS 分别比音乐低 14、12、14 dB；第一关两版使用相同 road 种子。风声与音乐一起循环，不与实时地形事件同步；不制作与游戏预警相混淆的狼嚎、怪叫和落石撞击。

```sh
python3 tools/audio/early_ambience.py \
  output/music/early-levels-20261024/level2-original.wav \
  output/music/early-levels-20261024/level2-mix.wav bamboo
# 各曲混音再按 battle-levels.json 的 loop_processing 参数运行 loop_intro.py。
```

四段新 MP3 的接缝最佳偏移均为 0，响度为 −16.5 至 −16.4 LUFS。原版 MP3/WebM 与循环点备份在 `output/music/early-levels-20261024/previous/`，原始生成参数、回执和处理记录位于同级目录。第四至十关音频已用 SHA-256 确认不受本次重做影响。

前三关修订版验证：16 项 Chrome 解码与真实循环跳转检查通过（四段 × 两格式 × 两采样率）。实际 Phaser 场景载入四段均为 FilePlayer；调用第一关原有半场 timeline 回调后，紧张版开始播放且普通版进入淡出。测试页屏蔽存档写入；检查数据分别保存于 `output/music/early-levels-20261024/browser-verification.json` 和 `game-verification.json`。`npm run build` 通过（保留原有字体路径提示）。

### 第一、二关推进版 v2（2026-10-25）

针对“偏平缓”的反馈，重新生成第一关普通版（128 BPM）、紧张版（144 BPM）与竹林（140 BPM）：鼓点、快速短拨弦与短促管乐从开头即进入，减少长音、空拍和舒缓探索段。环境层相对原版再退后 2 dB（road −16 dB、bamboo −14 dB），整曲响度保持统一。生成要求中的 BPM 与动机仍以实际听感验收为准。

`early_ambience.py` 新增可选第四参数 relative_db，默认值保持不变。例如生成竹林环境混音时，末尾传 `bamboo -14`。本次来源和处理参数仍记录于 `battle-levels.json`，上一版成品与参数保存在 `output/music/early-drive-v2-20261025/previous/`。第三至十关音频保持原样。

推进版验证：三段 MP3 接缝最佳偏移均为 0，响度为 −16.4 至 −16.3 LUFS；12 项 Chrome 解码与真实循环跳转检查通过。实际 Phaser 场景三段均加载对应 WebM 与循环点，第一关半场切换时普通版正常淡出。`npm run build` 通过（保留原有字体路径提示），dist 中六个新音频与 public 一致；第三至十关共 16 个音频文件 SHA-256 未变。检查数据保存于 `output/music/early-drive-v2-20261025/browser-verification.json` 和 `game-verification.json`。
