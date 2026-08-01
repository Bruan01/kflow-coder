# KFlow Code Learning Log

本日志记录认知变化，而不是罗列完成了多少代码。每项任务应保留初始假设、实验、证据、错误和下一步。

## 2026-07-29 / P0.1 定义项目范围

- **第一性问题：** 既然已经有成熟编程 Agent，为什么仍要亲手实现 KFC？
- **我的初始假设：** 仅会使用现成 Agent 不足以形成独立开发能力；需要亲手理解 MCP、Skills、会话、沙箱、Hooks、权限、分支和命令系统背后的机制。
- **最小实验：** 不写代码，先把项目目的、首版边界和“真正学会”的判定标准写成可检查的约束。
- **观察到的证据：** `docs/vision.md` 已明确 KFC Mini v0.1.0 的唯一核心闭环、首版非目标和七项学习标准。
- **假设哪里错了：** 暂无技术假设被实验推翻；但已确认“接近成熟产品”不是首版成功标准，建立可解释、可验证的因果理解才是。
- **得到的可复用原则：** 在实现之前先定义问题、非目标和完成证据，可以降低范围膨胀，并让后续技术选择具有判断依据。
- **尚未理解：** CLI、Provider、Agent Loop、权限和验证机制应如何形成最小且稳定的边界。
- **下一步：** P0.2 初始化 TypeScript 工程，只建立支持运行、测试和诊断所需的最小工具链。

## 2026-07-29 / P0.2 初始化工程

- **第一性问题：** 一个尚无 Agent 功能的仓库，至少需要哪些能力才能安全实验？
- **我的初始假设：** 需要可重复安装、编译、自动验证、静态检查和统一格式；这些能力应与业务功能分离。
- **最小实验：** 建立 Node.js 22+、pnpm、严格 TypeScript、Vitest、ESLint 和 Prettier 配置，仅加入一个无业务含义的导出及 Smoke Test。
- **观察到的证据：** Node.js `v24.14.0`、pnpm `10.11.0`；`pnpm build`、`pnpm test`、`pnpm lint`、`pnpm format:check` 全部退出码为 0；Vitest 通过 1 个测试。
- **假设哪里错了：** “直接安装最新版就最稳”是错误的。初次安装得到 TypeScript `7.0.2`，超出 `typescript-eslint 8.65.0` 声明的 `<6.1.0` 范围；根据约束交集调整为 TypeScript `6.0.3` 后消除直接兼容性问题。
- **得到的可复用原则：** 依赖选择不是追逐最大版本号，而是寻找全部约束的交集；安装成功只是现象，构建、测试和静态检查通过才是证据。
- **尚未理解：** CLI 参数解析应如何与核心逻辑分离；Vitest 的 Rolldown 依赖仍报告一个不影响当前 macOS 验证的可选 WASI peer warning，后续升级依赖时重新检查。
- **下一步：** P0.3 实现 `kfc --help` 和 `kfc --version`，先定义 CLI 边界再选择参数解析方式。

## 2026-07-29 / LR.1 学习日志展示机器

- **第一性问题：** 如何同时回答“项目现在是什么状态”和“过去某次开发结束时是什么状态”，并让进度、笔记与代码证据保持一致？
- **我的初始假设：** 只维护静态网页会失去实时性，只维护动态页面会失去历史；需要共享同一数据模型的实时服务与不可变 HTML 快照。
- **最小实验：** 使用 Node.js 内置 HTTP 和文件系统建立只读服务，采集 `TODO.md`、学习日志、愿景、包命令、TypeScript 导出和固定 Git 状态；同一渲染器生成实时页面与自包含 HTML。
- **观察到的证据：** LR Machine 专项测试 4 个文件、6 个测试全部通过；桌面端和 390px 窄屏均完成 Playwright 验收，无控制台错误和页面横向溢出；路径穿越请求被拒绝；页面展示 8 个阶段、2 条既有学习记录和 1 个真实导出 API。
- **假设哪里错了：** “能运行 Python 就能直接运行 Playwright”不成立；系统默认 `python3` 没有 Playwright，而 Anaconda Python 已具备该模块；端口测试在受限沙箱内返回 `EPERM`，根因是执行环境禁止监听。首次快照还发现 pnpm 会把参数分隔符 `--` 传给脚本，生成器必须先归一化 CLI 参数，不能假设业务参数从第一个位置直接开始。
- **得到的可复用原则：** 当前状态应从真实项目文件派生，历史状态应以不可变快照保存；两者必须复用同一采集器和渲染器，否则迟早分裂。浏览器接口保持只读，生成快照只能由本地显式命令触发。
- **尚未理解：** 随着 API 和笔记增长，单页信息密度、快照数量和 TypeScript AST 描述深度应在什么信号下升级；在真实需求出现前不引入数据库和前端框架。
- **下一步：** 回到 P0.3，实现最小 CLI 入口，并在完成后按固定流程生成下一份 HTML 快照。

## 2026-07-29 / P0.3 建立最小 CLI 入口

- **第一性问题：** CLI 输入、程序决策和终端输出为什么必须分离，怎样用最小机制把参数稳定地转换为可验证行为？
- **我的初始假设：** 当前只有 help 和 version 两个选项，Node.js 内置 `util.parseArgs` 足够；无需提前引入 Commander。参数解析应返回结构化命令，运行器通过注入的版本和 I/O 执行，入口文件只连接 `process`。
- **最小实验：** 先写 help、version、未知选项和未实现位置参数的测试，再实现纯 `parseCliArgs`、`runCli`、帮助文本、包版本读取和带 shebang 的 `src/cli.ts`。
- **观察到的证据：** 全量 Vitest 7 个文件、18 个测试全部通过，其中新增 10 个 CLI 行为测试；`pnpm build`、Lint 和格式检查通过；编译后的 `pnpm kfc --help` 与 `--version` 返回退出码 0，`--unknown` 输出简明错误且返回退出码 1，不包含调用栈，也不读取配置或访问网络。
- **假设哪里错了：** 安装 `@types/node` 不代表 TypeScript 会自动启用 Node 类型，仍需在 `tsconfig.json` 声明 `types: ["node"]`。第一次失败构建还发现 TypeScript 默认可能在有错误时继续写入 `dist`，造成“产物能运行但构建已失败”的假象，因此加入 `noEmitOnError: true`。验收脚本也暴露 `status` 是 zsh 只读变量，这属于测试工具错误而非产品错误。TODO 推进到 P0.4 后，LR Machine 集成测试因写死“当前任务必须是 P0.3”而失败，说明测试应约束稳定的数据契约，而不是冻结必然变化的业务内容。
- **得到的可复用原则：** 最外层入口应该尽可能薄：环境输入在边缘读取，核心行为使用普通数据和依赖注入，最后显式返回退出码。任何失败构建都不应产生可被误用的新产物。框架只有在内置机制无法控制复杂度时才值得引入。
- **尚未理解：** 当子命令、共享选项和帮助层级增长时，`util.parseArgs` 的维护成本会在什么信号下超过引入 CLI 框架的成本；在真实复杂度出现前不做迁移。
- **下一步：** P0.4 建立配置边界，明确环境变量与用户配置的来源、优先级、校验和密钥脱敏。

