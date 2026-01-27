# Kiến Trúc Multi-Tenant Domain

## Tổng quan

Hệ thống hỗ trợ multi-tenant domain với các tính năng:
- **Subdomain routing**: `ten-cua-hang.khoapp.vn`
- **Custom domain**: `hoangmobile.vn` → trỏ đến tenant
- **Path-based fallback**: `app.khoapp.vn/store/ten-cua-hang` (cho development)

## Cấu trúc Domain

```
khoapp.vn                    # Landing page chính
├── app.khoapp.vn            # App chính (login/register)
├── admin.khoapp.vn          # Platform Admin
├── api.khoapp.vn            # API Gateway
└── *.khoapp.vn              # Wildcard cho tenant subdomains
    ├── iphoneabc.khoapp.vn
    ├── hoangmobile.khoapp.vn
    └── ...
```

## Database Schema

### Bảng `tenants`
```sql
tenants
├── id (uuid)
├── subdomain (text, unique)      -- VD: "iphoneabc"
├── name (text)                   -- Tên cửa hàng
├── primary_domain (text)         -- Domain chính để hiển thị
├── allow_custom_domain (boolean) -- Cho phép gắn domain riêng
└── ...
```

### Bảng `custom_domains`
```sql
custom_domains
├── id (uuid)
├── tenant_id (uuid)              -- FK → tenants
├── domain (text, unique)         -- VD: "hoangmobile.vn"
├── is_verified (boolean)         -- Đã xác thực chưa
├── verified_at (timestamp)
├── verification_token (text)     -- Token để verify TXT record
├── ssl_status (text)             -- pending, active, failed
└── ...
```

## Flow Xác Thực Domain

### 1. Khách thêm domain
```
hoangmobile.vn → Tạo record với verification_token
```

### 2. Hướng dẫn cấu hình DNS
Khách cần thêm:
```
# TXT Record (để verify ownership)
Type: TXT
Name: _lovable
Value: lovable_verify_abc123xyz...

# CNAME Record (để routing)
Type: CNAME
Name: @
Value: hoangmobile.khoapp.vn
```

### 3. Verify và kích hoạt
- Hệ thống check TXT record
- Nếu đúng → `is_verified = true`
- Cấu hình SSL → `ssl_status = 'active'`

## Tenant Resolution Flow

```typescript
// Middleware hoặc trong App.tsx
function resolveTenant(hostname: string) {
  // 1. Kiểm tra custom domain
  const customDomain = await db.custom_domains
    .where('domain', hostname)
    .where('is_verified', true)
    .first();
  
  if (customDomain) return customDomain.tenant_id;
  
  // 2. Kiểm tra subdomain
  const subdomain = hostname.split('.')[0];
  const tenant = await db.tenants
    .where('subdomain', subdomain)
    .first();
  
  if (tenant) return tenant.id;
  
  // 3. Fallback: redirect về login
  return null;
}
```

## Triển Khai Production

### Yêu cầu Infrastructure

1. **Domain**: `khoapp.vn` hoặc domain bạn chọn
2. **Wildcard SSL**: `*.khoapp.vn`
3. **Reverse Proxy**: Nginx/Caddy với wildcard config
4. **DNS Provider**: Cloudflare (khuyến nghị) cho:
   - Wildcard DNS
   - SSL miễn phí
   - CDN

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/khoapp.vn

