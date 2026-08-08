# PeopleCloud · 人间星图

一个以地图、时间和人物关系探索中国历史名人的沉浸式 Web 应用。MapLibre 负责可交互地理底图，Three.js 负责星尘、时代涟漪与人物关系弧线；核心内容、筛选和人物选择始终保留可访问的 HTML 交互。

## 本地运行

```bash
npm install
npm run dev
```

## 质量门禁

```bash
npm run check
npm run test:e2e
```

`npm run check` 会依次执行 TypeScript、ESLint、单元测试、人物语料校验和生产构建。

产品构思、交互与验收标准见 [docs/product-design.md](docs/product-design.md)，数据口径见 [docs/data-methodology.md](docs/data-methodology.md)，技术架构见 [docs/architecture.md](docs/architecture.md)。