## 2026-07-29 / LR.5 核心代码复习层

- **第一性问题：** 学习快照如果只有结论和 API 名称，却没有当时真正运行的核心代码，能否支持日后还原机制与复习调用链？
- **我的初始假设：** 当前源码规模很小，自动归档受限的 `src/**/*.ts` 比手工维护“代码摘录”更可靠；实时页面和离线快照必须继续共用同一数据模型。
- **最小实验：** 新增源码采集器，只读取普通 TypeScript 文件并忽略声明文件、符号链接和其他目录；记录相对路径、职责、分组、总行数、展示行数和截断状态，在 Dashboard 中提供折叠、行号、横向代码滚动与复制。
- **观察到的证据：** 页面自动归档 6 个核心源码文件、共 127 行，`src/cli/parse-args.ts` 的 48 行可以完整展开和复制；LR Machine 5 个测试文件、9 个测试通过；桌面端与 390px 窄屏浏览器验收通过，无控制台错误和整页横向溢出。
- **假设哪里错了：** 首次浏览器检查连接到了仍在 `4310` 运行的旧服务，说明修改源码不会让既有 Node 进程自动刷新，验收必须确认服务实例版本。移动端初版还因代码行的 `max-content` 宽度泄漏到页面而产生横向溢出；正确修复是约束代码容器，让长行只在 `<pre>` 内滚动，而不是全局隐藏页面溢出。
- **得到的可复用原则：** 学习证据应同时保存目标、认知、验证和实际代码；源码采集必须采用白名单与上限。内部横向滚动是代码阅读需求，整页横向滚动则是布局错误，两者不能混淆。
- **尚未理解：** 何时需要从“归档全部 src”升级为按任务标注核心文件，以及语法高亮、代码差异和调用链标注是否带来足够学习收益；在源码规模和复习痛点出现前不增加复杂度。
- **下一步：** 回到 P0.4 配置边界；完成配置实现后，新快照将自动包含相关核心代码。

## 2026-07-29 / P0.4 配置边界

- **第一性问题：** 模型地址、模型名称和密钥从哪里来，多个来源冲突时听谁的，配置失败时怎样提供证据而不泄露秘密？
- **我的初始假设：** 普通配置与密钥不应拥有相同生命周期；首版使用“环境变量 > 用户配置文件 > 默认值”，API Key 只允许来自环境变量，所有文件读取和环境输入都必须可注入测试。
- **最小实验：** 使用 Zod 定义配置文件与最终配置 Schema，实现 XDG/用户目录路径解析、可选文件读取、环境覆盖、60 秒默认超时、结构化 `ConfigError` 和 `redactConfig`，不接入 CLI 或模型网络调用。
- **观察到的证据：** 全量 Vitest 11 个文件、31 个测试通过；环境变量单独加载、文件与环境合并、环境覆盖、缺失文件、非法 JSON、非法 URL、超时范围、文件内 API Key 拒绝和脱敏均有测试。编译后模块使用虚拟路径完成显式泄露检查，脱敏对象和结构化错误均不包含测试密钥，也未读取真实 `~/.config/kfc`。
- **假设哪里错了：** 初版错误归一化把“缺少 base URL”和“提供了非法 URL”都映射成“URL 非法”，抹平了用户应采取的不同修复动作。Zod 已提供 `invalid_type` 与 `invalid_format`，边界层应保留有决策价值的差异，而不是为了统一而过度统一。
- **得到的可复用原则：** 配置优先级必须显式且可测试；秘密配置需要比普通配置更严格的来源与输出策略。测试通过依赖注入控制文件系统和环境，而不是触碰开发者真实主目录。结构化错误的价值在于告诉调用方下一步能做什么。
- **尚未理解：** 配置错误如何与 Provider 错误、用户中断共享统一基类，以及哪些信息进入用户输出、哪些只进入调试日志；这属于 P0.5 的错误边界。
- **下一步：** P0.5 定义统一 `KfcError`，让 CLI 能依据错误类别决定消息、退出码和调试信息，同时保持密钥脱敏。

## 2026-07-29 / DEC-002 首个真实 Provider 选择

- **第一性问题：** 首个模型服务应该只是最容易调用，还是应该帮助暴露 Provider 抽象中的真实差异？
- **我的初始假设：** 首个目标应支持 OpenAI-compatible 基础协议，同时在角色、参数、Thinking 与工具调用上存在足够真实差异，迫使我们验证边界而不是假设兼容。
- **最小实验：** 暂不发起网络请求，只核验官方接口、当前模型名称和兼容差异，并记录可替换配置、代价与重新评估条件。
- **观察到的证据：** 截至 2026-07-29，DeepSeek 官方 OpenAI 格式 Base URL 为 `https://api.deepseek.com`，当前首选目标记录为 `deepseek-v4-flash`；配置示例、TODO 和 ADR 已同步，API Key 仍保持环境变量专用。
- **假设哪里错了：** “OpenAI-compatible 就可以无差别替换”过于粗糙；兼容主要解决接入形状，不能自动保证角色、Token 参数、Thinking、流式事件和 Tool Calling 行为一致。
- **得到的可复用原则：** 选择首个集成对象时，应优先最大化学习到的边界，而不是最大化表面上的顺利。外部模型名称只能存在于配置与带核验日期的决策记录中，不能进入 Core 类型。
- **尚未理解：** DeepSeek V4 Flash 的真实流式事件、错误响应、Thinking 与 Tool Calling 轨迹；必须等 P1 用真实请求和 Fixture 验证。
- **下一步：** 继续 P0.5 统一错误边界，再通过 P0.6 `kfc doctor` 检查 DeepSeek 配置，P1 才发起真实模型调用。

## 2026-07-29 / P0.5 统一错误边界