# Wildcard server block cho tenant subdomains
server {
    listen 443 ssl http2;
    server_name *.khoapp.vn;
    
    ssl_certificate /etc/letsencrypt/live/khoapp.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/khoapp.vn/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Main domain
server {
    listen 443 ssl http2;
    server_name khoapp.vn www.khoapp.vn;
    
    ssl_certificate /etc/letsencrypt/live/khoapp.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/khoapp.vn/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

### Caddy Configuration (Đơn giản hơn)

```caddyfile
# Caddyfile

# Wildcard cho tenant subdomains
*.khoapp.vn {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy localhost:3000
}

# Main domain
khoapp.vn, www.khoapp.vn {
    reverse_proxy localhost:3000
}
```

### Cloudflare Setup

1. **Thêm domain vào Cloudflare**
2. **Cấu hình DNS Records**:
   ```
   Type  Name     Content           Proxy
   A     @        YOUR_SERVER_IP    ✓
   A     *        YOUR_SERVER_IP    ✓
   CNAME www      khoapp.vn         ✓
   ```
3. **SSL/TLS Settings**: Full (strict)
4. **Bật Wildcard DNS**: Trong DNS settings

### Let's Encrypt Wildcard SSL

```bash
# Cài đặt certbot với Cloudflare plugin
sudo apt install certbot python3-certbot-dns-cloudflare

# Tạo cloudflare credentials file
echo "dns_cloudflare_api_token = YOUR_API_TOKEN" > ~/.cloudflare.ini
chmod 600 ~/.cloudflare.ini

# Lấy wildcard certificate
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials ~/.cloudflare.ini \
  -d khoapp.vn \
  -d "*.khoapp.vn"
```

## Frontend Implementation

### Tenant Context Provider

```typescript
// src/contexts/TenantContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { resolveTenantByDomain } from '@/hooks/useCustomDomains';

interface TenantContextType {
  tenantId: string | null;
  subdomain: string | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function resolve() {
      const hostname = window.location.hostname;
      
      // Development mode: sử dụng localStorage
      if (hostname === 'localhost' || hostname.includes('lovable.app')) {
        const storedTenantId = localStorage.getItem('current_tenant_id');
        setTenantId(storedTenantId);
        setIsLoading(false);
        return;
      }
      
      // Production: resolve từ domain
      const resolved = await resolveTenantByDomain(hostname);
      setTenantId(resolved);
      
      // Extract subdomain
      const parts = hostname.split('.');
      if (parts.length > 2) {
        setSubdomain(parts[0]);
      }
      
      setIsLoading(false);
    }
    
    resolve();
  }, []);

  return (
    <TenantContext.Provider value={{ tenantId, subdomain, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within TenantProvider');
  }
  return context;
}
```

### Route Protection

```typescript
// src/components/TenantRoute.tsx
import { useTenantContext } from '@/contexts/TenantContext';
import { Navigate } from 'react-router-dom';

export function TenantRoute({ children }: { children: React.ReactNode }) {
  const { tenantId, isLoading } = useTenantContext();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!tenantId) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}
```

## Custom Domain Verification Edge Function

```typescript
// supabase/functions/verify-domain/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domainId } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Lấy thông tin domain
    const { data: domain, error } = await supabase
      .from('custom_domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (error || !domain) {
      throw new Error('Domain không tồn tại');
    }

    // Check TXT record
    const txtRecords = await Deno.resolveDns(
      `_lovable.${domain.domain}`,
      'TXT'
    ).catch(() => []);

    const isVerified = txtRecords.some(
      (records) => records.some(
        (record) => record === domain.verification_token
      )
    );

    if (isVerified) {
      await supabase
        .from('custom_domains')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq('id', domainId);

      return new Response(
        JSON.stringify({ success: true, message: 'Domain đã được xác thực' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Không tìm thấy TXT record. Vui lòng kiểm tra cấu hình DNS.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## Mở Rộng Trong Tương Lai

### Modules theo subdomain/path

```
ten-cua-hang.khoapp.vn
├── /                    # Dashboard kho
├── /admin               # Quản lý kho (hiện tại)
├── /pos                 # POS - Bán hàng tại quầy
├── /shop                # Website bán hàng
│   ├── /san-pham        # Danh sách sản phẩm public
│   ├── /gio-hang        # Giỏ hàng
│   └── /thanh-toan      # Checkout
└── /api                 # API cho mobile app
```

### Gói dịch vụ

| Gói | Subdomain | Custom Domain | Web bán hàng | SEO |
|-----|-----------|---------------|--------------|-----|
| Free | ✓ | ✗ | ✗ | ✗ |
| Pro | ✓ | ✓ | ✓ | Basic |
| Enterprise | ✓ | ✓ | ✓ | Full |

## Checklist Triển Khai

- [ ] Mua domain (khoapp.vn)
- [ ] Setup Cloudflare
- [ ] Cấu hình wildcard DNS
- [ ] Setup VPS/Cloud server
- [ ] Cài đặt Nginx/Caddy
- [ ] Lấy wildcard SSL certificate
- [ ] Deploy application
- [ ] Test subdomain routing
- [ ] Test custom domain flow
- [ ] Setup monitoring & logging
