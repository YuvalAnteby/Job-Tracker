/* eslint-disable react-hooks/set-state-in-effect -- query snapshots initialize and reset independent editor forms */
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Bell,
  Bot,
  Check,
  FileText,
  FolderOpen,
  RotateCcw,
  Save,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import { useBeforeUnload, useBlocker, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { Domain } from '../../types';
import type {
  MasterCv,
  Settings as SettingsType,
  TargetProfile,
} from '../../types/settings';
import { cn } from '../../utils/cn';
import { countCvWords, decodeCvFile, MASTER_CV_MAX_BYTES } from './cvFile';
import { useSettingsData } from './useSettingsData';

type Section = 'cv' | 'target' | 'analysis' | 'domains' | 'integrations';
const sections: { id: Section; label: string; description: string; icon: typeof FileText }[] = [
  { id: 'cv', label: 'Master CV', description: 'Analysis baseline', icon: FileText },
  { id: 'target', label: 'Target Profile', description: 'Search direction', icon: Target },
  { id: 'analysis', label: 'Analysis', description: 'Scoring and model', icon: Bot },
  { id: 'domains', label: 'Target Domains', description: 'Classification rules', icon: Target },
  { id: 'integrations', label: 'Integrations', description: 'Telegram access', icon: Bell },
];

const inputClass = 'w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-slate-50 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

interface ApiError { response?: { status?: number }; message?: string }

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const rawSection = params.get('section');
  const section: Section = sections.some((item) => item.id === rawSection) ? rawSection as Section : 'cv';
  const [cvDirty, setCvDirty] = useState(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    cvDirty && currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Discard your unsaved CV changes?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useBeforeUnload((event) => {
    if (cvDirty) event.preventDefault();
  });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-7 border-b border-slate-200 pb-5 dark:border-slate-800">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">Control center</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Settings</h1>
      </header>
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:block lg:space-y-1">
          {sections.map((item) => {
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setParams({ section: item.id })}
                className={cn(
                  'flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2.5 text-left transition lg:w-full lg:gap-3 lg:px-3',
                  active
                    ? 'bg-slate-200/70 text-slate-950 dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon className={cn('h-4 w-4 shrink-0', active && 'text-blue-600 dark:text-blue-400')} />
                <span>
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="hidden text-xs font-normal text-slate-500 lg:block">{item.description}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <main className="min-w-0">
          {section === 'cv' && <MasterCvSection onDirtyChange={setCvDirty} />}
          {section === 'target' && <TargetProfileSection />}
          {section === 'analysis' && <AnalysisSection />}
          {section === 'domains' && <DomainsSection />}
          {section === 'integrations' && <IntegrationsSection />}
        </main>
      </div>
    </div>
  );
}

interface TargetProfileForm {
  target_roles: string;
  must_have_skills: string;
  seniority: string;
  location: string;
  target_domains: Domain[];
}

function TargetProfileSection(): React.JSX.Element {
  const { targetProfileQuery, saveTargetProfile } = useSettingsData();
  const { register, handleSubmit, reset, watch, setValue, formState } =
    useForm<TargetProfileForm>({
      defaultValues: {
        target_roles: '',
        must_have_skills: '',
        seniority: '',
        location: '',
        target_domains: [],
      },
    });
  useEffect(() => {
    const profile = targetProfileQuery.data?.profile;
    if (!profile) return;
    reset({
      ...profile,
      target_roles: profile.target_roles.join(', '),
      must_have_skills: profile.must_have_skills.join(', '),
      seniority: profile.seniority ?? '',
      location: profile.location ?? '',
    });
  }, [reset, targetProfileQuery.data]);
  if (targetProfileQuery.isLoading) return <LoadingState />;
  if (targetProfileQuery.isError || !targetProfileQuery.data)
    return <ErrorState retry={() => void targetProfileQuery.refetch()} />;
  const domains = watch('target_domains');
  const split = (value: string) =>
    value.split(',').map((item) => item.trim()).filter(Boolean);
  const submit = (form: TargetProfileForm) => {
    const profile: TargetProfile = {
      ...form,
      target_roles: split(form.target_roles),
      must_have_skills: split(form.must_have_skills),
      seniority: form.seniority || undefined,
      location: form.location || undefined,
    };
    saveTargetProfile.mutate(
      {
        expected_revision: targetProfileQuery.data!.revision,
        profile,
      },
      {
        onSuccess: (saved) => {
          reset({
            ...saved.profile,
            target_roles: saved.profile.target_roles.join(', '),
            must_have_skills: saved.profile.must_have_skills.join(', '),
            seniority: saved.profile.seniority ?? '',
            location: saved.profile.location ?? '',
          });
          toast.success('Target profile saved');
        },
        onError: () => {
          void targetProfileQuery.refetch();
          toast.error('Target profile changed or could not be saved');
        },
      },
    );
  };
  return <section><SectionHeader title="Target Profile" description="Define the roles used to interpret recommendations and record the profile revision behind every gap cohort." /><form className="max-w-2xl space-y-5" onSubmit={handleSubmit(submit)}>
    <div><span className="mb-2 block text-sm font-medium">Target domains</span><div className="flex flex-wrap gap-2">{Object.values(Domain).map((domain) => <button key={domain} type="button" onClick={() => setValue('target_domains', domains.includes(domain) ? domains.filter((item) => item !== domain) : [...domains, domain], { shouldDirty: true })} className={cn('rounded-md border px-3 py-1.5 text-xs font-semibold', domains.includes(domain) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-700')}>{domain}</button>)}</div></div>
    <div><label htmlFor="target-roles" className="mb-2 block text-sm font-medium">Target roles</label><input id="target-roles" className={inputClass} {...register('target_roles')} placeholder="Backend Engineer, Platform Engineer" /><p className="mt-1 text-xs text-slate-500">Comma-separated.</p></div>
    <div><label htmlFor="target-skills" className="mb-2 block text-sm font-medium">Must-have skills</label><input id="target-skills" className={inputClass} {...register('must_have_skills')} placeholder="TypeScript, PostgreSQL" /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="target-seniority" className="mb-2 block text-sm font-medium">Seniority</label><input id="target-seniority" className={inputClass} {...register('seniority')} /></div><div><label htmlFor="target-location" className="mb-2 block text-sm font-medium">Location</label><input id="target-location" className={inputClass} {...register('location')} /></div></div>
    <div className="border-t border-slate-200 pt-4 dark:border-slate-800"><button className={primaryButton} disabled={!formState.isDirty || saveTargetProfile.isPending} type="submit"><Save className="h-4 w-4" />Save target profile</button><span className="ml-3 text-xs text-slate-500">Revision {targetProfileQuery.data.revision}</span></div>
  </form></section>;
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function LoadingState() {
  return <div className="space-y-4" aria-label="Loading settings"><div className="h-10 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" /><div className="h-64 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" /></div>;
}

function ErrorState({ retry }: { retry: () => void }) {
  return <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">Settings could not be loaded. <button className="font-semibold underline" onClick={retry}>Try again</button>.</div>;
}

function MasterCvSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { cvQuery, saveCv, clearCv, restoreCv } = useSettingsData();
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState<'manual' | 'file'>('manual');
  const [filename, setFilename] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!cvQuery.data || dirty) return;
    setDraft(cvQuery.data.content);
    setSource(cvQuery.data.source === 'file' ? 'file' : 'manual');
    setFilename(cvQuery.data.filename ?? undefined);
  }, [cvQuery.data, dirty]);

  const byteCount = useMemo(() => new TextEncoder().encode(draft).length, [draft]);
  const wordCount = useMemo(() => countCvWords(draft), [draft]);
  const updateFromResponse = (cv: MasterCv) => {
    setDraft(cv.content);
    setSource(cv.source === 'file' ? 'file' : 'manual');
    setFilename(cv.filename ?? undefined);
    setDirty(false);
  };
  const handleMutationError = async (error: ApiError) => {
    if (error.response?.status === 409) {
      await cvQuery.refetch();
      toast.error('The CV changed elsewhere. The latest revision is loaded; your draft is preserved.');
    } else toast.error(error.message || 'The CV could not be updated.');
  };
  const loadFile = async (file?: File) => {
    if (!file) return;
    try {
      const decoded = await decodeCvFile(file);
      setDraft(decoded.content);
      setSource('file');
      setFilename(decoded.filename);
      setDirty(true);
      toast.success(`${decoded.filename} loaded into the editor`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The file could not be read.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void loadFile(event.dataTransfer.files[0]);
  };

  if (cvQuery.isLoading) return <LoadingState />;
  if (cvQuery.isError || !cvQuery.data) return <ErrorState retry={() => void cvQuery.refetch()} />;
  const cv = cvQuery.data;
  const busy = saveCv.isPending || clearCv.isPending || restoreCv.isPending;

  return (
    <section>
      <SectionHeader title="Master CV" description="This text is the authoritative baseline used for every future job analysis." />
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-slate-200 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span><strong className="font-semibold text-slate-700 dark:text-slate-200">Status:</strong> {cv.updated_at ? 'Ready' : 'Not configured'}</span>
        <span><strong className="font-semibold text-slate-700 dark:text-slate-200">Revision:</strong> {cv.revision}</span>
        <span><strong className="font-semibold text-slate-700 dark:text-slate-200">Updated:</strong> {cv.updated_at ? new Date(cv.updated_at).toLocaleString() : 'Never'}</span>
        {cv.filename && <span><strong className="font-semibold text-slate-700 dark:text-slate-200">File:</strong> {cv.filename}</span>}
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className="mb-4 flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100/60 px-4 py-5 text-center dark:border-slate-700 dark:bg-slate-900/60"
      >
        <Upload className="mb-2 h-5 w-5 text-slate-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Drop a Markdown or text file here</p>
        <p className="mt-1 text-xs text-slate-500">UTF-8, up to 1 MiB. The file stays in your browser until you save.</p>
        <input ref={fileInput} type="file" accept=".md,.txt,text/plain,text/markdown" className="sr-only" onChange={(event) => void loadFile(event.target.files?.[0])} />
        <button type="button" className={cn(secondaryButton, 'mt-3')} onClick={() => fileInput.current?.click()}><FolderOpen className="h-4 w-4" />Browse file</button>
      </div>

      <label htmlFor="master-cv-editor" className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">CV text</label>
      <textarea
        id="master-cv-editor"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setSource('manual');
          setFilename(undefined);
          setDirty(true);
        }}
        className={cn(inputClass, 'min-h-[360px] resize-y font-mono leading-6')}
        placeholder="Paste your CV here, or load a .md or .txt file."
        spellCheck
      />
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{wordCount.toLocaleString()} words · {draft.length.toLocaleString()} characters</span>
        <span className={cn(byteCount > MASTER_CV_MAX_BYTES && 'font-semibold text-red-600 dark:text-red-400')}>{byteCount.toLocaleString()} / {MASTER_CV_MAX_BYTES.toLocaleString()} bytes</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          className={primaryButton}
          disabled={!dirty || !draft.trim() || byteCount > MASTER_CV_MAX_BYTES || busy}
          onClick={() => saveCv.mutate({ content: draft, source, filename, expected_revision: cv.revision }, { onSuccess: (result) => { updateFromResponse(result); toast.success('Master CV saved'); }, onError: handleMutationError })}
        ><Save className="h-4 w-4" />{saveCv.isPending ? 'Saving…' : 'Save CV'}</button>
        <button type="button" className={secondaryButton} disabled={!dirty || busy} onClick={() => {
          if (!window.confirm('Discard your unsaved CV changes?')) return;
          updateFromResponse(cv);
        }}><RotateCcw className="h-4 w-4" />Reset draft</button>
        <button
          type="button"
          className={secondaryButton}
          disabled={!cv.previous || busy}
          onClick={() => {
            if (!window.confirm('Restore the previous CV version? The current version will remain available as the next restore.')) return;
            restoreCv.mutate(cv.revision, { onSuccess: (result) => { updateFromResponse(result); toast.success('Previous CV restored'); }, onError: handleMutationError });
          }}
        ><RotateCcw className="h-4 w-4" />Restore previous</button>
        <button
          type="button"
          className={cn(secondaryButton, 'sm:ml-auto hover:border-red-400 hover:text-red-600 dark:hover:text-red-400')}
          disabled={!cv.content || busy}
          onClick={() => {
            if (!window.confirm('Clear the saved master CV? You can restore it once from the previous version.')) return;
            clearCv.mutate(cv.revision, { onSuccess: (result) => { updateFromResponse(result); toast.success('Master CV cleared'); }, onError: handleMutationError });
          }}
        ><Trash2 className="h-4 w-4" />Clear</button>
      </div>
      {cv.previous && <p className="mt-3 text-xs text-slate-500">Previous version: {cv.previous.word_count.toLocaleString()} words, saved {new Date(cv.previous.updated_at).toLocaleString()}.</p>}
    </section>
  );
}

function AnalysisSection() {
  const { settingsQuery, updateSettings } = useSettingsData();
  const [threshold, setThreshold] = useState(70);
  const [model, setModel] = useState('gemini-2.5-flash');
  useEffect(() => { if (settingsQuery.data) { setThreshold(settingsQuery.data.score_threshold); setModel(settingsQuery.data.llm_model); } }, [settingsQuery.data]);
  if (settingsQuery.isLoading) return <LoadingState />;
  if (settingsQuery.isError || !settingsQuery.data) return <ErrorState retry={() => void settingsQuery.refetch()} />;
  const dirty = threshold !== settingsQuery.data.score_threshold || model !== settingsQuery.data.llm_model;
  const save = () => updateSettings.mutate({ score_threshold: threshold, llm_model: model }, { onSuccess: () => toast.success('Analysis settings saved'), onError: () => toast.error('Analysis settings could not be saved') });
  return <section><SectionHeader title="Analysis" description="Tune the fit threshold and Gemini model used for future analyses." /><div className="max-w-2xl space-y-6">
    <div><div className="mb-2 flex items-center justify-between"><label htmlFor="threshold" className="text-sm font-medium">Fit score threshold</label><output className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">{threshold}%</output></div><input id="threshold" type="range" min="0" max="100" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="w-full accent-blue-600" /><p className="mt-1 text-xs text-slate-500">Jobs below this score are treated as low fit by default.</p></div>
    <div><label className="mb-2 block text-sm font-medium">Provider</label><div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><Check className="h-4 w-4 text-emerald-500" />Google Gemini <span className="ml-auto text-xs text-slate-500">Available</span></div></div>
    <div><label htmlFor="model" className="mb-2 block text-sm font-medium">Gemini model</label><input id="model" className={inputClass} value={model} onChange={(event) => setModel(event.target.value)} placeholder="gemini-2.5-flash" /></div>
    <SectionActions dirty={dirty} pending={updateSettings.isPending} save={save} reset={() => { setThreshold(settingsQuery.data.score_threshold); setModel(settingsQuery.data.llm_model); }} />
  </div></section>;
}

function DomainsSection() {
  const { settingsQuery, updateSettings } = useSettingsData();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keywords, setKeywords] = useState<Partial<Record<Domain, string>>>({});
  useEffect(() => {
    if (!settingsQuery.data) return;
    setDomains(settingsQuery.data.applicable_domains);
    setKeywords(Object.fromEntries(Object.entries(settingsQuery.data.domain_keywords).map(([domain, values]) => [domain, values?.join(', ') ?? ''])) as Partial<Record<Domain, string>>);
  }, [settingsQuery.data]);
  if (settingsQuery.isLoading) return <LoadingState />;
  if (settingsQuery.isError || !settingsQuery.data) return <ErrorState retry={() => void settingsQuery.refetch()} />;
  const serialize = () => Object.fromEntries(Object.entries(keywords).map(([domain, value]) => [domain, value?.split(',').map((item) => item.trim()).filter(Boolean) ?? []]));
  const dirty = JSON.stringify(domains) !== JSON.stringify(settingsQuery.data.applicable_domains) || JSON.stringify(serialize()) !== JSON.stringify(settingsQuery.data.domain_keywords);
  const reset = () => { setDomains(settingsQuery.data!.applicable_domains); setKeywords(Object.fromEntries(Object.entries(settingsQuery.data!.domain_keywords).map(([domain, values]) => [domain, values?.join(', ') ?? ''])) as Partial<Record<Domain, string>>); };
  return <section><SectionHeader title="Target Domains" description="Choose relevant job families and the keywords used to classify them." /><div className="space-y-6">
    <div><p className="mb-2 text-sm font-medium">Applicable domains</p><div className="flex flex-wrap gap-2">{Object.values(Domain).map((domain) => <button key={domain} type="button" onClick={() => setDomains((current) => current.includes(domain) ? current.filter((item) => item !== domain) : [...current, domain])} className={cn('rounded-md border px-3 py-1.5 text-xs font-semibold transition', domains.includes(domain) ? 'border-blue-600 bg-blue-600 text-slate-50' : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300')}><Check className={cn('mr-1 inline h-3 w-3', !domains.includes(domain) && 'invisible')} />{domain}</button>)}</div></div>
    {domains.length ? <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">{domains.map((domain) => <div key={domain} className="grid gap-2 py-4 md:grid-cols-[150px_1fr]"><label htmlFor={`keywords-${domain}`} className="pt-2 text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300">{domain}</label><div><textarea id={`keywords-${domain}`} className={cn(inputClass, 'min-h-20')} value={keywords[domain] ?? ''} onChange={(event) => setKeywords((current) => ({ ...current, [domain]: event.target.value }))} placeholder="Comma-separated keywords" /><p className="mt-1 text-xs text-slate-500">Comma-separated, matched without case sensitivity.</p></div></div>)}</div> : <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Select at least one domain to configure classification.</p>}
    <SectionActions dirty={dirty} pending={updateSettings.isPending} save={() => updateSettings.mutate({ applicable_domains: domains, domain_keywords: serialize() as SettingsType['domain_keywords'] }, { onSuccess: () => toast.success('Domain settings saved'), onError: () => toast.error('Domain settings could not be saved') })} reset={reset} />
  </div></section>;
}

function IntegrationsSection() {
  const { settingsQuery, updateSettings } = useSettingsData();
  const [chatIds, setChatIds] = useState('');
  useEffect(() => { if (settingsQuery.data) setChatIds(settingsQuery.data.telegram_allowed_chat_ids.join(', ')); }, [settingsQuery.data]);
  if (settingsQuery.isLoading) return <LoadingState />;
  if (settingsQuery.isError || !settingsQuery.data) return <ErrorState retry={() => void settingsQuery.refetch()} />;
  const parsed = chatIds.split(',').map((item) => item.trim()).filter(Boolean);
  const valid = parsed.every((item) => /^-?\d+$/.test(item) && Number.isSafeInteger(Number(item)));
  const ids = parsed.map(Number);
  const dirty = JSON.stringify(ids) !== JSON.stringify(settingsQuery.data.telegram_allowed_chat_ids);
  return <section><SectionHeader title="Integrations" description="Restrict Telegram bot access to a known list of chat IDs." /><div className="max-w-2xl"><label htmlFor="chat-ids" className="mb-2 block text-sm font-medium">Allowed Telegram chat IDs</label><input id="chat-ids" className={inputClass} value={chatIds} onChange={(event) => setChatIds(event.target.value)} placeholder="12345678, 87654321" /><p className={cn('mt-1 text-xs', valid ? 'text-slate-500' : 'text-red-600 dark:text-red-400')}>{valid ? 'Use comma-separated numeric IDs. Leave blank to deny all chats.' : 'Every chat ID must be a whole number.'}</p><SectionActions dirty={dirty && valid} pending={updateSettings.isPending} save={() => updateSettings.mutate({ telegram_allowed_chat_ids: ids }, { onSuccess: () => toast.success('Integration settings saved'), onError: () => toast.error('Integration settings could not be saved') })} reset={() => setChatIds(settingsQuery.data!.telegram_allowed_chat_ids.join(', '))} /></div></section>;
}

function SectionActions({ dirty, pending, save, reset }: { dirty: boolean; pending: boolean; save: () => void; reset: () => void }) {
  return <div className="mt-6 flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-800"><button type="button" className={primaryButton} disabled={!dirty || pending} onClick={save}><Save className="h-4 w-4" />{pending ? 'Saving…' : 'Save changes'}</button><button type="button" className={secondaryButton} disabled={!dirty || pending} onClick={reset}>Reset</button></div>;
}