- **第一性问题：** 错误既要驱动程序决策，又要帮助用户修复问题，还不能泄露未知异常、Provider 响应或密钥；这三种目标如何共存？
- **我的初始假设：** 错误应分成稳定的机器字段与明确的安全展示字段。category、code、exitCode 和 retryable 用于控制流；message/details 用于用户；debugDetails 必须显式提供并按敏感键脱敏；cause 不进入标准序列化。
- **最小实验：** 实现 `KfcError`、`ProviderError`、`UserInterruptedError`、未知错误归一化和 CLI 展示器，让现有 `ConfigError` 继承统一基类；暂不接入真实 Provider 和日志系统。
- **观察到的证据：** 全量 Vitest 14 个文件、43 个测试通过；ConfigError 成为 KfcError，Provider 六类错误具有固定退出码和重试属性，用户中断使用退出码 130。公开 JSON 不包含 debugDetails、cause 或 stack；Debug 展示保留 requestId 等安全字段并递归隐藏 API Key、Authorization 和 Token；未知 Error 的原始 message 与 stack 不被输出。
- **假设哪里错了：** 在 `exactOptionalPropertyTypes` 下，“字段缺失”与“字段存在但值为 undefined”不同。ProviderError 初版把未提供的 details、debugDetails 和 cause 显式传成 undefined，严格编译失败；正确做法是只在真实存在时把字段展开给基类，而不是放宽类型约束。
- **得到的可复用原则：** 错误输出本身就是安全边界。统一错误不是把所有失败变成同一句话，而是统一机器契约、保留用户下一步行动所需的差异。未知信息默认不可信，不能因为开启 debug 就自动打印原始 Error。
- **尚未理解：** DeepSeek 认证、限流、超时、上下文超限和服务异常的真实 HTTP/响应形状如何映射；P1 必须用真实响应或脱敏 Fixture 验证。受控 Stack 与持久化日志也尚未设计。
- **下一步：** P0.6 实现 `kfc doctor`，首次把配置加载、统一错误和 CLI 展示串成一个用户可见的诊断闭环。

## 2026-07-29 / P0.6 kfc doctor 健康检查

- **第一性问题：** 在真正消耗模型费用和引入网络不确定性之前，怎样证明本地运行时、配置来源和秘密存在性已经满足调用前提？
- **我的初始假设：** Doctor 应是只读、本地、确定性的诊断命令。配置文件不存在只是警告，因为环境变量可能完整；缺少必填配置才是失败。它只能显示 API Key 是否存在，不能显示值、长度或片段，也不应为了“检查”而调用 DeepSeek。
- **最小实验：** 增加 `doctor` 子命令、异步 CLI 运行器、Doctor 报告模型和真实环境适配器；检查 Node 22+、配置路径、Base URL、Model 与 API Key，并复用统一安全错误展示处理未知失败。
- **观察到的证据：** 全量 Vitest 15 个文件、51 个测试通过；严格构建、Lint 和格式检查通过。使用不存在的临时配置路径与受控 DeepSeek 环境变量运行真实 CLI，完整配置返回 0，报告 `deepseek-v4-flash` 和 `API Key present`；移除 API Key 后只报告 `KFC_API_KEY is required` 并返回 2，输出中没有测试密钥。
- **假设哪里错了：** 自动化进程第一次尝试裸 `kfc` 时找不到命令，而用户交互终端已经可以使用。根因是 Codex 进程的 PATH 没有继承用户刚更新的全局 Shell 环境，不是 Doctor 代码错误；仓库验收改用等价的 `pnpm kfc doctor`，没有擅自修改或重启用户环境。
- **得到的可复用原则：** 健康检查必须区分“警告但仍可运行”和“阻断性失败”。诊断命令只验证自己有权确定的事实；本地 Doctor 不应伪装成网络或模型可用性测试。测试环境与用户终端环境不同，定位失败时必须先确认执行上下文。
- **尚未理解：** DeepSeek API Key 是否有效、端点是否可达、模型是否可用，以及流式和 Tool Calling 是否符合预期；这些必须由 P1 真实调用验证，不能由 Doctor 猜测。
- **下一步：** P0.7 补齐 ADR-0001，系统记录为什么首版选择 TypeScript，以及在什么真实信号下重新评估 Rust Core。

## 2026-07-29 / P0.7 ADR-0001 TypeScript-first

- **第一性问题：** 首版语言应该优化最终理论性能，还是优化当前最稀缺的资源——对 Agent 核心机制的理解速度与可验证反馈？
- **我的初始假设：** 在 Agent Loop、工具协议和权限边界尚未稳定前，TypeScript 能提供足够类型约束并保持实验速度；Rust 的低层能力只有在真实系统问题出现后才产生净收益。
- **最小实验：** 不重新争论抽象语言偏好，而是回看 P0 已完成的 CLI、配置、错误和 Doctor，记录 TypeScript 实际抓到的问题、没有解决的问题、候选语言代价和可观察的迁移信号。
- **观察到的证据：** 严格 TypeScript 已发现 Node 类型未启用、错误构建仍产出文件、可选字段缺失与 undefined 不同等真实问题；同时 15 个测试文件和 51 个测试能够快速验证 CLI、配置和错误边界。当前没有性能、内存、沙箱或分发问题证明需要 Rust。
- **假设哪里错了：** “选择 TypeScript 是因为简单，未来自然会重写 Rust”不是有效架构判断。迁移不是成长仪式，只有当具体模块出现 Node 无法满足的约束，并且稳定边界使迁移范围可定义时，重写才可能值得。
- **得到的可复用原则：** 技术选择应优化当前瓶颈，并预先定义重新评估信号。保留选择权不等于提前支付多语言复杂度；最好的可迁移性来自清晰边界和测试，而不是同时维护两套实现。
- **尚未理解：** P3 的 Shell 和权限机制是否会暴露 Node 的系统控制边界，以及未来单文件分发是否成为真实需求；在证据出现前保持观察。
- **下一步：** P0.8 执行阶段总验收，检查 P0 的功能、测试、文档、安全边界和真实命令证据，再决定是否进入 P1。

## 2026-07-29 / P0.8 阶段验收

- **第一性问题：** “做完了”由谁宣布，怎样区分代码看起来能跑、测试通过、用户路径成立和安全边界真正有证据？
- **我的初始假设：** 阶段完成不能依赖模型或开发者主观声明；每个验收条件必须绑定命令退出码、真实 CLI 输出、静态检查、文档资产或明确人工审计。
- **最小实验：** 在受控临时配置路径下运行全量构建、51 个测试、Lint、格式、Diff、help、version、未知参数、Doctor 成功与缺 Key 失败路径；审计 Git 跟踪、忽略规则、秘密文件、配置示例和文档一致性，并写实验记录与阶段复盘。
- **观察到的证据：** 所有质量命令退出 0；help/version 分别退出 0，未知参数退出 1，Doctor 完整环境退出 0，缺 API Key 退出 2。Word 路线文档未被跟踪且被忽略，没有真实 `.env` 或疑似凭证，失败输出无测试密钥和 Stack。P0.1–P0.8 均有代码、测试、文档或命令证据。
- **假设哪里错了：** “生成了 dist 且命令能跑”曾被误认为构建成功，但真实 build 退出码为失败；阶段验收必须以命令状态和绑定证据为准。另一个现实是技术门槛通过不等于仓库已经形成可回滚基线，当前 P0 变更仍需用户决定是否创建本地检查点提交。
- **得到的可复用原则：** 完成是一组独立证据的交集：行为、自动化、静态检查、安全、文档和恢复能力缺一不可。警告、失败与未验证项必须公开记录，不能被“总体通过”掩盖。
- **尚未理解：** DeepSeek 的真实网络与协议行为；这是 P1 唯一应新增的主要不确定性。P0 的抽象是否足够，将由第一次真实 Provider 调用检验。
- **下一步：** 用户确认本地 P0 检查点策略后，进入 P1.1 定义 `ModelProvider`、内部请求/事件和 DeepSeek 适配边界。

