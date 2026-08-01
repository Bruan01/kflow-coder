<div align="center">

# KFlow Code (KFC)

**从第一性原理构建的、以学习为先、可验证的编程智能体。**

KFC 逐个复刻编程智能体的核心机制 —— 配置、流式输出、受控 Agent Loop、
类型化工具注册表与有界工作区 —— 每一步都由真实问题验证换得，
而不是从黑盒中直接借用抽象。

![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-10.11.0-F69220?logo=pnpm&logoColor=white)
![Validated by](https://img.shields.io/badge/validated%20by-Zod-3E67B1)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

</div>

---

**简体中文** · [English](./README.md)

---

## 目录

- [关于本项目](#关于本项目)
- [特性](#特性)
- [当前状态](#当前状态)
- [环境要求](#环境要求)
- [安装](#安装)
- [用法](#用法)
  - [交互式工作台](#交互式工作台)
  - [Ask](#ask)
  - [工作区 Agent](#工作区-agent)
  - [Doctor](#doctor)
  - [快速配置向导](#快速配置向导)
- [配置](#配置)
- [安全模型](#安全模型)
- [错误契约与退出码](#错误契约与退出码)
- [架构](#架构)
- [文档](#文档)
- [路线图](#路线图)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

---

## 关于本项目

成熟的编程智能体已经能够自动化很大一部分软件开发工作，但仅仅使用它们，
无法解释它们**为何可靠**、**如何失败**，以及**如何改变它们的边界**。
KFlow Code 通过亲手构建这些机制本身来回答上述问题。

项目每次只验证一个机制，使实现、实验、架构决策与学习笔记始终保持关联。
每个阶段都必须产出可复现的证据 —— 而绝不只是"代码看起来写完了"。

## 特性

- **受控 Agent Loop** —— 与协议无关、有界的状态机（`ask` / `agent`），
  从设计上保证可终止，并返回结构化结果。
- **类型化工具注册表** —— 每个工具都是类型化、经 Zod 校验的契约；
  参数在注册表边界校验，而非在模型内部。
- **规范工作区边界** —— 所有工作区工具拒绝路径穿越与外部符号链接，
  隐藏 `.git`，并强制文件 / 搜索 / 输出限制。
- **默认安全** —— 观察类工具默认开启；编辑与执行类工具注册但默认关闭，
  每次调用都需显式确认（`Yes` / `No` / `Tell me why?`）。
- **协议无关的 Provider 层** —— OpenAI 兼容的 Chat Completions 与
  Responses 适配器共享同一个内部 `ModelProvider` 契约。
- **交互式 KFLOW 工作台** —— 仅 TTY 的备用屏幕会话，包含时间线、
  实时状态、终端 Markdown 投影与中文命令菜单。
- **只读诊断** —— `kfc doctor` 在本地校验运行时与配置，
  绝不联系 Provider。
- **LR Machine** —— 本地学习仪表盘，带允许列表核心源码的不可变 HTML 快照。

## 当前状态

| 阶段      | 范围                                                   | 状态      |
| --------- | ------------------------------------------------------ | --------- |
| **P0**    | 工程骨架、配置与错误边界、Doctor、Quickstart           | ✅ 已验收 |
| **P1**    | 单轮模型调用、流式输出、取消、协议适配器               | ✅ 已验收 |
| **P2**    | Agent Loop、工具注册表、只读工作区工具、工作台         | ✅ 已实现 |
| **P3**    | 最小权限的写 / Shell、逐次确认、`git_diff`             | ✅ 已实现 |
| **P4–P8** | 事件驱动核心、会话持久化、上下文、可验证完成、扩展能力 | 🚧 规划中 |

> 注意：`openai-responses` 与 Anthropic Messages 的 **Tool Calling** 尚未实现。
> 目前 Tool Calling 需要 `openai-chat-completions`；其它协议会被显式拒绝，
> 而不是静默回退。

## 环境要求

- **Node.js 22 或更高版本**
- **pnpm 10.11.0**（项目通过 `packageManager` 固定版本）

## 安装

```bash
git clone <your-repository-url>
cd kflow-code
pnpm install          # 依据 pnpm-lock.yaml 恢复依赖
pnpm build            # 以严格 TypeScript 检查编译 src/
pnpm kfc --help       # 冒烟测试本地 CLI
```

## 用法

### 交互式工作台

```bash
pnpm build
pnpm kfc
```

在 TTY 中，`kfc` 会先播放一段短暂的全宽数字雨动画，逐步汇聚成
七行亮白 ASCII `KFLOW CODE` 徽标，然后进入 KFLOW 备用屏幕工作台。
禁用颜色的终端会保留动画但去掉 ANSI 颜色；极窄终端回退为安全居中的纯文本。

- 顶部区域是**可滚动的会话时间线**；状态栏与多行编辑器固定在底部。
- 使用 `↑` / `↓` 或 `PageUp` / `PageDown` 浏览历史。
- 有意禁用鼠标上报，保留终端原生的文本选择与复制行为。
- `Esc` / `Ctrl+C` 仅取消当前请求。

**实时状态** —— 模型请求进行中时，状态栏显示 spinner 与 `模型思考中`。
进入工具调用时切换为 `执行工具: <name> · <target>`，
例如 `执行工具: read_file · 文件: src/interactive/workbench.ts`，
且不会打印文件内容或内联密钥。请求结束时回到 `Ready`、`Cancelled` 或 `Error`。

**安全的工具摘要** —— 每次调用后时间线会添加一条安全结果摘要，例如
`↳ read_file · 读取 12 行 · 9ms` 或 `↳ git_diff · 2 个文件 · +3/-1 · 12ms`。
失败、超时与截断的结果会被标记，而不暴露原始输出。`git_diff` 从不打印完整
补丁内容；它只报告已跟踪 / 未跟踪文件、行数摘要，以及某路径在会话开始前
是否已是脏状态。

**终端 Markdown** —— 助手的回复会经过轻量 Markdown 投影
（标题、列表、引用、强调、行内代码、围栏代码块）；
不支持的语法回退为安全文本。低亮度分割线分隔多轮对话。

**命令菜单** —— 输入 `/` 打开中文命令菜单：

| 命令      | 作用                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| `/help`   | 以中文显示所有命令与快捷键                                                                                          |
| `/status` | 安全显示已解析的 Provider 配置、模型、超时、凭据是否存在、Agent 步数上限、已启用工具数、消息 / 轮次计数、Token 用量 |
| `/tool`   | 实时工具管理器：`↑`/`↓` 选择，`Space` 启用 / 禁用，`Enter`/`Esc` 返回                                               |
| `/themes` | 实时切换终端主题；持久化到用户配置                                                                                  |
| `/clear`  | 请求清空内存上下文与可见时间线（输入 `y` 确认）                                                                     |
| `/exit`   | 恢复光标与之前的终端屏幕                                                                                            |

在非 TTY 输入 / 输出环境中，无参数 `kfc` 会打印帮助而不是启动交互进程。

### Ask

```bash
pnpm build
pnpm kfc ask "解释 KFlow Code"
```

- 发送单条用户消息，**不注入隐藏系统提示**，不持久化对话。
- 模型文本流式输出到 stdout；安全的完成摘要写入 stderr，
  使 stdout 保持可管道化：

```text
[kfc] finish=stop ttft=123ms total=456ms tokens=12/4/16
```

- `Ctrl+C` 取消进行中的 Provider 请求，返回退出码 `130`。

### 工作区 Agent

```bash
pnpm build
pnpm kfc agent "查看当前工作目录下的主要文件，并总结项目用途"
```

`agent` 与 `ask` 刻意区分：

- 创建以**当前工作目录**为根的工作区工具面。
- 默认启用观察类工具（`list_directory`、`read_file`、`grep`、`find_files`）；
  编辑类（`apply_patch`、`write_file`）与执行类（`shell`）
  保持关闭，直到在 `/tool` 菜单中显式启用。
- 默认运行在**无界长任务模式**：它会在模型停止响应、Provider/上下文/工具
  失败，或用户以 Esc/Ctrl+C 中断时结束；不存在任意的 8 轮截断。
- 模型文本流式输出到 stdout。
- Tool Calling 需要 `openai-chat-completions`（包括配置好的
  DeepSeek 兼容目标）。

### Doctor

```bash
pnpm build
pnpm kfc doctor
```

检查 Node.js 22+、已解析的配置路径、Base URL、模型与 API Key 是否存在。
它**从不**调用 Provider，也**从不**泄露密钥。当环境变量已提供所需值时，
缺少配置文件仅作为警告。参见 [docs/doctor.md](docs/doctor.md)。

### 快速配置向导

```bash
kfc --quickstart   # 或：kfc --qs
```

一个仅 TTY 的交互式助手，引导配置协议、自定义 OpenAI 兼容 Base URL、
模型、超时与隐藏的 API Key —— 仅在明确确认明文存储之后。
它没有厂商预设、拒绝静默覆盖、将密钥排除在 `config.json` 之外，
并在原子私有写入后运行 Doctor。参见 [docs/quickstart.md](docs/quickstart.md)。

## 配置

KFC 按以下优先级解析配置：

```
环境变量  >  用户配置文件  >  默认值
```

支持的协议为 `openai-chat-completions`（默认）与 `openai-responses`；
协议选择是显式的，绝不自动推断。

| 变量                   | 用途                                                  |
| ---------------------- | ----------------------------------------------------- |
| `KFC_API_KEY`          | API Key（首选来源；参见密钥策略）                     |
| `KFC_PROTOCOL`         | 协议：`openai-chat-completions` 或 `openai-responses` |
| `KFC_BASE_URL`         | 自定义 OpenAI 兼容 Base URL                           |
| `KFC_MODEL`            | 模型名称                                              |
| `KFC_TIMEOUT_MS`       | 请求超时（毫秒）                                      |
| `KFC_CONFIG_PATH`      | 用户配置文件路径的可选覆盖                            |
| `KFC_CREDENTIALS_PATH` | 明文凭据文件路径的可选覆盖                            |

参见 [.env.example](.env.example)、[docs/configuration.md](docs/configuration.md)
与 ADR-0002。

### 密钥策略

- API Key **禁止出现在 `config.json`** 与源代码中。
- 密钥只能来自 `KFC_API_KEY` 或与 Base URL 绑定的 `credentials.json`，
  该文件以权限 `0600` 创建。
- 凭据绝不写入日志、绝不未经脱敏序列化、绝不进入 LR Machine 快照。

## 安全模型

- **工作区边界** —— 每个工作区工具都运行在规范根目录内；
  拒绝路径穿越与外部符号链接，隐藏 `.git`，并强制执行文件 / 搜索 / 输出限制。
- **默认最小权限** —— 观察类工具开启；编辑与执行类工具关闭。
  一旦启用，每次编辑 / 执行调用都会在方向键确认菜单处暂停，
  提供 `Yes`、`No` 与 `Tell me why?`。拒绝会以结构化结果返回给 Agent，
  而不是执行操作。
- **工具加固** —— `apply_patch` 只接受一次精确替换，
  `write_file` 拒绝覆盖已有文件，`shell` 默认关闭并限制 cwd、超时、
  环境与输出。`git_diff` 只读，且使用固定的 Git 子进程参数、不经 shell。
- **无破坏性回滚** —— 某轮失败后，工作台会报告已完成 / 失败的工具并给出
  恢复提示；KFC 不会自动执行破坏性回滚。

必要性论证与权限理由参见
[docs/specs/2026-08-01-common-tool-surface.md](docs/specs/2026-08-01-common-tool-surface.md)
与 ADR-0009。

## 错误契约与退出码

领域失败统一继承 `KfcError` 并携带稳定错误码。公开输出只包含安全的消息与
详情；可选的调试字段会被递归脱敏，而原始原因与未知堆栈保持私有。

| 退出码 | 含义          |
| ------ | ------------- |
| `1`    | 内部失败      |
| `2`    | 配置错误      |
| `3`    | Provider 失败 |
| `130`  | 用户中断      |

未知 CLI 选项返回退出码 `1`，附带简短错误且不打印堆栈。
参见 [docs/errors.md](docs/errors.md) 与 ADR-0003。

## 架构

**设计原则** —— 协议无关的核心、轻薄的进程适配器、边界处的显式适配器、
外部边界用 Zod 校验、用结构化错误替代裸异常，以及一次只引入一个架构概念。

```text
src/
├── cli.ts               # 可执行进程适配器（轻薄，不承载核心决策）
├── index.ts             # 包模块入口
├── cli/                 # 纯参数解析、帮助、运行器、包元数据
├── ask/                 # 协议无关的单轮流式消费器
├── agent/               # 受控 Agent Loop、工具执行契约
├── tool/                # 类型化工具、注册表、工作区边界、安全结果
├── provider/            # 协议无关的模型契约 + 协议适配器
├── config/              # Zod 校验的配置、路径、脱敏、主题
├── doctor/              # 本地只读就绪检查
├── quickstart/          # 交互式 TTY 设置向导
├── interactive/         # ANSI 工作台状态、raw-mode 输入、动画
└── errors/              # KfcError 层次结构与安全格式化
```

**配套工具**

```text
tests/                   # 与 src/ 行为对应的 Vitest 测试
docs/                    # vision、specs、ADR、实验、复盘、学习日志
lr-machine/              # 本地学习仪表盘 + 不可变 HTML 快照
```

LR Machine 会自动归档允许列表中的 `src/**/*.ts` 文件，附带相对路径、行号、
职责与截断元数据。在单 Agent 的读取—修改—测试—验证闭环稳定之前，
不要添加 MCP、Skills、Hooks、subagents 或高级 UI。

## 文档

| 文档                                           | 用途                                  |
| ---------------------------------------------- | ------------------------------------- |
| [docs/vision.md](docs/vision.md)               | 目标、非目标、学习标准                |
| [docs/configuration.md](docs/configuration.md) | Provider 字段、优先级、路径、密钥策略 |
| [docs/provider.md](docs/provider.md)           | 协议、流不变量、适配器边界            |
| [docs/errors.md](docs/errors.md)               | 错误类别、退出码、重试规则            |
| [docs/doctor.md](docs/doctor.md)               | 本地就绪检查与范围                    |
| [docs/quickstart.md](docs/quickstart.md)       | DIY Provider 设置与密钥边界           |
| [docs/tool-registry.md](docs/tool-registry.md) | 工具契约与注册表语义                  |
| [docs/decisions/](docs/decisions/)             | ADR-0001 … ADR-0010 架构决策          |
| [docs/experiments/](docs/experiments/)         | 可复现的真实命令验收记录              |
| [docs/reviews/](docs/reviews/)                 | 阶段验收复盘与进入决策                |
| [docs/learning-log.md](docs/learning-log.md)   | 假设、实验、证据、教训                |
| [TODO.md](TODO.md)                             | 分阶段实现的执行路径                  |

## 路线图

- **P0** 工程骨架与边界 ✅
- **P1** 单轮模型调用 ✅
- **P2** Agent Loop、工具注册表、只读工具、工作台 ✅
- **P3** 最小权限的写 / Shell ✅
- **P4** 事件驱动核心与会话持久化 🚧
- **P5** 上下文管理与长会话 🚧
- **P6** 可验证完成与完成报告 🚧
- **P7–P8** Skills → Hooks → MCP，随后 subagents 与 worktrees（锁定）🔒

扩展（MCP、Skills、Hooks、subagents）保持锁定，直到单 Agent 闭环可靠为止
—— 抽象必须由真实问题换得，而不是由想象预先买单。

## 参与贡献

本项目从第一性原理构建，并遵循严格的学习契约：

1. 一次只推进一个编号任务 —— 当前任务未验证前，不开启下一项。
2. 每个任务都完成闭环：**问题 → 假设 → 最小实现 → 证据 → 笔记 → 复盘**。
3. "代码写完了"不算完成；只有可复现的证据才算数。
4. 请先阅读 [docs/vision.md](docs/vision.md) 与 [TODO.md](TODO.md)。

如果发现 bug 或缺失验证，请提交 issue，附上失败的命令输出与你正在验证的
阶段。Pull Request 应说明路线图阶段、总结行为与风险、列出验证命令，
并关联相关 ADR。

> 完整的协作指南（学习证据工作流与 PR 检查清单）请见
> [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

KFC 以 [MIT License](LICENSE) 发布。
