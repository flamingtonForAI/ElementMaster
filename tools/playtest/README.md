# Jev 本地试玩

在真实 Phaser 场景里运行第一关剑客，使用独立浏览器上下文的空白 localStorage。不会读取或修改日常浏览器存档。工具不进入正式游戏构建，不需要后端或改动 `src/`。

## 运行

需要 Node 24、Playwright 和本机 Chrome。已有 Codex bundled Playwright 时可以将 `PLAYWRIGHT_MODULE_PATH` 设置为其绝对路径；否则在开发环境安装 Playwright（`npm install --save-dev playwright`）。

先启动现有开发服务：

```sh
npm run dev -- --host 127.0.0.1
```

另一个终端先做浏览器验证，再正式运行：

```sh
node tools/playtest/run.mjs --smoke
node --test tests/playtest-clock.browser.mjs
TYPESAFE_KEY_FILE=/absolute/path/to/harness.md node tools/playtest/run.mjs
```

默认从项目上一级的 `harness.md` 读取 key。文件必须只含一个长度至少 24 的字母、数字、下划线或连字符 token。key 只用于 Node 进程向 `https://api.typesafe.ai/v1/systemone` 发请求，不发送到浏览器、不写日志。不要把凭据文件放到本项目的开发服务器目录中。

环境变量：

- `PLAYTEST_OUT`：新的结果目录；默认 `output/playtest/jev-<seed>-<timestamp>`。
- `PLAYTEST_SEED`：种子，默认 `20261022`。
- `PLAYTEST_URL`：本地 Vite 地址，默认 `http://127.0.0.1:5180/`。
- `PLAYTEST_BROWSER_CHANNEL`：Playwright 浏览器 channel，默认 `chrome`。
- `PLAYWRIGHT_MODULE_PATH`：可选的 Playwright 模块路径。

输出目录必须不存在，避免覆盖或混合实验记录。

固定模型 `jev-1.13.0`；固定时间步 1/60 秒，每次动作至多 30 帧（升级或结束会提前中断）。API 等待期间停止 Phaser 循环；战斗随机流仅在受控初始化、推进帧和确认升级期间启用，避免空闲后台调用消耗种子。升级通过原 HUD 的确认路径执行。卡片和方向选项循环换序，避免总把同一项放首位。API 异常最多尝试三次，没有静默脚本代打。

2026-10-24 修正补间时钟：Phaser 3.90 的 TweenManager 默认读取真实时间，现在试玩桥接让战斗和 HUD 补间共用模拟帧的 delta；API 等待、升级暂停以及恢复时的 `step(0)` 不推进补间。浏览器回归比较无等待与额外等待 650ms 两种运行，检查剑雨、落石在相同模拟帧落地，并检查升级暂停/恢复。这个测试沿用上述 Playwright 路径配置，不调用模型 API。

修复前的试玩记录中，剑雨、落石等在补间完成时结算的伤害会受真实等待时长影响。因此历史脚本/Jev 对照和相关平衡结论需要在新时钟下重跑；旧报告保留为历史记录，不视为修复后的验证结果。

`--smoke` 不调用 Jev，会检查空白初始状态、固定步移动、等待冻结和原升级界面的确认/继续。只有 smoke 会人为发放测试经验；正式运行没有发放、无敌、额外升级或数值改动。

## 输出

- `metadata.json`：模型、种子、时间步及实验限制。
- `decisions.jsonl`：每次决策的状态、完整请求/响应、延迟；不含认证头。
- `events.jsonl`：刷怪、击杀、实际扣血、升级、分钟快照和胜负。
- `result.json`：结算、最终构筑、调用和 token 统计、延迟分位数。
- `start.png`、`time-*.png`、`result.png`：开始、每半分钟和结算画面。
- `failure.json`：基础设施或安全上限中断；不能当作游戏死亡。

运行完成后生成可查看的报告：

```sh
node tools/playtest/report.mjs output/playtest/<run-directory>
```

可在结果目录写 `findings.json`（`[{"title":"...","evidence":"...","next":"..."}]`），再生成报告，将人工核实的线索加入 `report.html`。原始数值在 `summary.json`。

## 限制

仅支持当前第一关剑客；结构化观测包含最多 12 个近敌、拾取物和敌弹，以及各方向的碰撞/危险事实。警告圆和直线从真实特效接口捕获。预测不模拟敌人追逐或冲锋，用于提示而非自动替 Jev 选路。

伤害来源通过原敌人攻击参数和延迟死亡效果追踪；持续伤害没有追溯原施加者，明确标为 unknown。击杀日志中的 combatTime 由第一次 `hitEnemy` 起算，不能直接当作标准 TTK。特效随机与战斗隔离，但其他美术调用仍可能消耗随机数，当前种子不能保证跨美术改动严格配对。

浏览器桥接需要读取部分 TS private 字段，升级 Phaser 或重构游戏后应重跑 smoke。本次没有提取第二套模拟器；统计代表该机器人在可冻结决策条件下的一盘表现，不代表真人通关率。

可用已保存的动作做无 API 回放校验（仍使用新的输出目录）：

```sh
node tools/playtest/run.mjs --replay output/playtest/<run-directory>
```

本次 `jev-xiao-level1-20261022` 首盘发生在随机流限定修复之前，回放校验未通过；原始代码留在该结果目录的 `bridge-used.js`，原始记录没有重写成修复后的结果。修复后的两次约 15 秒 smoke 在额外 30,000 次空闲随机调用干扰下，30 个完整观测状态一致，证据见 `output/playtest/scoped-rng-verification.json`；尚未验证修复后的完整一盘回放。