## 2026-07-29 / P0.9 阶段复盘

- **第一性问题：** 验收命令全部通过后，还需要什么证据证明我们理解了这一阶段，而不是只会重复命令？
- **我的初始假设：** 阶段复盘必须把交付、失败、错误假设、架构原则、技术债、下一阶段和明确不做的内容放进同一份可审查记录。
- **最小实验：** 使用 `docs/reviews/P0-review.md` 逐项映射 P0.1–P0.8 的证据，回答 CLI/Core 分离、用户错误与 Debug 信息、为何不做 TUI/Monorepo/插件等问题，并公开剩余风险。
- **观察到的证据：** P0 Review 状态为 Accepted，包含 8 项验收矩阵、质量与安全证据、一次完整失败根因、三道必须回答的问题、技术债、下一阶段非目标和进入 P1 的判断；Markdown 内部链接检查 13 个文件、0 个失效本地链接。
- **假设哪里错了：** 初次最终快照显示 9 个任务完成但只有 8 个验证，原因是把 P0.8 与 P0.9 合并成一个学习日志标题，机器只能索引首个任务号。阶段证据也需要与任务保持一一对应，不能只在人类语义上“差不多”。
- **得到的可复用原则：** 阶段复盘不是总结文案，而是把散落证据组织成可审查的进入条件。机器状态和人类叙述必须指向同一事实；若索引显示缺口，应修正证据结构而不是修改统计。
- **尚未理解：** P1 第一次真实网络调用会推翻哪些 Provider、错误和配置假设；P0 只能证明进入实验的地基可靠。
- **下一步：** 建议先创建 P0 本地 Git 检查点，再开始 P1.1 Provider 契约与 Mock 事件测试。

## 2026-07-29 / P0.10 DIY Provider Quickstart

- **第一性问题：** 用户知道自己的兼容接口信息，却不熟悉配置路径和 JSON 结构时，怎样降低配置摩擦，同时不把 API Key 写入文件或偷偷修改 Shell？
- **我的初始假设：** Quickstart 应只负责完全自定义的 Base URL、Model 和 Timeout；Provider type 固定为 openai-compatible。秘密仍由当前 Shell 环境负责，向导只能检查存在性并提供不回显的 zsh 输入方法。
- **最小实验：** 增加 `--quickstart` 与 `--qs`，使用 readline/promises 读取 TTY，循环校验 HTTP(S) URL、非空模型和超时范围，预览后确认；通过私有临时文件和原子 rename 写入 JSON，再复用 Doctor 验证。
- **观察到的证据：** 全量测试扩展到 17 个文件、63 个测试；真实 PTY 输入自定义 `https://gateway.example.com/v1`、`diy-model-v1` 和 45000 后，生成权限为 0600 的 JSON，文件无 apiKey，Doctor 全部通过。已有文件拒绝覆盖返回 130 且内容不变；非 TTY 返回 1；临时验收文件已删除。
- **假设哪里错了：** URL Schema 初版在字符串已不合法时仍执行 `new URL()`，原生 TypeError 越过配置错误边界；校验函数必须捕获并返回 false。Timeout 默认值初版依赖 Prompt 适配器填充，测试 Prompt 返回空字符串后核心无限重试；默认值属于业务规则，应由 Quickstart 核心负责。终端流类型也不能假设通用 Readable/Writable 一定有 `isTTY`，应显式声明可选 TTY 能力。
- **得到的可复用原则：** 交互向导的价值是组织已有规则，不是建立第二套配置系统。输入校验、默认值、文件安全和 Doctor 必须复用现有领域边界。子进程不能永久修改父 Shell，因此秘密持久化必须保持诚实，不用“自动配置”掩盖系统限制。
- **尚未理解：** 用户是否需要操作系统 Keychain 集成；当前没有真实需求证明应扩大秘密存储边界。Quickstart 也未验证 Provider 网络可用性，这仍属于 P1。
- **下一步：** 建议创建包含 P0.10 的本地检查点提交，然后进入 P1.1 Provider 契约与 Mock 流式事件。

## 2026-07-29 / P1.1 Provider 契约

- **第一性问题：** 远程模型协议和供应商字段都不稳定时，Core 最少需要认识什么，才能消费单轮文本流而不依赖任何 SDK？
- **我的初始假设：** 一个只包含规范化消息、`AsyncIterable` 流、平台 `AbortSignal`、四类事件和现有结构化错误的契约，已经足以支撑 P1；Tool Calling、采样参数和供应商 chunk 都应推迟到真实问题出现后。
- **最小实验：** 新增 `src/provider/model-provider.ts` 与公共出口，用测试内 `ScriptedModelProvider` 实现成功流、`ProviderError` 传播、请求前取消和消费期间取消；不加入网络请求、SDK、运行时校验器或生产 Mock。
- **观察到的证据：** Mock 按 `start → text-delta* → usage? → finish` 产生确定序列，消费者可拼接文本并读取规范化 Token 用量；错误在异步迭代边界保持稳定 code、retryable 和 details；两类取消都产生 `UserInterruptedError`，中断后无后续事件。`pnpm build`、`pnpm lint`、`pnpm format:check` 全部通过；全量 `pnpm test` 为 21 个文件、76 个测试通过；契约测试另经 TypeScript 6 严格 `tsc --noEmit` 类型检查通过。
- **假设哪里错了：** `pnpm test -- tests/provider/model-provider.test.ts` 没有形成预期的单文件隔离，并在沙箱内触发 LR Machine 回环端口 `EPERM`；定向 Vitest 应直接使用 `pnpm exec vitest run <path>`。此外，测试文件不在生产 `tsconfig.json` 的 include 中，单靠 `pnpm build` 不能类型检查测试代码；TypeScript 6 在显式文件与当前配置并存时还要求 `--ignoreConfig`，因此契约证据需要额外的严格 `tsc --noEmit`。
- **得到的可复用原则：** Core 契约只表达消费者真正依赖的不变量，不替供应商协议保存原始形状。取消是控制流错误，不是 finish 事件；Provider 失败应抛结构化错误而非伪造成功结束。测试命令本身也是实验装置，若选择器或执行环境失真，结果就不能证明目标。
- **尚未理解：** OpenAI-compatible SSE 在 DeepSeek 实际响应中的 chunk 顺序、usage 出现位置、结束原因和错误正文有何差异；网络中止时 fetch、reader 与 `AbortSignal` 的具体交互仍需 P1.2 实验。
- **下一步：** 进入 P1.2，先设计 OpenAI-compatible HTTP/SSE 适配边界与录制 Fixture，再实现真实流解析、错误归一化、超时和取消；Core 继续只依赖本次契约。

