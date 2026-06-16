# 使用官方 Deno 镜像
FROM denoland/deno:1.45.5

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 缓存依赖项
RUN deno cache src/deno_index.ts

# 暴露端口
EXPOSE 8001

# 启动应用
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "src/deno_index.ts"]