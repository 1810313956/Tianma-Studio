# Tianma Studio（天马）· 剧本编排系统

> 未来杯 · 赛道一（Agent 编排创新应用）参赛作品 · 团队 All in · 武昌首义学院
> Windows x64 桌面端 · 便携版免安装 · 内置真实运行数据

一句话说明：把内容生产里三件「说不准」的事——**谁在等谁的哪一次产出、产物回来算不算完成、还要不要再来一轮**——改写成三个代码对象（会话绑定表、可解析结论、带上限的轮次），再让调度器只依赖这三个对象做决策。

---

## 一、下载与安装（三步）

| 包 | 大小 | 内容 |
|---|---|---|
| **[主程序 exe](https://github.com/1810313956/Tianma-Studio/releases/latest/download/Tianma-Studio-2.1.11-win-x64-portable.exe)** | 1.27 GB | 便携版，免安装，双击即用 |
| **[运行数据包](https://github.com/1810313956/Tianma-Studio/releases/latest/download/Tianma-Studio-data-v2.1.11-win-x64.zip)** | 24.9 MB | 已脱敏：用量记录、35 个会话、剧本产物、编排记录文件 |

**步骤**

1. 新建一个空文件夹（路径**不要含中文或空格**最稳妥），把 exe 放进去。
2. 下载数据包并解压，得到 `data` 文件夹，把它放到**与 exe 同级**的位置，目录结构应为：

   ```
   任意文件夹\
   ├─ Tianma-Studio-2.1.11-win-x64-portable.exe
   └─ data\
       └─ Data\
           ├─ cherrystudio.sqlite
           ├─ script-loop-record.json
           ├─ Agents\  Files\  Skills\
   ```

3. 双击 exe 运行。Windows 若弹 SmartScreen，选「更多信息」→「仍要运行」。

启动后左侧应看到 7 个智能体（剧匠·骨架 / 剧匠·落笔 / 剧匠·审稿 / 剧匠 主控等）。进入「剧匠」会话，点面板上的 **开始剧本编排**，即可复现「骨架 → 对照 → 落笔 → 审稿 → …」的 8 跳流程与三轮返修记录。

### ⚠️ 关于 API Key

出于安全考虑，**公开包内所有 API Key 已清空**。要真正调用模型，请自行填写：

> 设置 → 模型服务 → DeepSeek → 填入你自己的 Key（任何兼容 OpenAI Chat Completions 协议的服务均可，改 baseURL 即可）

不填 Key 也能正常打开界面、浏览全部历史会话与运行记录——数据包本身就是完整的。

---

## 二、这个仓库里有什么

```
├─ docs\                     方案书、软件运行报告、项目白皮书（PDF/DOCX）
├─ src-custom\               自研编排层全部源码，保持工程内相对路径
│  ├─ src\main\features\scriptLoop\
│  │  ├─ decide.ts           决策状态机（纯函数，123 行）
│  │  ├─ ScriptLoopService.ts 服务主体：派发、绑定表、轮次、落盘（287 行）
│  │  ├─ text.ts             消息纯文本提取（11 行）
│  │  └─ __tests__\decide.test.ts  9 条决策用例（74 行）
│  ├─ src\main\ipc\handlers\scriptLoop.ts        IPC 处理器（8 行）
│  ├─ src\shared\ipc\schemas\scriptLoop.ts       Zod 严格契约（39 行）
│  ├─ src\renderer\pages\agents\components\ScriptLoopPanel.tsx  编排面板（114 行）
│  ├─ src\shared\config\tianma.ts                对外链接常量（29 行）
│  └─ integration\registration.patch             4 处注册点改动
├─ data-notes\               可读的数据导出（用量总览、会话清单、智能体清单）
└─ NOTICE-AGPL.md            许可与原创边界声明
```

**原创边界（主动声明）**：执行底座是 [Cherry Studio](https://github.com/CherryHQ/cherry-studio) 2.1.10 的 AGPLv3 分支，平台层能力不属于本项目原创，工作区相对上游的 351 个文件变更经抽样核查均为标识串替换（cherry-tools → tianma-tools）与注释同步。原创价值集中在**编排、调度与验证**，即上面 685 行。

判据只有一条：**上游是否已存在这项能力**。上游没有多角色程序化调度——它的多会话是给人手动切换的，智能体之间的「交接」靠自然语言写单据，因此才会出现同一集被派发两版细纲的冲突。本项目补的正是这一段。

---

## 三、运行数据说明

数据快照时间：**2026-11-19 19:45**，取自审核副本，未做人工修订。

| 指标 | 数值 |
|---|---|
| 模型请求总数 | 623 次 |
| tokens（输入 / 输出 / 合计） | 39,649,402 / 1,149,891 / **40,799,293** |
| 其中缓存读取 | 37,177,344（占输入 93.8%） |
| 累计费用 | 2.3446 美元 |
| 会话数 / 助手消息数 | 35 / 69 |
| 智能体 / 知识库 | 7 个（4 个参与编排）/ 12 库、60 条、21 绑定 |

**与白皮书数字的差异，先说清楚**：白皮书口径截至 11-18 01:03（440 次请求 / 27,066,205 tokens / 1.7023 美元），本快照含此后 11-18 至 11-19 的调试会话，因此总量更大。两套数字都对，只是截止时间不同——单次完整编排的成本（8 跳 / 41 请求 / 2,885,529 tokens / 0.3595 美元 / 19 分 10 秒）不受影响。

**脱敏范围**（已执行，可自查）：

- 清空 `user_provider` 表全部 70 条 provider 的 `api_keys`；
- 抹除 `data/Data/Agents/.claude*` 中的 `userID`、`machineID`；
- 未包含 Chromium 缓存、Cookies、登录态、`Network\` 与 `Credentials\` 目录；
- 剧本内容为虚构创作，不含真实个人信息。

---

## 四、复现与测试

```bash
# 1. 取上游基线（2.1.10）后，把 src-custom 覆盖回工程，并应用集成补丁
git clone https://github.com/CherryHQ/cherry-studio.git
git checkout <2.1.10 对应提交>
git apply src-custom/integration/registration.patch

# 2. 装依赖并跑测试
pnpm install
pnpm vitest run src/main/features/scriptLoop/__tests__/decide.test.ts   # 9/9 通过（约 0.6 s）
pnpm tsc --noEmit -p tsconfig.node.json                                 # 退出码 0
```

两条命令都只覆盖**决策规则表**与**IPC 契约**，不覆盖服务主体的派发、绑定、落盘三处逻辑——这是测试体系的结构性缺口，已如实写入报告。

---

## 五、已知缺陷（一并披露）

| 级别 | 缺陷 | 证据 |
|---|---|---|
| 严重 | 编排与人工会话责任边界不清 | 11-18 两次「两版细纲」冲突，00:46:36 主控自报「设定完全不兼容」 |
| 严重 | 回路被重复执行 | 额外 6 个助手回合，多耗 33.2%（957,540 tokens） |
| 严重 | 上下文不裁剪 | 末跳 1,457,778 tokens，占单次运行 50.5%，第 4 轮不可承载 |
| 中等 | 运行态不可续跑 | 进程中断后 run 无法恢复，只能重跑 |
| 中等 | 结论解析强格式耦合 | 正则只认三种结论，模型换句式即判 unreadable |
| 中等 | 缺客观评测指标 | 八维评分由同一模型给出，属同源自评，三轮 64/65/65 未收敛 |

---

## 六、常见问题

- **双击没反应 / 秒退**：检查是否设置了环境变量 `ELECTRON_RUN_AS_NODE`（会让 Electron 应用被当成 Node 脚本执行），清掉后重启资源管理器再试。
- **打开后看不到历史数据**：确认 `data` 与 exe 同级，且层级是 `data\Data\cherrystudio.sqlite`，不要多套一层文件夹。
- **启动时弹安全提示**：应用启动会调用 `reg.exe` 读取系统环境变量，允许即可，不影响功能。
- **模型调用报错**：多半是没填 Key 或 Key 无余额；界面会直接把 missing-agents / already-running / no-brief 等错误码翻成中文提示，不会只抛「启动失败」。

---

## 七、许可

本项目为 AGPLv3 衍生作品，整体（含自研编排层）按 **AGPL-3.0** 发布，详见 [LICENSE](LICENSE) 与 [NOTICE-AGPL.md](NOTICE-AGPL.md)。对外分发修改版须以同许可开源；商业化路径因此设计为「编排层独立模块 + 私有化交付 + 服务收费」。