## 2026-07-31 / P1.2 OpenAI-compatible Provider

- **第一性问题：** 怎样把不稳定的 HTTP、SSE、JSON 和供应商错误变成 Core 可依赖的单一事件流，同时让后续主流协议能够独立接入？
- **我的初始假设：** Node.js 22 原生 `fetch`、Web Streams、Zod 和独立协议适配器足以完成 Chat Completions，不需要 SDK、EventSource、自动协议探测或提前共享抽象。
- **最小实验：** 实现 `OpenAiChatCompletionsProvider`、增量 SSE 解码器、外部 chunk/error Schema 和安全 HTTP 映射；使用 DeepSeek 终帧 usage 与 OpenAI 独立 usage 两类脱敏 Fixture，从真实 `Response`/`ReadableStream` 边界验证请求、流、错误、超时和取消，不访问网络。
- **观察到的证据：** Provider 定向测试为 5 个文件、27 个测试通过；全量 `pnpm test` 为 25 个文件、102 个测试通过。`pnpm build`、`pnpm typecheck:tests`、`pnpm lint` 和 `pnpm format:check` 通过。两种 usage 顺序都归一化为 `start → text-delta* → usage? → finish`；请求前取消、fetch 中取消、消费中取消、timeout 和消费者提前退出均停止底层工作。API Key、原始错误正文和未知网络 message 未进入公开错误。DeepSeek 官方资料于 2026-07-31 重新确认 Base URL、`deepseek-v4-flash`、Chat Completions、`include_usage` 与 `[DONE]` 语义。
- **假设哪里错了：** 现有六类 Provider 错误不足以表达真实协议，HTTP 402 和 429 `insufficient_quota` 不能错标为认证或普通限流，因此增加了非重试 `PROVIDER_QUOTA_EXCEEDED`。finish reason 也不能到达时立即发送：OpenAI 可在其后发送独立 usage chunk，必须延迟到 `[DONE]` 才能保持 finish 最后。Vitest 只转译测试，新增 `tsconfig.tests.json` 后才发现 AsyncIterable/AsyncIterator 与 Mock tuple 的类型错误；timeout 测试还因先触发拒绝、后注册断言产生未处理 Promise 警告。
- **得到的可复用原则：** 兼容主流协议不等于用一个解析器猜所有协议，而是保持稳定 Core、显式选择线协议、独立验证每种适配器。外部 Schema 应只约束消费字段并容忍未知扩展；错误分类只相信有限、结构化、allowlist 的机器字段。异步流的终止事件必须由协议终止条件决定，不能由某个中间 chunk 的表象决定。
- **尚未理解：** 真实 DeepSeek 网络是否会出现文档外 chunk、content-type、错误 code 或代理缓冲行为；`openai-responses` 的事件粒度、usage 与完成语义能否无损映射到当前四类内部事件；Anthropic Messages 是否会迫使消息或 finish 契约扩展。
- **下一步：** 进入 P1.3，先核验 OpenAI Responses 官方事件语义，设计独立 `openai-responses` 适配器；只有真实映射证据表明 Core 契约不足时才扩展它。

## 2026-07-31 / P1.3 OpenAI Responses Provider

- **第一性问题：** Responses 使用 typed SSE、output item、content part、reasoning、refusal 和独立终端事件时，怎样只保留 Core 真正需要的文本、usage 与 finish，同时不静默丢失当前无法表达的语义？
- **我的初始假设：** 现有 `ModelProvider` 足以承载单轮 Responses 文本；普通输出和拒绝文本可以投影为 `text-delta`，reasoning 可忽略，工具与多位置输出应拒绝。Chat Completions 的 SSE、HTTP 错误和生命周期机制可以在第二个适配器出现后做最小共享。
- **最小实验：** 实现 `OpenAiResponsesProvider` 与判别事件 Schema，发送 `POST /responses`、`stream: true`、`store: false`；用官方形状 Fixture 验证 output text、refusal、reasoning、completed/incomplete、usage、stream error、sequence、单文本位置和取消，不访问真实 OpenAI 服务。
- **观察到的证据：** 全量 Vitest 为 28 个文件、123 个测试通过；Provider 定向测试为 7 个文件、43 个测试通过。`pnpm build`、`pnpm typecheck:tests`、`pnpm lint`、`pnpm format:check` 与 `git diff --check` 全部通过。普通文本和 refusal 都归一化为 `text-delta`；reasoning 不进入 Core；工具、未知、多位置、倒序 sequence、非法 usage、`[DONE]` 和缺失 typed terminal 均产生安全的 `PROVIDER_INVALID_RESPONSE`。两个协议共用经过双套生命周期回归保护的 request lifecycle，Chat Completions 行为未改变。
- **假设哪里错了：** 最初只拒绝 function/tool 的专用 delta 事件仍不够，因为工具或多模态输出可以先通过 `response.output_item.added` / `response.content_part.added` 宣告；若包装事件只按名称忽略，就会静默吞掉语义。实现因此校验 wrapper 内的 item/part 类型，只允许 message/reasoning 与 output_text/refusal。Quickstart 增加默认协议问题后，测试一度挂起；根因不是生产循环，而是测试 prompt 替身没有像真实 terminal prompt 一样应用 `defaultValue`。
- **得到的可复用原则：** “忽略已知事件”必须同时验证其载荷类别，不能只看事件名；无法无损映射的输出应显式失败。拒绝文本是用户可见最终结果，reasoning 不是。不同协议的终止条件不能复用表象：Chat Completions 依赖 `[DONE]`，Responses 依赖 completed/incomplete typed event。共享抽象应在第二个实现暴露真实重复后提取，并保留协议状态机独立。
- **尚未理解：** 真实 OpenAI 端点是否会出现文档外事件、代理改写的 Content-Type 或不同错误码；多 output item、Tool Calling 和 reasoning 是否会在 P2 迫使 Core 扩展；Anthropic Messages 的 content block 与 stop reason 能否保持当前契约。
- **下一步：** 进入 P1.4，核验 `anthropic-messages` 官方协议并用独立 Fixture 检验跨供应商边界；真实网络、`kfc ask` 和指标采集仍按 P1 后续任务推进。

