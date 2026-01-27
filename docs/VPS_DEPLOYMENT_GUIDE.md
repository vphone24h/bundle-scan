# Hướng dẫn triển khai VPS cho Wildcard Subdomain

## Mục tiêu
Cho phép khách hàng truy cập: `storeid.vkho.vn` thay vì nhập Store ID khi đăng nhập.

---

## Bước 1: Thuê VPS

### Đề xuất nhà cung cấp
| Provider | Gói đề xuất | Giá/tháng |
|----------|-------------|-----------|
| **DigitalOcean** | Basic Droplet 1GB | ~$6 |
| **Vultr** | Cloud Compute 1GB | ~$6 |
| **Linode** | Nanode 1GB | ~$5 |
| **AWS Lightsail** | 1GB | ~$5 |

### Yêu cầu tối thiểu
- **OS**: Ubuntu 22.04 LTS
- **RAM**: 1GB (2GB nếu có nhiều traffic)
- **Storage**: 25GB SSD
- **Bandwidth**: 1TB/tháng

---

## Bước 2: Cấu hình DNS tại nhà cung cấp domain

Thêm các record sau cho `vkho.vn`:

```
Type    Name    Value               TTL
A       @       [IP_VPS]            3600
A       www     [IP_VPS]            3600
A       *       [IP_VPS]            3600
```

> ⚠️ Record `*` (wildcard) sẽ route tất cả subdomain về VPS

---

## Bước 3: Cài đặt VPS

### SSH vào VPS
```bash
ssh root@[IP_VPS]
```

### Cập nhật hệ thống
```bash
apt update && apt upgrade -y
```

### Cài đặt Caddy (đề xuất - tự động SSL)
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy
```

---

## Bước 4: Cấu hình Caddy

### Tạo file Caddyfile
```bash
nano /etc/caddy/Caddyfile
```

### Nội dung Caddyfile
```caddyfile
# Domain chính và www
vkho.vn, www.vkho.vn {
    reverse_proxy localhost:3000
}

# Wildcard subdomain cho tất cả cửa hàng
*.vkho.vn {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy localhost:3000
}
```

### Khởi động lại Caddy
```bash
systemctl restart caddy
systemctl enable caddy
```

---

## Bước 5: Cài đặt Cloudflare cho Wildcard SSL

### Tại sao cần Cloudflare?
- Let's Encrypt yêu cầu DNS challenge cho wildcard SSL
- Cloudflare API giúp tự động hóa quá trình này

### Các bước:
1. Đăng ký Cloudflare (miễn phí): https://cloudflare.com
2. Thêm domain `vkho.vn` vào Cloudflare
3. Đổi nameserver tại nhà đăng ký domain sang Cloudflare
4. Tạo API Token:
   - My Profile → API Tokens → Create Token
   - Template: "Edit zone DNS"
   - Zone: `vkho.vn`
   - Copy token

### Thêm token vào VPS
```bash
nano /etc/caddy/caddy.env
```

```env
CLOUDFLARE_API_TOKEN=your_token_here
```

```bash
systemctl edit caddy
```

Thêm:
```ini
[Service]
EnvironmentFile=/etc/caddy/caddy.env
```

```bash
systemctl daemon-reload
systemctl restart caddy
```

---

## Bước 6: Deploy ứng dụng

### Option A: Build static và serve (đề xuất)

```bash
# Cài Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Clone repo
git clone [YOUR_REPO_URL] /var/www/vkho
cd /var/www/vkho

# Cài dependencies và build
npm install
npm run build

# Serve static files
npm install -g serve
serve -s dist -l 3000
```

### Sử dụng PM2 để quản lý process
```bash
npm install -g pm2
pm2 start "serve -s dist -l 3000" --name vkho
pm2 startup
pm2 save
```

### Option B: Export từ Lovable
1. Vào Lovable → Project Settings → Export
2. Download source code
3. Upload lên VPS và build

---

## Bước 7: Kiểm tra

1. Truy cập `https://vkho.vn` → Trang chủ
2. Truy cập `https://test.vkho.vn` → Auto-detect subdomain "test"
3. Truy cập `https://storeid.vkho.vn` → Login với store đó

---

## Troubleshooting

### SSL không hoạt động
```bash
caddy validate --config /etc/caddy/Caddyfile
journalctl -u caddy -f
```

### Subdomain không resolve
```bash
nslookup test.vkho.vn
dig test.vkho.vn
```

### Kiểm tra Caddy logs
```bash
journalctl -u caddy --since "1 hour ago"
```

---

## Chi phí ước tính

| Hạng mục | Chi phí/tháng |
|----------|---------------|
| VPS (1GB) | ~$5-6 |
| Domain | ~$10-15/năm |
| Cloudflare | Miễn phí |
| **Tổng** | **~$6/tháng** |

---

## Lưu ý bảo mật

1. Cấu hình firewall:
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

2. Tạo user non-root:
```bash
adduser deploy
usermod -aG sudo deploy
```

3. Cập nhật định kỳ:
```bash
apt update && apt upgrade -y
```
