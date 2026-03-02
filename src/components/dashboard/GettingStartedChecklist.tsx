import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronDown, ChevronUp, Rocket, X, Package, Users, ShoppingCart, FileDown, FolderTree, Globe, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface ChecklistStep {
  key: string;
  labelKey: string;
  descKey: string;
  icon: React.ReactNode;
  link: string;
  actionKey: string;
  highlight?: boolean;
}

const STEPS: ChecklistStep[] = [
  {
    key: 'branch',
    labelKey: 'checklist.branch',
    descKey: 'checklist.branchDesc',
    icon: <Building2 className="h-4 w-4" />,
    link: '/branches',
    actionKey: 'checklist.branchAction',
  },
  {
    key: 'import',
    labelKey: 'checklist.import',
    descKey: 'checklist.importDesc',
    icon: <FileDown className="h-4 w-4" />,
    link: '/import/new',
    actionKey: 'checklist.importAction',
    highlight: true,
  },
  {
    key: 'category',
    labelKey: 'checklist.category',
    descKey: 'checklist.categoryDesc',
    icon: <FolderTree className="h-4 w-4" />,
    link: '/categories',
    actionKey: 'checklist.categoryAction',
  },
  {
    key: 'export',
    labelKey: 'checklist.export',
    descKey: 'checklist.exportDesc',
    icon: <ShoppingCart className="h-4 w-4" />,
    link: '/export/new',
    actionKey: 'checklist.exportAction',
    highlight: true,
  },
  {
    key: 'customer',
    labelKey: 'checklist.customer',
    descKey: 'checklist.customerDesc',
    icon: <Users className="h-4 w-4" />,
    link: '/customers',
    actionKey: 'checklist.customerAction',
  },
  {
    key: 'product',
    labelKey: 'checklist.product',
    descKey: 'checklist.productDesc',
    icon: <Package className="h-4 w-4" />,
    link: '/products',
    actionKey: 'checklist.productAction',
  },
  {
    key: 'supplier',
    labelKey: 'checklist.supplier',
    descKey: 'checklist.supplierDesc',
    icon: <Users className="h-4 w-4" />,
    link: '/suppliers',
    actionKey: 'checklist.supplierAction',
  },
  {
    key: 'landing',
    labelKey: 'checklist.landing',
    descKey: 'checklist.landingDesc',
    icon: <Globe className="h-4 w-4" />,
    link: '/landing-settings',
    actionKey: 'checklist.landingAction',
  },
];

const DISMISSED_KEY = 'vkho_checklist_dismissed';

function useChecklistStatus() {
  return useQuery({
    queryKey: ['getting-started-checklist'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_getting_started_status');
      if (error) throw error;
      return (data || {}) as Record<string, boolean>;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function GettingStartedChecklist() {
  const { t } = useTranslation();
  const { data: status } = useChecklistStatus();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  });

  const completedCount = status ? STEPS.filter(s => status[s.key]).length : 0;
  const totalSteps = STEPS.length;
  const progress = Math.round((completedCount / totalSteps) * 100);
  const allDone = completedCount === totalSteps;

  if (!status) return null;
  if (allDone) {
    if (!isDismissed) {
      localStorage.setItem(DISMISSED_KEY, 'true');
      setIsDismissed(true);
    }
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setIsDismissed(true);
  };

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm sm:text-base">
              {allDone ? t('checklist.setupComplete') : t('checklist.getStarted')}
            </h3>
            <span className="text-xs text-muted-foreground">{completedCount}/{totalSteps}</span>
          </div>
          <Progress value={progress} className="h-1.5 mt-1.5" />
        </div>
        <div className="flex items-center gap-1">
          {(allDone || completedCount >= 3) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              title={t('checklist.hideChecklist')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Steps */}
      {isExpanded && (
        <div className="border-t divide-y">
          {STEPS.map((step) => {
            const done = status[step.key];
            return (
              <div
                key={step.key}
                className={cn(
                  'flex items-start gap-3 p-3 sm:p-4 transition-colors',
                  done && 'bg-muted/30'
                )}
              >
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 transition-colors',
                  done
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/30 text-muted-foreground'
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    done && 'line-through text-muted-foreground'
                  )}>
                    {t(step.labelKey)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(step.descKey)}</p>
                </div>
                {!done && step.highlight ? (
                  <Button asChild className="shrink-0 h-9 px-4 text-sm font-bold bg-green-600 hover:bg-green-700 text-white shadow-md">
                    <Link to={step.link}>{t(step.actionKey)}</Link>
                  </Button>
                ) : !done ? (
                  <Button variant="outline" size="sm" asChild className="shrink-0 h-7 text-xs">
                    <Link to={step.link}>{t(step.actionKey)}</Link>
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}