### 提交前配置策略确认

用户确认保留独立 `credentials.json` 能力。普通 `config.json` 继续禁止 API Key；凭证解析顺序固定为 `KFC_API_KEY` 高于 Base-URL-bound 私有凭证文件。Quickstart 必须在隐藏输入前明确提示明文存储并取得确认，凭证文件使用私有临时文件、原子 rename 和 `0600` 权限。该选择同步进入项目规则与公开文档，避免“环境变量专用”旧约束和当前行为并存。

## 2026-07-31 / P1.4 Minimal `kfc ask` Vertical Slice

- **第一性问题：** CLI、配置、凭证、错误和两个 Provider 都已存在时，怎样用最少的新结构证明用户输入能够真正穿过这些边界并流式得到单轮回答？
- **我的初始假设：** 下一步应先建设协议无关指标装饰器，再由未来调用方复用；TTFT、总耗时、usage 和 outcome 可以独立于真实命令实现。
- **最小实验：** 用户指出这可能偏离主路线后，删除独立指标方案，改为实现 `kfc ask <prompt...>`。新增纯参数解析、显式协议工厂和协议无关 Ask Runner；Runner发送一条 user message、流式转发非空文本、计算 TTFT/总耗时/usage/finish，并把正文与摘要分别放入 stdout/stderr。进程入口只负责延迟加载配置、创建单次 AbortController 和临时 SIGINT listener。
- **观察到的证据：** 最终全量门禁为 30 个 Vitest 文件、144 个测试全部通过；`pnpm build`、`pnpm typecheck:tests`、`pnpm lint`、`pnpm format:check`、`git diff --check` 均通过，构建后的 `pnpm kfc --help` 已展示 `ask <prompt...>`。Ask Runner 的成功、无文本、非法/未知事件、usage 算术、请求前取消、消费期间取消和 ProviderError 身份均由确定性测试覆盖；CLI 测试证明正文只进入 stdout，指标或安全错误只进入 stderr。
- **假设哪里错了：** 独立指标装饰器没有真实第二消费者，会让横向基础设施继续增长而主闭环仍不可运行。正确顺序是先完成纵向用户路径，再从重复中提取抽象。新增 `ask` 联合类型后，TypeScript 立即迫使 `runCli` 处理新分支；这比临时返回占位错误更有价值，因为类型失败准确揭示了尚未接通的应用边界。
- **得到的可复用原则：** 路线图条目的顺序不能凌驾于最终闭环；当“可观测性”可以自然附着在真实调用上时，不应先建立独立子系统。stdout 是可组合正文通道，stderr 是诊断和指标通道。Provider 工厂只按已验证协议分派，Ask Runner 只消费内部事件，进程层只管理配置和信号，三者边界必须保持单向。
- **尚未理解：** 真实 DeepSeek/OpenAI-compatible 网关是否会按 Fixture 顺序发送 usage 和终止事件；终端或代理缓冲对 TTFT 的影响；真实调用是否需要 stdin Prompt、system prompt 或可关闭的指标摘要。
- **下一步：** 在用户明确授权真实凭证和网络调用后执行 P1.5 `kfc ask` 验收，保存外部调用证据并完成 ADR/P1 Review；Anthropic Messages 继续延期，不阻塞进入主闭环。

## 2026-07-31 / P1.5 真实 `kfc ask` 验收与 P1 复盘

- **第一性问题：** Fixture、Mock 和类型检查都通过后，哪些事实仍必须由真实 Provider 调用证明，P1 又凭什么有资格进入 Agent Loop？
- **我的初始假设：** 一个要求模型精确返回固定标记的低成本 Prompt，可以同时证明协议连通性和模型服从性；若调用成功，输出应与标记字节一致。
- **最小实验：** 在用户明确授权后，不直接读取或打印凭证，先运行 Doctor 验证私有配置、Base URL、模型和 API Key presence；随后通过构建后的 `kfc ask` 调用 `https://api.deepseek.com` 的 `deepseek-v4-flash`，Prompt 为 `Reply with exactly: KFC_P1_ACCEPTED`。
- **观察到的证据：** Doctor 全部通过。真实调用退出码为 0，stdout 包含 `KFC_P1_ACCEPTED`，stderr 为 `finish=stop ttft=1115ms total=1165ms tokens=95/29/124`。API Key 未出现在命令或输出。完整证据保存于 `docs/experiments/EXP-003-real-kfc-ask-deepseek.md`，阶段判断保存于 `docs/reviews/P1-review.md`。
- **假设哪里错了：** 模型在标记前增加了一个空格。协议调用完全成功，但自然语言“exactly”没有形成字节级保证。模型输出内容与协议完成事实必须分开验收；真正稳定的是退出码、typed event、finish、usage 和安全错误，而不是模型对格式要求的偶然服从。
- **得到的可复用原则：** 自动化 Fixture 证明边界可重复，真实调用证明环境、凭证、网络和供应商共同工作，两者不能互相替代。真实验收 Prompt 应低成本、无秘密、可判断，但不能把自然语言输出当作结构化协议。完成阶段应主动列出未实测失败路径，而不是用一次成功掩盖风险。
- **尚未理解：** DeepSeek 真实认证失败、限流、配额、上下文和断网响应是否完全符合当前映射；Responses 的真实端点行为；argv Prompt 的隐私风险应何时通过 stdin 解决。
- **下一步：** P1 技术门槛通过，进入 P2.1 Agent Loop 领域契约。先用 Mock Provider 和假工具结果验证受控循环状态、最大步数与终止条件，不立即开放文件或 Shell 权限。

## 2026-08-01 / P2.1 Agent Loop 领域契约

