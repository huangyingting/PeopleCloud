# 部署

应用输出为纯静态 `dist/`，可部署到 Netlify、Cloudflare Pages、Vercel 静态站点或自有 Nginx。构建命令为 `npm ci && npm run check`，发布目录为 `dist`。

## 必需规则

1. 所有非文件路径回退到 `/index.html`，使带 `period`、`person` 查询参数的链接可恢复。
2. `assets/` 使用一年不可变缓存；`index.html` 不缓存。
3. 配置 `public/_headers` 中的安全响应头。若托管商不读取该文件，请在平台上等价配置。
4. CSP 只允许本域资源及 `https://tiles.openfreemap.org` 的地图瓦片；更换瓦片提供方时同步更新 CSP 和 attribution。
5. 上线前运行 `npm run check && npm run test:e2e`，并在目标域名确认瓦片 CORS、字体和 Web Worker 均能加载。

## 健康检查

静态站点的健康检查可请求 `/` 并要求 HTTP 200、HTML 中包含 `PeopleCloud`。地图瓦片是增强资源；其短时故障不应使站点整体健康检查失败。
