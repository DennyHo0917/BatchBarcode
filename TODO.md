# BatchBarcode Todo List

> 产品目标：让用户完成 `CSV / Excel → 批量生成条码 → 标签排版 → PDF → 打印`。
>
> 核心定位：**Free Batch Barcode Generator & PDF Label Printer**，不是一组彼此孤立的单条码生成器。

## 当前基线（2026-08-11）

- [x] 静态 HTML / CSS / JavaScript，无构建步骤和前端框架
- [x] 本地托管 `bwip-js 4.5.1`，在浏览器本地生成条码，不依赖运行时 CDN
- [x] 已有 PDF417、MicroPDF417、通用 Barcode、Code 128、QR Code、EAN-13、UPC-A、Data Matrix 页面
- [x] PDF417 支持多行输入、CSV 首列简易解析、最多 100 条预览、预设参数、首张 PNG 下载和浏览器打印
- [x] 通用生成器支持 Code 128、QR Code、PDF417、MicroPDF417、EAN-13、UPC-A、Data Matrix 的批量生成
- [x] 已接入 Google Analytics，并有 canonical、robots.txt、sitemap 和 PDF417 结构化数据
- [x] 已实现批量 PNG ZIP 和直接下载 A4 / Letter PDF，并通过文件、尺寸、渲染和软件解码验收
- [x] 已有最小 Node 回归检查；本地托管 SheetJS 0.20.3、JSZip 3.10.1 和 jsPDF 4.2.1；尚无明确部署配置，`CNAME` 指向 `www.batchbarcode.com`

## P-1：先让网站被发现

- [ ] 在 Search Console 确认新版 8 个 canonical 页的索引状态（阻塞：需先部署新版并等待 Google 抓取）
- [ ] 用 URL Inspection 检查 8 个工具页并记录 Google canonical、最后抓取时间和原因（阻塞：需先部署新版并等待抓取）
- [x] 确认 sitemap 已成功提交且 Google 能读取；当前线上提交记录仍是 HTTP URL 和旧版 5 页，待新版部署后改为 `https://www.batchbarcode.com/sitemap.xml`
- [x] 导出最近 3 个月 Search Console 查询、页面、展示、点击和平均排名，作为后续基线（见 `docs/gsc-baseline-2026-08-11.csv`）
- [x] 暂停扩展泛关键词页面；选择长尾工作流：`CSV / Excel → printable barcode label PDF`
- [x] `/barcode-generator/` 已兑现批量、字段映射、标签排版、PNG ZIP 和直接 PDF 承诺
- [ ] 找 5 位真实目标用户完成一次任务并记录工作流（阻塞：需要真人招募；脚本与记录表已准备）
- [ ] 在相关行业社区做少量人工发布和演示（阻塞：需要指定社区/账号并确认对外发布）
- [x] 已定义每周三组指标：有效收录页、非品牌词展示/点击、生成到导出/打印的完成率

**P-1 验收：**重要页面均可被 Google 正确识别；至少一个非品牌长尾词开始获得展示；至少 5 位真实用户完成生成到打印/导出。

## 开发约束

- [x] 不重写整个项目；优先在当前静态架构上增量开发
- [x] 保留现有 PDF417 SEO 正文、FAQ、示例和内链
- [x] 不随意更改已收录 URL；新增路由前先检查搜索数据和重复意图
- [x] 页面负责独立 SEO 内容，生成逻辑和样式尽量复用
- [x] 不为 UI 动画或未来需求增加框架和依赖
- [x] 本地步骤均可独立验收和回滚；软件扫码已完成，实体打印验收仍按 `docs/print-scan-test-plan.md` 单独保留

## P0：稳定现有 PDF417