- **第一性问题：** 模型提出动作、程序执行动作并把结果回灌时，怎样保证循环的状态、终止和错误归属由程序控制，而不是由供应商协议或模型自律决定？
- **我的初始假设：** 在 `ModelProvider` 增加一个完整 Tool Call 事件，再写一个 for-loop 即可；只要最终消息正确，历史请求引用和取消检查位置不会影响行为。
- **最小实验：** 扩展内部消息、原子 `ModelToolCall`、tool result message 与 `tool-call` finish reason；实现只依赖 Mock Provider/Fake Executor 的 `runAgent`。用确定性脚本覆盖直接完成、Tool Result 回灌、两步完成、多工具串行、ID 唯一、最大步数、非法流、结果不匹配、执行器失败和三类取消路径。
- **观察到的证据：** 首次全量门禁为 32 个 Vitest 文件、172 个测试全部通过；`pnpm build`、`pnpm typecheck:tests`、`pnpm lint`、`pnpm format:check` 和 `git diff --check` 均通过。Agent 定向测试为 23 项，证明完整 Tool Result 精确出现在下一次 ModelRequest，最后一步请求工具时零工具执行，`kfc ask` 观察到 Tool Call 时仍返回安全的 `PROVIDER_INVALID_RESPONSE`。
- **假设哪里错了：** Provider 首次记录的是 Agent 内部可变 messages 数组，后续追加 assistant 后，历史请求也被改写；模型调用必须获得数组快照。取消也不能只在开始和工具前检查：工具 resolve 时或 Provider 忽略 Signal 时，Agent 仍可能继续下一步或宣布成功，因此模型 turn 后、工具 await 后和每个步骤前都需要检查。TypeScript 的 string 类型也不能保护运行时 Mock，非字符串 Tool Call ID 曾被误报为 maxSteps，而不是非法 Provider 响应。
- **得到的可复用原则：** Agent 的本质是受控状态机，不是“模型循环调用自己”。每个外部 await 都是取消重新判定点；每次模型请求都是不可变快照；Tool Call 必须先成为供应商无关原子事实，再进入工具系统。最后一步不执行无法回灌的工具，避免产生孤立动作。错误归属必须区分 Provider 流、Agent 控制与 Tool Executor。
- **尚未理解：** 真实协议 Tool Call delta 如何可靠组装成原子 input；工具不存在、参数错误、执行超时和输出过大应怎样统一变成 Tool Result；多个无副作用工具何时值得并行。
- **下一步：** 进入 P2.2 Tool Registry 与 Zod 参数验证。先使用纯内存假工具验证注册、查找、重复名称、参数错误和执行失败结果，不读取工作区或开放任何系统权限。

## 2026-08-01 / P2.2 Tool Registry 与参数验证

- **第一性问题：** Tool Call input 是 unknown、工具实现和失败方式各不相同时，怎样让 Agent Loop 只看到稳定 Tool Result，而不承担查找、Zod issue、异常泄漏和取消策略？
- **我的初始假设：** ToolDefinition 的 TypeScript 类型足以保护 Registry；只要工具通过 `defineTool` 创建，注册阶段不需要真正的 runtime unknown 检查。工具执行异常也可以沿用 KfcError 传播。
- **最小实验：** 实现 `defineTool()`、纯内存 `ToolRegistry` 和 ToolRegistryError。Registry 使用 `safeParseAsync`，把 default、transform 和未知字段剔除后的 Zod output 交给假工具；未知工具、参数错误、Error/KfcError/string throw 和非法 output 全部转换成不泄漏内容的 JSON Tool Result。随后直接把 Registry 注入 P2.1 Agent Loop，验证成功和错误结果都能回灌并让模型下一步完成。
- **观察到的证据：** 首次全量门禁为 36 个 Vitest 文件、198 个测试全部通过；Tool 定向测试为 4 个文件、26 个测试。build、测试类型检查、lint 和 git diff 均通过；格式检查首次只发现一个测试文件未执行 Prettier，修正后通过。Zod output 类型推导、default/transform、字段剔除、注册顺序、重复名称、安全路径、主动错误、异常隔离、三类取消窗口和 Agent Loop 集成都有确定性证据。
- **假设哪里错了：** 运行时可以绕过 TypeScript 传入 `null` 或伪造 Schema，初版 `isValidDefinition` 直接读取 `.name`，泄漏了原生 TypeError；注册入口必须真正从 unknown 开始检查。KfcError 也不能默认传播：工具内部错误对 Agent 来说通常是可恢复结果，只有取消应该保持控制流异常。错误内容若直接使用 Zod message 或异常 message，也可能把原始值和实现细节回灌给模型。
- **得到的可复用原则：** 静态类型保护开发者，Runtime Schema 保护系统边界，两者不能互相替代。Tool Registry 应把“普通失败”降级为模型可观察的结构化结果，同时把取消保留为程序控制流。工具只能接收解析后的数据；Agent Loop 不应知道 Zod、Map 或异常格式。安全错误应使用 allowlist 字段重新构造，而不是尝试清洗未知对象。
- **尚未理解：** 真实文件工具的路径、大小、编码、二进制、Symlink 和超时边界；Zod Schema 到主流 Provider JSON Schema 的兼容范围；工具主动错误 content 如何建立统一安全规范。
- **下一步：** 进入 P2.3 只读工作区工具。先统一 Workspace Boundary、路径解析、文件/结果上限和稳定错误，再分别实现 `list_directory`、`read_file` 与 `grep`；继续不开放写入或 Shell。

## 2026-08-01 / P2.3 只读工作区工具

- **结果：** 建立 canonical Workspace Boundary，并实现非递归目录列表、受限 UTF-8 文件读取和固定字符串递归搜索。临时目录测试覆盖路径穿越、`.git`、内部/外部 Symlink、排序、截断、二进制、大文件、扫描上限和统一工厂。
- **证据：** Workspace 定向测试 5 个文件、16 个测试通过；全量质量门禁随后验证。没有使用 Shell、真实工作区或外部模型。
- **教训：** “只读”必须同时限制路径、Symlink、内容类型和资源消耗；realpath containment 是三个工具共同边界，不能复制实现。
- **下一步：** P2.4 统一工具 timeout、输出上限和重复调用检测。

## 2026-08-01 / P2.4 Chat Completions Tool Calling 与显式只读 Agent

