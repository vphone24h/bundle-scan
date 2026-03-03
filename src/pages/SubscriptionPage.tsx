import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  useCurrentTenant, 
  useSubscriptionPlans, 
  useCreatePaymentRequest,
  useCancelPaymentRequest,
  usePaymentRequests,
  useSubscriptionHistory,
  calculateRemainingDays 
} from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { useAdGateSettings } from '@/hooks/useAdGate';
import { 
  CreditCard, 
  Check, 
  Clock, 
  History, 
  Loader2,
  Copy,
  CheckCircle,
  Phone,
  QrCode,
  XCircle,
  MessageCircle,
  ExternalLink,
  Megaphone,
  ChevronRight,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getBankCode, generateVietQRUrl as generateQRUrl } from '@/lib/vietnameseBanks';
import { useTranslation } from 'react-i18next';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_active: boolean;
}

interface PaymentConfig {
  config_key: string;
  config_value: string | null;
}

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const { data: tenant } = useCurrentTenant();
  const { data: plans } = useSubscriptionPlans();
  const { data: payments } = usePaymentRequests(tenant?.id);
  const { data: history } = useSubscriptionHistory(tenant?.id);
  const { data: permissions } = usePermissions();
  const { data: adGateSettings } = useAdGateSettings();
  const createPayment = useCreatePaymentRequest();
  const cancelPayment = useCancelPaymentRequest();

  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [note, setNote] = useState('');
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentCode, setPaymentCode] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(0);

  useEffect(() => {
    if (window.location.hash === '#feedback') {
      setTimeout(() => {
        document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, []);

  const { data: configs } = useQuery({
    queryKey: ['payment-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_config').select('*');
      if (error) throw error;
      return data as PaymentConfig[];
    },
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as BankAccount[];
    },
  });

  const hotline = configs?.find(c => c.config_key === 'hotline')?.config_value || '0909 123 456';
  const companyName = configs?.find(c => c.config_key === 'company_name')?.config_value || 'Kho Hàng Pro';
  const feedbackZaloUrl = configs?.find(c => c.config_key === 'feedback_zalo_url')?.config_value || '';
  const feedbackFbUrl = configs?.find(c => c.config_key === 'feedback_fb_url')?.config_value || '';
  const feedbackHotline = configs?.find(c => c.config_key === 'feedback_hotline')?.config_value || '';
  const paypalEmail = configs?.find(c => c.config_key === 'paypal_email')?.config_value || '';
  const paypalNoteTemplate = configs?.find(c => c.config_key === 'paypal_note_template')?.config_value || 'MUA {GOI} - {SDT}';
  const usdExchangeRate = parseFloat(configs?.find(c => c.config_key === 'usd_exchange_rate')?.config_value || '25000');
  const primaryBank = bankAccounts?.[0];

  const isSuperAdmin = permissions?.role === 'super_admin';
  const remainingDays = calculateRemainingDays(tenant || null);
  const pendingPayment = payments?.find(p => p.status === 'pending');
  const activePlan = plans?.find(p => p.id === selectedPlan);

  const generateVietQRUrl = (bank: BankAccount, amount: number, content: string) => {
    const bankCode = getBankCode(bank.bank_name);
    if (!bankCode) return null;
    return generateQRUrl(bankCode, bank.account_number, amount, content, bank.account_holder);
  };

  const handleSelectPlan = (planId: string) => {
    if (pendingPayment) return;
    setSelectedPlan(planId);
    setNote('');
    setPaymentMethod('bank_transfer');
    setShowPlanDialog(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedPlan || !tenant) return;
    const plan = plans?.find(p => p.id === selectedPlan);
    if (!plan) return;

    try {
      const result = await createPayment.mutateAsync({
        tenant_id: tenant.id,
        plan_id: selectedPlan,
        amount: plan.price,
        payment_method: paymentMethod,
      });

      setPaymentCode(result.payment_code);
      setSelectedAmount(plan.price);
      setShowPlanDialog(false);
      setShowPaymentDialog(true);

      toast({ title: t('pages.subscription.paymentCreated'), description: t('pages.subscription.followInstructions') });
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('pages.subscription.copied') });
  };

  const getTransferContent = () => `${tenant?.subdomain?.toUpperCase() || ''} ${paymentCode}`;

  const convertToUsd = (vnd: number) => {
    if (!usdExchangeRate || usdExchangeRate <= 0) return 0;
    return Math.ceil(vnd / usdExchangeRate);
  };

  const getPaypalNote = () => {
    return paypalNoteTemplate
      .replace('{GOI}', activePlan?.name || '')
      .replace('{SDT}', tenant?.phone || tenant?.subdomain || '');
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title={t('pages.subscription.title')}
          description={t('pages.subscription.description')}
          helpText={t('pages.subscription.helpText')}
        />

        {/* Feedback - Only for super_admin */}
        {isSuperAdmin && (
          <Card id="feedback">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {t('pages.subscription.feedbackTitle')}
              </CardTitle>
              <CardDescription>
                {t('pages.subscription.feedbackDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {feedbackZaloUrl && (
                  <a href={`https://zalo.me/${feedbackZaloUrl.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex-shrink-0">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">Zalo</p>
                      <p className="text-xs text-muted-foreground truncate">{feedbackZaloUrl}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                )}
                {feedbackFbUrl && (
                  <a href={feedbackFbUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">Facebook</p>
                      <p className="text-xs text-muted-foreground truncate">{t('pages.subscription.supportPage')}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                )}
                {feedbackHotline && (
                  <a href={`tel:${feedbackHotline.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 flex-shrink-0">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">Hotline</p>
                      <p className="text-xs text-primary font-mono">{feedbackHotline}</p>
                    </div>
                  </a>
                )}
              </div>
              {!feedbackZaloUrl && !feedbackFbUrl && !feedbackHotline && (
                <p className="text-center py-4 text-muted-foreground text-sm">
                  {t('pages.subscription.noContactInfo')}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('pages.subscription.currentStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={
                    tenant?.status === 'active' ? 'default' :
                    tenant?.status === 'trial' ? 'secondary' :
                    (tenant?.status === 'expired' && adGateSettings?.is_enabled) ? 'secondary' :
                    'destructive'
                  }>
                    {tenant?.status === 'active' && t('pages.subscription.active')}
                    {tenant?.status === 'trial' && t('pages.subscription.trial')}
                    {tenant?.status === 'expired' && !adGateSettings?.is_enabled && t('pages.subscription.expired')}
                    {tenant?.status === 'expired' && adGateSettings?.is_enabled && t('pages.subscription.freeWithAds')}
                    {tenant?.status === 'locked' && t('pages.subscription.locked')}
                  </Badge>
                  {tenant?.subscription_plan && (
                    <Badge variant="outline">
                      {t('pages.subscription.plan')} {tenant.subscription_plan === 'monthly' && t('pages.subscription.monthly')}
                      {tenant.subscription_plan === 'yearly' && t('pages.subscription.yearly')}
                      {tenant.subscription_plan === 'lifetime' && t('pages.subscription.lifetime')}
                    </Badge>
                  )}
                  {tenant?.status === 'expired' && adGateSettings?.is_enabled && (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      <Megaphone className="h-3 w-3 mr-1" />
                      {t('pages.subscription.freeLifetime')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {tenant?.status === 'expired' && adGateSettings?.is_enabled
                    ? t('pages.subscription.usingFreeLifetime')
                    : remainingDays > 36500
                      ? t('pages.subscription.unlimitedUse')
                      : t('pages.subscription.daysRemaining', { days: remainingDays })}
                </p>
              </div>

              {pendingPayment && (
              <div className="bg-primary/10 text-primary px-4 py-3 rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{t('pages.subscription.pendingPayment')}</p>
                      <p className="text-xs">{t('pages.subscription.code')}: {pendingPayment.payment_code}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary/40 text-primary hover:bg-primary/10"
                        onClick={() => {
                          setPaymentCode(pendingPayment.payment_code);
                          setSelectedAmount(pendingPayment.amount);
                          setShowPaymentDialog(true);
                        }}
                      >
                        <QrCode className="h-4 w-4 mr-1" />
                        {t('pages.subscription.viewQR')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (confirm(t('pages.subscription.confirmCancelPayment'))) {
                            try {
                              await cancelPayment.mutateAsync(pendingPayment.id);
                              toast({ title: t('pages.subscription.requestCancelled'), description: t('pages.subscription.canCreateNew') });
                            } catch (error: any) {
                              toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
                            }
                          }
                        }}
                        disabled={cancelPayment.isPending}
                      >
                        {cancelPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1" />{t('pages.subscription.cancelRequest')}</>}
                      </Button>
                    </div>
                  </div>
                  {primaryBank && (
                    <div className="text-xs border-t border-primary/20 pt-2 space-y-1 text-primary/80">
                      <p>🏦 {primaryBank.bank_name} · STK: <span className="font-mono font-semibold">{primaryBank.account_number}</span>
                        <button className="ml-1 opacity-70 hover:opacity-100" onClick={() => copyToClipboard(primaryBank.account_number)}>
                          <Copy className="h-3 w-3 inline" />
                        </button>
                      </p>
                      <p>{t('pages.subscription.accountHolder')}: {primaryBank.account_holder}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hotline Support */}
            <div className="mt-4 pt-4 border-t flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('pages.subscription.supportHotline')}</p>
                <a href={`tel:${hotline.replace(/\s/g, '')}`} className="font-semibold text-primary hover:underline">{hotline}</a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Plans */}
        <div className="space-y-3">
          {pendingPayment && (
            <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
              {t('pages.subscription.hasPending')} {t('pages.subscription.cancelToBuy')}
            </div>
          )}

          <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${pendingPayment ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Free-with-ads plan */}
            {adGateSettings?.is_enabled && (
              <Card className={`border-dashed border-2 relative overflow-hidden ${
                tenant?.status === 'expired'
                  ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                  : 'border-muted-foreground/30 bg-muted/20'
              }`}>
                <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="text-xs">{t('pages.subscription.freeLabel')}</Badge>
                  {tenant?.status === 'expired' && (
                    <Badge variant="default" className="text-xs bg-primary/90">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('pages.subscription.usingThisPlan')}
                    </Badge>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-4 w-4 text-muted-foreground" />
                    {t('pages.subscription.freeLifetimePlan')}
                  </CardTitle>
                  <CardDescription>{t('pages.subscription.unlimitedDuration')}</CardDescription>
                  <p className="text-xs text-muted-foreground/70 italic mt-1">
                    {t('pages.subscription.defaultPlan')}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-muted-foreground mb-4">0đ</div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      {t('pages.subscription.permanentUse')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      {t('pages.subscription.fullFeatures')}
                    </li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {plans?.map((plan) => (
              <Card
                key={plan.id}
                className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/60 active:scale-[0.99] ${
                  pendingPayment ? '' : 'hover:ring-1 hover:ring-primary/30'
                }`}
                onClick={() => handleSelectPlan(plan.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary mb-1">
                    {formatNumber(plan.price)}đ
                  </div>
                  {paypalEmail && usdExchangeRate > 0 && (
                    <p className="text-sm text-muted-foreground mb-4">≈ {convertToUsd(plan.price)} USD</p>
                  )}
                  {!paypalEmail && <div className="mb-4" />}
                  <ul className="space-y-2 text-sm mb-4">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {plan.duration_days ? t('pages.subscription.daysOfUse', { days: plan.duration_days }) : t('pages.subscription.unlimitedUse')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {t('pages.subscription.maxBranches', { count: plan.max_branches })}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {t('pages.subscription.maxUsers', { count: plan.max_users })}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {t('pages.subscription.fullFeatures')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {t('pages.subscription.noAds')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {t('pages.subscription.socialBadge')}
                    </li>
                  </ul>
                  <Button className="w-full" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan.id); }}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t('pages.subscription.selectPlan')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t('pages.subscription.paymentHistory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history?.length === 0 && (
              <p className="text-muted-foreground text-center py-4">{t('pages.subscription.noHistory')}</p>
            )}
            <div className="space-y-3">
              {history?.map((item) => (
                <div key={item.id} className="flex items-start justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{item.action}</p>
                    <p className="text-sm text-muted-foreground">{item.note}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step 1: Plan Selection Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              {activePlan?.name}
            </DialogTitle>
            <DialogDescription>{activePlan?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Plan summary */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('pages.subscription.amount')}:</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-primary">{formatNumber(activePlan?.price || 0)}đ</span>
                  {paypalEmail && usdExchangeRate > 0 && (
                    <p className="text-xs text-muted-foreground">≈ {convertToUsd(activePlan?.price || 0)} USD</p>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('pages.subscription.duration')}:</span>
                <span className="font-medium">
                  {activePlan?.duration_days ? `${activePlan.duration_days} ${t('pages.subscription.days')}` : t('pages.subscription.lifetime')}
                </span>
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> {t('pages.subscription.maxBranches', { count: activePlan?.max_branches })}</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> {t('pages.subscription.maxUsers', { count: activePlan?.max_users })}</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> {t('pages.subscription.fullFeatures')}</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> {t('pages.subscription.noAds')}</li>
            </ul>

            {/* Payment method */}
            <div className="space-y-2">
              <Label className="font-medium">{t('pages.subscription.paymentMethod')}</Label>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-1">
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => setPaymentMethod('bank_transfer')}>
                  <RadioGroupItem value="bank_transfer" id="bank2" />
                  <Label htmlFor="bank2" className="cursor-pointer">{t('pages.subscription.bankTransfer')}</Label>
                </div>
                {paypalEmail && (
                  <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => setPaymentMethod('paypal')}>
                    <RadioGroupItem value="paypal" id="paypal2" />
                    <Label htmlFor="paypal2" className="cursor-pointer">{t('pages.subscription.paypalMethod')} ({convertToUsd(activePlan?.price || 0)} USD)</Label>
                  </div>
                )}
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => setPaymentMethod('momo')}>
                  <RadioGroupItem value="momo" id="momo2" />
                  <Label htmlFor="momo2" className="cursor-pointer">{t('pages.subscription.momoMethod')}</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label>{t('pages.subscription.noteOptional')}</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pages.subscription.notePlaceholder')} rows={2} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPlanDialog(false)}>{t('pages.subscription.cancelBtn')}</Button>
            <Button onClick={handleSubmitPayment} disabled={createPayment.isPending} className="flex-1 sm:flex-none">
              {createPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {paymentMethod === 'paypal' ? (
                <>{t('pages.subscription.createPaypalRequest')}</>
              ) : (
                <><QrCode className="h-4 w-4 mr-2" /> {t('pages.subscription.viewQRPayment')}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Payment Dialog (Bank Transfer or PayPal) */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paymentMethod === 'paypal' ? (
                <><span className="text-lg">🅿️</span> {t('pages.subscription.paypalPayment')}</>
              ) : (
                <><QrCode className="h-5 w-5" /> {t('pages.subscription.qrPayment')}</>
              )}
            </DialogTitle>
            <DialogDescription>
              {paymentMethod === 'paypal'
                ? t('pages.subscription.paypalInstructions')
                : t('pages.subscription.qrInstructions')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {paymentMethod === 'paypal' ? (
              <>
                {/* PayPal payment info */}
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('pages.subscription.paypalEmail')}:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{paypalEmail}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(paypalEmail)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('pages.subscription.usdAmount')}:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary text-lg">${convertToUsd(selectedAmount)} USD</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(convertToUsd(selectedAmount).toString())}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{t('pages.subscription.equivalent')}:</span>
                    <span>{formatNumber(selectedAmount)}đ ({t('pages.subscription.exchangeRate', { rate: formatNumber(usdExchangeRate) })})</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('pages.subscription.transferContent')}:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-primary text-sm">{getPaypalNote()}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(getPaypalNote())}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-1" dangerouslySetInnerHTML={{
                  __html: `<p>${t('pages.subscription.paypalNote1')}</p><p>${t('pages.subscription.paypalNote2')}</p>`
                }} />
              </>
            ) : (
              <>
                {/* Bank QR Code */}
                {primaryBank && (
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-lg border shadow-sm">
                      <img 
                        src={generateVietQRUrl(primaryBank, selectedAmount, getTransferContent()) || ''} 
                        alt="QR"
                        className="w-48 h-48 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  </div>
                )}

                {/* Bank Info */}
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  {primaryBank ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('pages.subscription.bank')}:</span>
                        <span className="font-medium">{primaryBank.bank_name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('pages.subscription.accountNumber')}:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{primaryBank.account_number}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(primaryBank.account_number)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('pages.subscription.accountHolder')}:</span>
                        <span className="font-medium">{primaryBank.account_holder}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground">{t('pages.subscription.noBankInfo')}</p>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('pages.subscription.bankAmount')}:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{formatNumber(selectedAmount)}đ</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(selectedAmount.toString())}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('pages.subscription.transferNote')}:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-primary">{getTransferContent()}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(getTransferContent())}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{t('pages.subscription.bankWarning')}</p>
                  <p className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {t('pages.subscription.hotlineSupport')}: <a href={`tel:${hotline}`} className="text-primary font-medium">{hotline}</a>
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowPaymentDialog(false)}>
              {paymentMethod === 'paypal' ? t('pages.subscription.iPaid') : t('pages.subscription.understood')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
