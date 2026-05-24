# start.sh build 修复记录

## 问题

`bash start.sh build` 执行失败，输出：

```
> vite build
sh: vite: not found
```

## 根因

原命令（`start.sh:89`）：

```bash
docker run --rm --user "$UID:$GID" -v "$(pwd):/workspace" -w /workspace "$IMG" npm run build:client
```

- `-v "$(pwd):/workspace"` 将宿主机项目根挂载到容器内 `/workspace`
- `-w /workspace` 将工作目录设为 `/workspace`
- 镜像中 `node_modules` 位于 `/app/node_modules`（Docker build 阶段安装）
- `/workspace` 下没有 `node_modules`，npm 无法找到 `vite` 二进制

## 修改过程

### 第 1 轮：改挂载路径

将单一大范围挂载改为逐个挂载所需文件到 `/app` 下，保留镜像原有的 `node_modules`：

```bash
docker run --rm --user "$UID:$GID" \
  -v "$(pwd)/src/client:/app/src/client" \
  -v "$(pwd)/vite.config.js:/app/vite.config.js" \
  -v "$(pwd)/postcss.config.js:/app/postcss.config.js" \
  -v "$(pwd)/tailwind.config.js:/app/tailwind.config.js" \
  -v "$(pwd)/dist/client:/app/dist/client" \
  "$IMG" npm run build:client
```

**结果**：`vite` 可找到，但出现权限错误：

```
EACCES: permission denied, open '/app/node_modules/.vite-temp/...'
```

`node_modules` 在镜像中归属 `root`，`--user` 指定的非 root 用户无法写入 `.vite-temp` 目录。

### 第 2 轮：尝试先 chmod 再构建

```bash
"$IMG" sh -c "chmod -R a+w /app/node_modules && npm run build:client"
```

**结果**：`chmod: /app/node_modules: Operation not permitted` — 非 root 用户无权修改 root 文件的权限。

### 第 3 轮（最终方案）：以 root 运行 + chown 输出

```bash
docker run --rm \
  -v "$(pwd)/src/client:/app/src/client" \
  -v "$(pwd)/vite.config.js:/app/vite.config.js" \
  -v "$(pwd)/postcss.config.js:/app/postcss.config.js" \
  -v "$(pwd)/tailwind.config.js:/app/tailwind.config.js" \
  -v "$(pwd)/tsconfig.json:/app/tsconfig.json" \
  -v "$(pwd)/dist/client:/app/dist/client" \
  "$IMG" sh -c "npm run build:client && chown -R $CURRENT_UID:$CURRENT_GID /app/dist/client"
```

关键点：
1. **去掉 `--user`** — 以 root 运行容器，可正常读写 `/app/node_modules`
2. **构建完成后 `chown`** — 将 `dist/client` 输出文件归属改回宿主机用户，解决文件所有权问题
3. **逐个挂载需要的文件/目录** — 保留镜像的 `node_modules`，同时让宿主机源码变更生效

## 最终验证

```
> vite build
vite v6.4.2 building for production...
transforming...
✓ 58 modules transformed.
rendering chunks...
computing gzip size...
../../dist/client/index.html                   0.62 kB
../../dist/client/assets/index-ChHKFXa_.css   32.15 kB
../../dist/client/assets/index-Bk7ZV_lt.js   312.44 kB
✓ built in 3.64s
```

输出文件所有权：

```
drwxr-xr-x 3 jinyt jinyt   4096  dist/client/
drwxr-xr-x 2 jinyt jinyt   4096  dist/client/assets/
-rw-r--r-- 1 jinyt jinyt    616  dist/client/index.html
```

## 相关文件

- `start.sh` — 第 89 行：构建命令
- `docker/Dockerfile` — 镜像构建，`node_modules` 安装于 `/app/node_modules`
- `docs/start.sh build 修复记录.md` — 本文档