- **第一性问题：** 已经分别验证的 Agent Loop、Registry 和文件工具，怎样在不让供应商分片格式污染 Core、也不隐式扩大 `ask` 权限的前提下，形成真实可用闭环？
- **我的初始假设：** 只要把 P2.1 的 Tool Call event 直接塞给现有 Chat Completions Provider，就可以从模型端得到真实工具调用。
- **最小实验：** 新增模型安全 JSON Schema tool definitions；Chat Completions 负责 wire message/tools 编码及 `delta.tool_calls` 分片组装；Agent 每一步传入同一工具集合并回调文本；新增显式 `kfc agent`，以当前目录生成 P2.3 只读工具，限定八步且只接受 Chat Completions。用 fixture 验证参数分片、错误 JSON、每步工具定义和 CLI 输出，再用真实 Provider 验收。
- **观察到的证据：** `pnpm build`、`pnpm typecheck:tests`、`pnpm lint`、`pnpm format:check` 全部通过；全量 Vitest 为 41 个文件、222 个测试。真实 `kfc agent` 在当前工作区完成 4 个 Agent step 并以 `finish=stop` 返回项目总结。首次 Agent 和最小 Ask 都出现临时 Provider unavailable，15 秒后 Ask 健康对照成功，再试 Agent 成功，证明该失败来自上游瞬态可用性而不是工具请求格式。
- **假设哪里错了：** Provider 的 Tool Call 不是一个完整事件：id、name 和 arguments 可跨多个 SSE chunk，直接向 Agent 发半成品会使工具在不完整 input 上执行。另一个错误假设是“给 ask 加工具最省事”；命令语义改变会把原有无文件权限路径变成有本地读取能力，安全边界必须显式。
- **得到的可复用原则：** 工具调用的协议状态应在 Provider adapter 收敛成原子事实，Core 只接受完整、可解析的 JSON object。能力权限应体现在用户可见命令与配置门禁上，而不是藏在便利函数里。真实验收需用同配置的低成本健康对照区分上游故障与新功能回归。
- **尚未理解：** Responses/Anthropic 的 Tool Calling 状态机、JSON Schema 与 Zod 重复维护的长期成本、工具 timeout/输出预算以及中间 Agent 文本更适合怎样以 P4 事件渲染。
- **下一步：** P2.5 为工具加入统一 timeout、输出上限和可持久化轨迹；继续不开放写入或 Shell。

## 2026-08-01 / P2.5 KFLOW 交互工作台与终端边界

- **第一性问题：** 一次性 Agent 命令怎样变成可连续工作、能观察工具事件、又不会因为终端输入和清理细节损坏用户 shell 的会话？
- **我的初始假设：** 备用屏幕加 `readline.question()` 已足以实现类似 coding-agent CLI 的交互。
- **最小实验：** 先实现简版 TTY session，随后用真实终端与用户交互反馈检验。将它替换为纯 WorkbenchState + ANSI renderer + raw-mode editor：时间线、固定 status/editor、短 KFLOW 动画、中文 slash 菜单、滚动、配置/usage status 与确认式 clear。用 PassThrough 伪终端模拟 tool/text stream、undefined mouse keypress、SGR scroll、status 累计和 `/exit` 清理。
- **观察到的证据：** `emitKeypressEvents` 在鼠标滚轮等序列上可以回调 undefined value；旧 editor 对它调用 string sanitize 导致进程直接抛 TypeError。SGR mouse 包还会被 keypress parser 分解为 `64;20;10M` 文本，必须在 data 边界识别整包并在同一事件循环抑制派生 keypress。`emitKeypressEvents` 激活 stdin 流，若 finally 不 pause，会导致退出后父进程等待。修复后真实 TTY 通过 `/`→`/status`→`/exit` 获得退出码 0。全量门禁为 46 个测试文件、243 个测试通过。
- **假设哪里错了：** “终端输入就是 string”错误；raw TTY 面对的是未知字节与控制协议。只恢复画面也不等于完整退出：输入流、mouse mode、raw mode、listener 和 cursor 都属于同一生命周期。另一个错误是把 `/clear` 当成视觉操作；若保留 messages，它不能解决上下文污染。
- **得到的可复用原则：** TUI 应从可测状态渲染，而不是拼 stdout。所有终端输入都先作为 unknown 处理；任何 UI 控制序列必须是程序常量。会话状态、模型 usage 与配置状态要分层聚合；Provider 未提供的上下文能力应显示未知。上下文重置是安全操作，必须显式确认。
- **尚未理解：** 宽 Unicode 字符的终端列宽、复杂粘贴和多行编辑兼容、跨 Windows 终端的 mouse 协议，以及长会话的 Token 压缩与持久化。
- **下一步：** P2.6 统一工具 timeout、输出上限和可持久化工具轨迹；P5 再解决上下文预算、摘要和会话持久化。

## 2026-08-01 / 运行时设置与交互目录集中管理

- **第一性问题：** 当 Agent 步数、命令说明和工具展示标签分散在 CLI、Agent 与 TUI 中时，怎样让一次配置变化只需要修改一个来源？
- **我的初始假设：** 继续增加导出常量即可解决重复，但这只能减少数字重复，不能消除命令菜单和 `/help` 的表格分叉。
- **最小实验：** 将 Agent 默认步数、上下限和环境变量名收敛到 `src/config/runtime-settings.ts`；将交互命令及工具本地化标签收敛到 `src/interactive/catalog.ts`；让 CLI、WorkBench 菜单和帮助输出共同消费目录。
- **观察到的证据：** `KFC_AGENT_MAX_STEPS` 的默认值、边界和错误校验只保留一份；新增命令目录测试验证 `/help`、`/clear`、`/status`、`/tool`、`/exit` 无重复且具有菜单/帮助所需字段；工具展示名称变化不会改变 Provider-facing tool name。
- **得到的可复用原则：** 配置表应按职责分层集中，而不是建立无边界的全局常量文件；运行策略、交互目录和协议实现分别维护，调用方只消费，不复制。
- **下一步：** 继续保持写入工具、Shell 和跨协议 Tool Calling 不开放；P2.6 再处理工具 timeout、输出上限和工具轨迹持久化。

## 2026-08-01 / P2.5 主题切换与状态投影

- **第一性问题：** 终端工作台怎样在不重启会话的情况下改变视觉语义，并让用户知道当前使用的模型、目录和主题？
- **我的初始假设：** 只替换几处 ANSI 颜色即可完成主题功能；但如果颜色散落在渲染函数中，实时切换和后续扩展都会继续制造硬编码分叉。
- **最小实验：** 将颜色收敛为语义化 Palette，增加内置主题目录和 `/themes` 菜单；上下键移动选项时立即重绘，选择后以原子写入更新现有 `config.json` 的 `ui.theme`，同时在底部投影模型、工作目录、协议、主题、轮数和工具数量。
- **观察到的证据：** 主题选择状态与命令菜单、工具菜单互斥；构建、类型检查、Lint、格式检查和 254 个测试全部通过；主题配置通过现有 schema 校验，不触碰凭证文件。
- **假设哪里错了：** 主题并不只是装饰层。它必须成为渲染器的输入、配置系统的可验证字段和会话状态的一部分，否则“实时生效”只会是临时改色，重启后丢失。
- **得到的可复用原则：** UI 颜色应以语义 token 管理，交互目录与实际处理逻辑共享来源；持久化 UI 偏好应沿用已有配置边界，并使用原子替换避免半写入文件。
- **尚未理解：** 用户自定义主题的配置格式、终端背景检测和跨 Windows 终端的颜色能力仍未验证。
- **下一步：** 继续保持写入工具、Shell、Anthropic Messages Provider 和跨协议 Tool Calling 不开放；P2.6 处理工具 timeout、输出上限和工具轨迹持久化。
