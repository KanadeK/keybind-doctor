# Keybind Doctor

跨应用快捷键冲突分析器：读取真实配置，理解作用域，并给出最小改动修复方案。

**[打开纯本地网页工作台](https://kanadek.github.io/keybind-doctor/)** ·
[English README](README.md)

普通重复检查只能看到“两个字符串相同”。Keybind Doctor 会把 VS Code、Zed、
JetBrains、PowerToys 和 AutoHotkey 放进同一个快捷键组合中，再区分：

- 全局、应用内和上下文作用域；
- 两个 `when/context` 条件是否可能同时成立；
- 全局热键是否会抢先截获应用内快捷键；
- 短快捷键是否是长组合键的前缀；
- 相同按键是否因为应用或条件互斥而可以安全复用；
- 哪个未锁定绑定移动后影响最小。

网页和 CLI 共用同一套解析、判定与求解核心。网页没有后端，不上传配置，也
不会改写源文件。

## 快速验收

需要 Node.js 20 或更新版本。

```powershell
git clone https://github.com/KanadeK/keybind-doctor.git
Set-Location keybind-doctor
npm ci
npm run build
node dist/cli.js scan examples/vscode-keybindings.json examples/zed-keymap.json examples/jetbrains-keymap.xml examples/powertoys-default.json examples/global-hotkeys.ahk --platform windows --fail-on none
```

内置样例有 21 条绑定。v0.1.0 的确定性结果是：2 个确定冲突、7 个全局遮蔽、
5 个潜在冲突、2 个系统保留键、11 个安全复用、12 条修复建议、0 个未解决项。

## 命令行

```text
keybind-doctor scan <文件...> [选项]

--platform <windows|macos|linux>
--input-format <auto|vscode|zed|jetbrains|powertoys|autohotkey|manifest>
--application <应用名>
--format <text|json|markdown|csv>
-o, --output <输出文件>
--fail-on <definite|potential|none>
--no-plan
--strict-warnings
--deterministic
```

退出码：

| 退出码 | 含义 | 处理方式 |
| ---: | --- | --- |
| `0` | 没有问题达到设定阈值 | 继续 |
| `1` | 有问题达到 `--fail-on` 阈值 | 审核报告或明确调整阈值 |
| `2` | 输入、解析或运行失败 | 按[修复流程](docs/repair.md)处理 |

默认阈值是 `--fail-on definite`。如果只是希望查看报告而不让命令失败，请
明确使用 `--fail-on none`。

## 真实支持的格式

| 适配器 | 输入 | 已处理的作用域 |
| --- | --- | --- |
| VS Code / Cursor / Windsurf | JSONC `keybindings.json` | 应用、上下文、`systemWide` |
| Zed | JSONC `keymap.json` | 应用、上下文 |
| JetBrains IDE | Keymap XML | 应用、两段组合键 |
| PowerToys | Keyboard Manager `default.json` | 全局、指定进程 |
| AutoHotkey | v1/v2 `.ahk` 声明 | 全局、`#HotIf` 条件 |
| 通用清单 | `*.keybind.json` v1 | 全部作用域，以及 `locked/enabled` |

详细边界见 [docs/formats.md](docs/formats.md)。

## 网页工作台

GitHub Pages 上运行的是真实产品，不是截图或空壳。它可以：

1. 拖入多个真实配置；
2. 切换 Windows、macOS、Linux；
3. 查看每条冲突的文件与行号证据；
4. 查看冲突、修复方案和安全复用；
5. 下载 JSON 或 Markdown 报告。

配置只存在浏览器内存中。项目没有服务器、账号、埋点和自动改写。

## 完整发布前自检

```powershell
npm ci
npm run verify:examples
npm run check
npm run test:e2e
npm run package
npm run release:check
```

其中包含 17 个单元/集成测试、10 个桌面与移动端 E2E、严重级无障碍扫描、
依赖低危阈值审计、敏感信息检查、包内容检查，以及间隔执行的两次发行资产
字节哈希对比。

产物：

- `release/keybind-doctor-0.1.0.tgz`：可安装 CLI 与库；
- `release/keybind-doctor-web-v0.1.0.zip`：静态网页；
- `release/release-manifest.json`：机器可读哈希；
- `release/SHA256SUMS`：校验文件。

失败时不要跳过门禁，按 [docs/repair.md](docs/repair.md) 定位、修复并从失败项
开始重跑，最后再执行完整门禁。

## 设计边界

- 这是配置优先的分析器，不是运行时热键注册探测器；
- 未提供的应用默认绑定不会凭空推断；
- 正则、函数调用和未支持的上下文语法会标成“潜在冲突”，不会假装安全；
- 修复输出是计划，不会自动覆盖用户配置；
- 物理键盘布局差异仍需人工确认。

研究依据、竞品边界与机会判断见 [docs/research.md](docs/research.md)。搜索无法
证明世界上绝对不存在相似项目，因此文档只陈述可复查的搜索结果与本项目的
具体差异。

MIT 许可证。欢迎按 [CONTRIBUTING.md](CONTRIBUTING.md) 增加更多真实格式。
