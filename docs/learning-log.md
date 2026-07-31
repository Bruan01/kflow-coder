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
