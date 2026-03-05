import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantLandingSettings, useUpdateTenantLandingSettings, TenantLandingSettings, uploadLandingAsset } from '@/hooks/useTenantLanding';
import { useCurrentTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, Eye, Settings2, Save, ArrowLeft, Monitor, Smartphone, Tablet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getIndustryConfig, getFullNavItems } from '@/lib/industryConfig';
import { EditorPreviewTab } from '@/components/website-editor/EditorPreviewTab';
import { EditorSettingsTab } from '@/components/website-editor/EditorSettingsTab';

type DeviceMode = 'mobile' | 'tablet' | 'desktop';

export default function WebsiteEditorPage() {
  const navigate = useNavigate();
  const { data: permissions, isLoading: permLoading } = usePermissions();
  const { data: tenant } = useCurrentTenant();
  const { data: settings, isLoading } = useTenantLandingSettings();
  const updateSettings = useUpdateTenantLandingSettings();

  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('mobile');
  const [focusSection, setFocusSection] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<TenantLandingSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize form data from settings
  useEffect(() => {
    if (settings) {
      setFormData({
        is_enabled: settings.is_enabled,
        show_warranty_lookup: settings.show_warranty_lookup,
        show_store_info: settings.show_store_info,
        show_banner: settings.show_banner,
        show_branches: settings.show_branches ?? true,
        store_name: settings.store_name || '',
        store_logo_url: settings.store_logo_url || '',
        store_address: settings.store_address || '',
        additional_addresses: settings.additional_addresses || [],
        store_phone: settings.store_phone || '',
        store_email: settings.store_email || '',
        store_description: settings.store_description || '',
        banner_image_url: settings.banner_image_url || '',
        banner_link_url: settings.banner_link_url || '',
        primary_color: settings.primary_color || '#0f766e',
        meta_title: settings.meta_title || '',
        meta_description: settings.meta_description || '',
        warranty_hotline: settings.warranty_hotline || '',
        support_group_url: settings.support_group_url || '',
        facebook_url: settings.facebook_url || '',
        zalo_url: settings.zalo_url || '',
        tiktok_url: settings.tiktok_url || '',
        voucher_enabled: settings.voucher_enabled ?? false,
        voucher_template_id: settings.voucher_template_id || null,
        website_template: settings.website_template || 'phone_store',
        ai_description_enabled: settings.ai_description_enabled ?? true,
        auto_image_enabled: settings.auto_image_enabled ?? true,
        custom_trust_badges: (settings as any).custom_trust_badges || null,
        custom_nav_items: (settings as any).custom_nav_items || null,
        hero_title: (settings as any).hero_title || null,
        hero_subtitle: (settings as any).hero_subtitle || null,
        hero_cta: (settings as any).hero_cta || null,
        custom_home_sections: (settings as any).custom_home_sections || null,
        custom_product_tabs: (settings as any).custom_product_tabs || [],
        custom_font_family: (settings as any).custom_font_family || null,
        custom_layout_style: (settings as any).custom_layout_style || null,
        custom_products_page_sections: (settings as any).custom_products_page_sections || null,
        custom_products_page_tabs: (settings as any).custom_products_page_tabs || [],
        custom_product_detail_sections: (settings as any).custom_product_detail_sections || null,
        custom_news_page_sections: (settings as any).custom_news_page_sections || null,
        custom_news_page_tabs: (settings as any).custom_news_page_tabs || [],
        order_email_enabled: (settings as any).order_email_enabled ?? false,
        order_email_sender: (settings as any).order_email_sender || '',
        order_email_app_password: (settings as any).order_email_app_password || '',
        order_email_on_confirmed: (settings as any).order_email_on_confirmed ?? false,
        order_email_on_shipping: (settings as any).order_email_on_shipping ?? false,
        order_email_on_warranty: (settings as any).order_email_on_warranty ?? false,
        menu_position: (settings as any).menu_position || 'left',
      } as any);
    } else if (tenant) {
      setFormData(prev => ({ ...prev, store_name: tenant.name || '' }));
    }
  }, [settings, tenant]);

  const handleChange = useCallback((field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  // Auto-save: debounce 1.5s after any change
  useEffect(() => {
    if (!hasChanges || !isInitializedRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      updateSettings.mutateAsync(formData).then(() => {
        setHasChanges(false);
        toast({ title: '✓ Đã tự động lưu' });
      }).catch(() => {
        toast({ title: 'Lỗi', description: 'Không thể lưu. Vui lòng thử lại.', variant: 'destructive' });
      });
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [formData, hasChanges]);

  // Mark initialized after first settings load
  useEffect(() => {
    if (settings && !isInitializedRef.current) {
      // Small delay to avoid triggering auto-save from initial setFormData
      setTimeout(() => { isInitializedRef.current = true; }, 500);
    }
  }, [settings]);

  const handleSave = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    try {
      await updateSettings.mutateAsync(formData);
      setHasChanges(false);
      toast({ title: '✓ Đã lưu' });
    } catch {
      toast({ title: 'Lỗi', description: 'Không thể lưu. Vui lòng thử lại.', variant: 'destructive' });
    }
  };

  const handleEditSection = (sectionId: string) => {
    setFocusSection(sectionId);
    setActiveTab('edit');
  };

  const role = permissions?.role;
  if (!permLoading && role !== 'super_admin') {
    return <Navigate to="/landing-settings" replace />;
  }

  if (isLoading || permLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Top toolbar - hidden on mobile, shown on tablet/desktop */}
      <header className="hidden sm:flex items-center justify-between px-3 py-2 border-b bg-card shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/landing-settings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold truncate max-w-none">
            {formData.store_name || 'Website Editor'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`p-1.5 rounded-md transition-colors ${deviceMode === 'mobile' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode('tablet')}
              className={`p-1.5 rounded-md transition-colors ${deviceMode === 'tablet' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            >
              <Tablet className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`p-1.5 rounded-md transition-colors ${deviceMode === 'desktop' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleSave}
            disabled={!hasChanges || updateSettings.isPending}
          >
            {updateSettings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Lưu
          </Button>
        </div>
      </header>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'preview' ? (
          <div className="h-full overflow-y-auto">
            <EditorPreviewTab
              formData={formData}
              deviceMode={deviceMode}
              tenant={tenant}
              onEditSection={handleEditSection}
            />
          </div>
        ) : (
          <EditorSettingsTab
            formData={formData}
            onChange={handleChange}
            focusSection={focusSection}
            onClearFocus={() => setFocusSection(null)}
            tenantId={tenant?.id || null}
            onSave={handleSave}
            isSaving={updateSettings.isPending}
            hasChanges={hasChanges}
          />
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="flex items-center border-t bg-card shrink-0 sm:hidden">
        <button
          onClick={() => navigate('/landing-settings')}
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-[10px] font-medium">Quay lại</span>
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
            activeTab === 'preview' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Eye className="h-5 w-5" />
          <span className="text-[10px] font-medium">Xem trước</span>
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative ${
            activeTab === 'edit' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Settings2 className="h-5 w-5" />
          <span className="text-[10px] font-medium">Chỉnh sửa</span>
          {hasChanges && (
            <span className="absolute top-1.5 right-[calc(50%-8px)] h-2 w-2 rounded-full bg-destructive" />
          )}
        </button>
      </div>
      {/* Desktop bottom bar */}
      <div className="hidden sm:flex items-center border-t bg-card shrink-0">
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
            activeTab === 'preview' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Eye className="h-5 w-5" />
          <span className="text-[10px] font-medium">Xem trước</span>
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative ${
            activeTab === 'edit' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Settings2 className="h-5 w-5" />
          <span className="text-[10px] font-medium">Chỉnh sửa</span>
          {hasChanges && (
            <span className="absolute top-1.5 right-[calc(50%-8px)] h-2 w-2 rounded-full bg-destructive" />
          )}
        </button>
      </div>
    </div>
  );
}