## 第三关满配对照

```sh
PLAYTEST_PROFILE=level3 PLAYTEST_CHARACTER=xiao PLAYTEST_REGEN=5 node tools/playtest/run.mjs
PLAYTEST_PROFILE=level3 PLAYTEST_CHARACTER=xiao PLAYTEST_REGEN=0 PLAYTEST_POLICY=stay node tools/playtest/run.mjs
```

角色支持 `xiao` / `qingdai` / `moheng`。设定在 `profiles.mjs`：人为授予 25 级、六术 8 级、生命护甲移速修炼等，长生诀为 0 或 5；不增加星图和传承。角色经验锁定，避免后续补点或升级回血混淆；正常药瓶和宝箱保留，并与实际持续回复分别计量。这是合成的满配压力测试，并非自然 25 级开局。`PLAYTEST_POLICY=stay` 不调用 Jev，只站定，用于保留同样策略的回复对照。

原版第一关仍是默认模式。第三关模式的日志增加 HP 收支、最低生命、满血时间、掉落回血等；`level3-report.mjs` 汇总预设的九个结果目录，并核对每局 HP 收支。

本轮完整站定回放在第 31 步发现击杀差异，尚不能保证严格确定性；短程随机隔离测试不足以证明整盘可复现，九局报告明确保留这一限制。

## 25% 护甲下限：同配置前后对照

该历史对照的代码在 `GameScene.hurtPlayer` 和 `PuppetManager.hurt` 使用扣甲前 incoming 的 25% 下限：`max(1, ceil(incoming*0.25), round(incoming-armor))`。玩家 incoming 包含暴击、五行、抗性；傀儡包含石身和外壳五行。此轮未改厚土诀或长生诀。

新九局使用 `PLAYTEST_VARIANT=armor-floor25`，目录为 `output/playtest/level3-floor25-<character>-regen<0|5>-<stay|jev>`；其他环境参数沿用上一轮。`metadata.json` 增加 variant 与两处战斗源码、桥接及构筑/提问文件的 SHA-256，供核查同批次代码一致性。

九局齐全后生成新汇总及前后对照报告，不覆盖旧报告：

```sh
PLAYTEST_RUN_PREFIX=level3-floor25 node tools/playtest/level3-report.mjs output/playtest/level3-floor25-comparison-20261022 --summary-only
node tools/playtest/armor-floor-report.mjs output/playtest/level3-floor25-comparison-20261022
```

报告逐项断言前后的初始构筑、PlayerStats 与本命相同，并验证九局新源码哈希一致；HP 收支仍逐局校验。旧数据来自 `level3-comparison-20261022/summary.json`。两组均是单种子观测，严格回放偏差仍存在，Jev 新跑时也会选择不同动作，不能把前后数值差异直接当作相同命中序列的因果效果。正常成长的第三关测试属于下一步，本轮不执行。

## 正常成长的第三关

`campaign.mjs <xiao|qingdai|moheng>` 在独立存档里实际打前两关，固定脚本负责移动和选卡。每关最多四次尝试，所有死亡、奖励、消费都保留；失败不会伪造通关或解锁。`progression.js` 仅花已有灵石和合法点数，按原价格购买基础生存修炼、用 canLight 检查星图连通、按已通关里程碑分配传承。

```sh
node tools/playtest/campaign.mjs moheng
node tools/playtest/natural-level3.mjs moheng --script
node tools/playtest/natural-level3.mjs moheng 20261022
```

第三关从真实前两关结算存档开始（每角色固定一份，测试结果不串入别的种子），局内重新 1 级单术，真实经验、升级与宝箱全部开启。`natural-level3.mjs` 默认跑三个 Jev 种子，传数值种子可单独跑一局，`--script` 用同样开局做一局脚本参考；已有 result.json 会跳过，不覆盖结果。

正常成长增加本体 HP 收支中的 maxHpGains、最低生命比例、傀儡实际掉血、破碎次数、完全无傀儡时间。`natural-report.mjs` 汇总三角色共 12 局及前两关的完整成长账本，验证局内从 1 级开始、每角色所有种子属性与开局存档一致、HP 收支正确。

自动化浏览器过滤 Vite 的 full-reload/update/prune 消息，冻结本局已加载模块，避免开发重载抹掉 __playtest；lifecycle.jsonl 记录导航、崩溃及忽略的热更新。`PLAYTEST_HMR_PROBE=1` 的 smoke 会主动触发 bridge.js 的 mtime 更新并验证控制入口仍在。基础设施中断必须保留为 interrupted 记录，不能当作游戏死亡；重新使用原始存档与种子跑完整一局。


## 2026-10-24 技能与护甲定点检查

当前玩家及傀儡护甲已改为递减收益，见 `src/game/damage.ts`；上面的 25% 下限数据是历史样本。

```sh
node tools/playtest/balance-probe.mjs output/balance-new-run
```

在隔离浏览器中调用实际技能、投射物和异常结算，六角色各测技能 1/8 级、五种目标元素。角色等级等于技能等级，无修炼、星图或心法；关闭暴击并归一地气。靶固定在前方 35px、无护甲且高血量，玩家和傀儡免伤；预热 2 秒后采样 20 秒，输出直接、毒、火、流血 DPS。这是持续接触的单靶检查，不代表移动怪命中率、范围总伤害或真人通关率。输出目录必须新建，不覆盖旧结果。