- [x] 建立最小测试清单：空值、长文本、特殊字符、逗号、引号、换行、1 条、100 条和超过 100 条
- [x] 超过 100 条时明确提示，不能静默截断
- [x] 校验 Scale、Error Level、Columns、Rows 的边界值和异常组合
- [x] 单条生成失败时显示对应数据和原因，避免留下不完整批次却显示成功
- [x] PDF417 首张 PNG 为 561×93 RGBA，软件解码内容为 `SHIP-2026-0001`
- [x] 已验证 Chrome 150 / Edge 151 桌面端 A4 打印、390 px 移动端响应式和打印 CSS；两种浏览器 PDF 均可软件扫码
- [x] 已对直接 PDF 与浏览器打印 PDF 两条输出路径做渲染和软件扫码测试；真实打印机参数模板见 `docs/print-scan-test-plan.md`
- [x] 已在 Chrome 打印时序回归中确认运行时 CDN 风险并本地托管 `bwip-js 4.5.1`；仍不引入打包系统

**P0 验收：**上述输入不崩溃、不静默丢数据；生成数量正确；测试标签可稳定扫码。

## SEO / 技术债审计（与 P0 并行）

- [ ] 配置并确认生产环境 `http → https`、`non-www → www`、尾斜杠单跳服务端重定向（阻塞：需要 Cloudflare 项目权限）
- [x] 已在 Search Console 核对两类实际 URL 和最后抓取时间（见 `docs/seo-audit-2026-08-11.md`）
- [x] 已统一 canonical、Open Graph URL、sitemap、CNAME 和内链的 `www` 版本
- [ ] 用 Rich Results Test / Schema Validator 检查已部署页面（阻塞：本地解析与 URL 校验已通过，需部署后在线验证）
- [x] PDF417 长期主 URL 保留首页 `/`，不新增同义 `/pdf417-generator/`
- [x] 唯一主工作流 URL 选择 `/barcode-generator/`，不增加同义 bulk/batch 路由
- [x] sitemap 只保留 8 个 canonical、可索引、本地返回 200 的 URL，`lastmod` 已更新为 2026-08-11
- [x] 8 个页面的 title、description、H1、正文、Open Graph 和内链已通过 `node scripts/audit-site.js`

## P1：统一 Batch Barcode Generator

- [x] 优先扩展现有 `/barcode-generator/`，支持 PDF417、Code 128、QR Code 批量生成
- [x] 统一输入模型：多行文本和粘贴 CSV
- [x] 增加批量预览、数量提示、逐条错误提示和批次上限提示
- [x] 复用现有 `assets/barcode-tools.js`；仅在出现真实重复逻辑时拆分最小的格式配置 / adapter
- [x] 各格式只暴露必要参数，并实现格式专属校验
- [x] 保持 PDF417、Code 128、QR 等 SEO 页面独立，但共用生成能力
- [x] 增加最小回归检查，覆盖三种格式各一组合法和非法输入

**P1 验收：**同一工作流可批量生成三种核心条码；格式切换不丢输入；现有独立页面功能和 URL 不回退。

## P2：Printable PDF 与标签布局

- [x] 先完善浏览器打印 / “另存为 PDF” 工作流，避免过早引入 PDF 依赖
- [x] 支持 Page Size（A4、Letter）、Margins、Rows、Columns、Gap
- [x] 支持 Barcode Size、是否显示文字、文字位置
- [x] 提供分页预览，保证预览与打印结果一致
- [x] 处理跨页、空白页、裁切、缩放和超长文字
- [x] 已统一记录导入/生成/导出成功与失败、限制触发、首次字段映射、最终排版和打印打开；不含条码原文、文件名或列名
- [x] 已采用最小纯客户端 jsPDF 方案实现直接下载，并完成 A4 尺寸、渲染和扫码验收

**P2 验收：**用户能把一批条码排成 A4 / Letter 标签页，并得到尺寸正确、可扫码的 PDF 或打印件。

## P3：CSV / Excel 导入与字段映射

- [x] 第一阶段支持 CSV 文件上传、可靠解析、表头识别和数据预览
- [x] 用户可选择 barcode value 列和 label text 列
- [x] 支持选择额外显示字段
- [x] 显示空值、重复值、非法值和被跳过行，并允许返回修改映射
- [x] 明确最大文件大小、最大行数和浏览器性能提示
- [x] 第二阶段增加 `.xlsx` 导入；仅此时引入经过评估的 Excel 解析依赖
- [x] 所有文件默认只在浏览器本地处理，并在界面中明确说明

