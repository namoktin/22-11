# Sử dụng Node.js 22 LTS Debian-slim hỗ trợ tốt ffmpeg và native modules
FROM node:22-bullseye-slim

WORKDIR /app

# Cài đặt ffmpeg và curl cho healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt dependencies trước để tận dụng Docker layer cache
COPY package*.json ./
RUN npm ci --only=production

# Copy toàn bộ mã nguồn dự án vào container
COPY . .

# Đảm bảo các thư mục dữ liệu và âm thanh tồn tại
RUN mkdir -p audio data logs

# Biến môi trường mặc định (Google Cloud Run dùng PORT=8080)
ENV NODE_ENV=production
ENV KIEMTHU_IN_PROCESS=true
ENV TRUST_PROXY=true
ENV PORT=8080

EXPOSE 8080

# Kiểm tra sức khỏe container định kỳ
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Khởi động server
CMD ["npm", "start"]
