# PeopleCloud · 人间星图

一个以地图、时间和人物关系探索中国历史名人的沉浸式 Web 应用。当前收录 248 位人物，覆盖先秦至清末的 14 个时期与 8 个领域；本轮为每个时期等量新增 5 人。MapLibre 负责可交互地理底图，Three.js 负责领域星色、空间星网、选择涟漪与关系流光；核心内容、筛选和人物选择始终保留可访问的 HTML 交互。

## 本地运行

```bash
npm install
npm run dev
```

## 质量门禁

```bash
npm run check
npm run test:e2e
npm run verify:sources
```

`npm run check` 会依次执行 TypeScript、ESLint、单元测试、人物语料校验和生产构建。
`npm run verify:sources` 是需要联网的独立审计，检查所有人物来源链接是否可访问；为避免让离线构建依赖外部站点，它不并入 `npm run check`。

地图会按屏幕空间自动避让人物标签，但不会移除人物按钮；放大、悬停、键盘聚焦或选择人物时都能看到相应标签。开启系统“减少动态效果”后，Three.js 关系流光和持续旋转会停在静态状态。

产品构思、交互与验收标准见 [docs/product-design.md](docs/product-design.md)，数据口径见 [docs/data-methodology.md](docs/data-methodology.md)，技术架构见 [docs/architecture.md](docs/architecture.md)。