**P3 验收：**上传结构化 CSV / Excel 后，用户能完成字段映射、校验、批量生成并进入标签排版。

## P4：Barcode Label Printer

- [x] 提供 A4、Letter 基础预设
- [x] 保存常用布局参数到浏览器本地
- [x] 当前只保留 A4/Letter，经真实用户提出具体纸型后再增加；不预置未经验证的模板
- [x] 为每个预设记录纸张、边距、行列、间距和实测打印缩放
- [x] 增加“先打印一页测试”的明确提醒

**P4 验收：**用户选择预设后无需反复调参即可打印，并能复用上次布局。

## P5：SEO Landing Pages（逐页发布）

- [x] 已有首页 PDF417、通用 Barcode、Code 128、QR Code、EAN-13 页面
- [x] 根据 Search Console 查询新增 MicroPDF417 页面
- [x] 补充 Data Matrix 页面
- [x] 基于 GSC 数据和产品能力选择 `/barcode-generator/` 作为核心 workflow 页面
- [x] CSV Barcode、Excel to Barcode、Barcode to PDF、Barcode Label Printer 暂不拆页，统一由主 workflow 页承接
- [x] 增加 UPC-A 位数、校验位验证和独立页面
- [x] 本轮只增强一个 workflow 页面；后续以收录、排名和使用事件作为扩展门槛

**P5 验收：**每个新页面都有独立搜索意图、可用工具、原创说明、正确 canonical 和有效内链。

## 数据与变现准备（待讨论后定）

- [x] 第一目标用户假设：使用 CSV/Excel 的仓储、库存和小型电商操作人员（待访谈验证）
- [x] 首个付费时刻假设：超过 100 条的重复大批量任务，以及可复用标签模板/历史任务
- [x] 免费版保留完整 100 条导入、映射、排版、PNG ZIP、PDF 和打印闭环；高频大批量与复用能力作为候选付费边界
- [x] 已补齐代码层漏斗事件：进入工具 → 导入结果 → 字段映射 → 生成结果 → 排版 → 导出结果 / 打印打开
- [ ] 在 GA4 后台注册 `docs/analytics-plan.md` 中的自定义维度/指标并用 DebugView 验证（阻塞：需要 GA4 Editor 权限及部署后的线上事件）
- [ ] 收集 5–10 位真实用户的工作流、规模、设备、频率和替代方案（阻塞：需要真人招募；模板已准备）
- [ ] 根据访谈与行为数据选择首个收费功能和收费方式（阻塞：不能在没有真人/行为数据时伪造结论）

## 暂不做

- [x] 不一次性创建全部候选 Landing Pages
- [x] 不把静态站重写成 React / Vue 等框架
- [x] 不为每种条码复制一套完整生成器
- [x] 不在需求验证前建设账号、云存储、团队系统或 API
- [x] 不同时保留多个含义相同的 workflow URL

## 本轮验收证据（2026-08-11）

- `node assets/barcode-tools.test.js`：通过。
- `node scripts/audit-site.js`：8 个 canonical 页面通过元数据、内链和 JSON-LD 审计。
- PNG ZIP：3 个 615×265 RGBA 文件，分别解码为对应 Code 128 内容。
- PDF417 首张 PNG：561×93 RGBA，成功解码为原始测试值。
- 直接 PDF：1 页 A4 210×297 mm，3 张标签全部软件解码成功。
- Chrome 150 / Edge 151 打印 PDF：均为 1 页 A4 209.89×297.01 mm，渲染无裁切且三张标签全部软件解码成功。
- 390 px 移动端：无横向溢出，主导航可水平滚动，生成器和导出按钮按单列显示。
- 当前仍需外部条件的未勾选项：线上部署/Cloudflare 重定向、Google URL Inspection/Rich Results、真实打印机、5-10 位真实用户、社区发布和基于真实行为确定收费功能。
