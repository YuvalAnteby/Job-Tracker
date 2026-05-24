import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSettingsData } from './useSettingsData';
import { Settings as SettingsType } from '../../types/settings';
import { Domain } from '../../types';
import { 
  Save, 
  Bot, 
  Target, 
  Bell, 
  FileText, 
  RefreshCw,
  AlertCircle,
  Check
} from 'lucide-react';
import { cn } from '../../utils/cn';
import toast from 'react-hot-toast';

import { format } from 'date-fns';

interface SettingsForm {
  score_threshold: number;
  llm_provider: string;
  llm_model: string;
  applicable_domains: Domain[];
  domain_keywords: Record<string, string>; // domain -> comma-separated keywords
  telegram_allowed_chat_ids: string; // comma-separated
  master_cv_url: string;
}

const Settings: React.FC = () => {
  const { 
    settings, 
    isLoading, 
    updateSettings, 
    isUpdating, 
    refreshCv, 
    isRefreshing 
  } = useSettingsData();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty }
  } = useForm<SettingsForm>({
    defaultValues: {
      score_threshold: 70,
      llm_provider: 'gemini',
      llm_model: 'gemini-2.5-flash',
      applicable_domains: [],
      domain_keywords: {},
      telegram_allowed_chat_ids: '',
      master_cv_url: ''
    }
  });

  const selectedDomains = watch('applicable_domains') || [];

  useEffect(() => {
    if (settings) {
      const formKeywords: Record<string, string> = {};
      Object.entries(settings.domain_keywords).forEach(([domain, keywords]) => {
        formKeywords[domain] = keywords.join(', ');
      });

      reset({
        score_threshold: settings.score_threshold,
        llm_provider: settings.llm_provider,
        llm_model: settings.llm_model,
        applicable_domains: settings.applicable_domains,
        domain_keywords: formKeywords,
        telegram_allowed_chat_ids: settings.telegram_allowed_chat_ids.join(', '),
        master_cv_url: settings.master_cv_url || ''
      });
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsForm) => {
    const domainKeywords: Record<Domain, string[]> = {} as Record<Domain, string[]>;
    Object.entries(data.domain_keywords).forEach(([domain, keywordStr]) => {
      domainKeywords[domain as Domain] = keywordStr
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
    });

    const telegramIds = data.telegram_allowed_chat_ids
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));

    const payload: Partial<SettingsType> = {
      score_threshold: Number(data.score_threshold),
      llm_provider: data.llm_provider,
      llm_model: data.llm_model,
      applicable_domains: data.applicable_domains,
      domain_keywords: domainKeywords,
      telegram_allowed_chat_ids: telegramIds,
      master_cv_url: data.master_cv_url
    };

    updateSettings(payload, {
      onSuccess: () => {
        toast.success('Settings updated');
      },
      onError: () => {
        toast.error('Failed to update settings');
      }
    });
  };

  const handleRefreshCv = () => {
    refreshCv(undefined, {
      onSuccess: () => toast.success('CV refresh triggered'),
      onError: () => toast.error('Failed to trigger CV refresh')
    });
  };

  const toggleDomain = (domain: Domain) => {
    const current = [...selectedDomains];
    const index = current.indexOf(domain);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(domain);
    }
    setValue('applicable_domains', current, { shouldDirty: true });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-r-transparent"></div>
          <span className="text-gray-500 dark:text-slate-400 font-medium">Loading preferences...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-500 dark:text-slate-400">Configure your personal job analyzer and notification preferences.</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
        {/* Section: AI Engine */}
        <section className="space-y-6">
          <div className="flex items-center space-x-3 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <Bot className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">AI Analysis</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Score Threshold
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  {...register('score_threshold')}
                  className="flex-grow h-2 bg-gray-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-lg font-bold text-blue-600 w-12 text-center">
                  {watch('score_threshold')}%
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-500">
                Jobs below this fit score will be marked as "Low Fit" by default.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  LLM Provider
                </label>
                <select
                  {...register('llm_provider')}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Model
                </label>
                <input
                  type="text"
                  {...register('llm_model')}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white"
                  placeholder="e.g. gemini-2.0-flash"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section: Domains & Keywords */}
        <section className="space-y-6">
          <div className="flex items-center space-x-3 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Target className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Target Domains</h2>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Applicable Domains
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.values(Domain).map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => toggleDomain(domain)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                      selectedDomains.includes(domain)
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                        : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:border-blue-400"
                    )}
                  >
                    {domain}
                    {selectedDomains.includes(domain) && <Check className="inline-block ml-2 h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {selectedDomains.map((domain) => (
                <div key={domain} className="space-y-2 animate-in fade-in slide-in-from-left-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{domain} Keywords</span>
                    <div className="h-px flex-grow bg-gray-100 dark:bg-slate-800"></div>
                  </div>
                  <textarea
                    {...register(`domain_keywords.${domain}`)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white min-h-[80px]"
                    placeholder="Enter keywords separated by commas..."
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    Keywords used to automatically classify jobs into the {domain} domain.
                  </p>
                </div>
              ))}
              {selectedDomains.length === 0 && (
                <div className="p-8 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-center">
                  <AlertCircle className="h-8 w-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-slate-500 italic">Select at least one domain to configure keywords.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section: Experience / CV */}
        <section className="space-y-6">
          <div className="flex items-center space-x-3 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Master CV</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                CV Google Drive / Docs URL
              </label>
              <input
                type="text"
                {...register('master_cv_url')}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white"
                placeholder='e.g. "https://docs.google.com/document/d/..."'
              />
              <p className="text-xs text-gray-500 dark:text-slate-500">
                Supports Google Docs links and direct download links to raw .md or .txt files.
              </p>
            </div>

            <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-6 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">Personal Baseline</h3>
                <p className="text-sm text-amber-800/70 dark:text-amber-300/60 mt-1 max-w-md">
                  The LLM compares every job against your master profile. {settings?.master_cv_cached_at ? `Last refreshed: ${format(new Date(settings.master_cv_cached_at), 'MMM d, yyyy HH:mm')}` : 'Never refreshed.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefreshCv}
                disabled={isRefreshing || !watch('master_cv_url')}
                className="flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh Now'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section: Telegram */}
        <section className="space-y-6">
          <div className="flex items-center space-x-3 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="p-2 bg-sky-50 dark:bg-sky-900/30 rounded-lg text-sky-600 dark:text-sky-400">
              <Bell className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Allowed Telegram Chat IDs
              </label>
              <input
                type="text"
                {...register('telegram_allowed_chat_ids')}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white"
                placeholder="e.g. 12345678, 87654321"
              />
              <p className="text-xs text-gray-500 dark:text-slate-500">
                Only users with these Chat IDs can interact with the bot. Use comma-separated values.
              </p>
            </div>
          </div>
        </section>

        {/* Floating Action Bar */}
        <div className={cn(
          "fixed bottom-8 right-8 flex items-center space-x-4 transition-all transform",
          isDirty ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
        )}>
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-all font-semibold active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUpdating}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all font-semibold active:scale-95 disabled:opacity-50"
          >
            {isUpdating ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
