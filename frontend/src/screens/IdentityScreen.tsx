import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  fetchPerson,
  fetchRuns,
  type PersonView,
  type RunSummary,
} from "../api/client";
import { influenceSeries, stanceDriftSeries } from "../pov/identity";

function personaLabel(kind: PersonView["person"]["persona_kind"]): string {
  if (kind === "kol") return "KOL";
  if (kind === "verified") return "大V";
  return "普通人";
}

function stanceLabel(dominant: string): string {
  if (dominant === "positive") return "偏正向";
  if (dominant === "negative") return "偏负向";
  if (dominant === "neutral") return "中立";
  return "未定";
}

// review:P7-T7
export default function IdentityScreen() {
  const { personId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const worldId = searchParams.get("world_id") ?? "";
  const navigate = useNavigate();
  const [person, setPerson] = useState<PersonView | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!worldId || !personId) {
      setLoaded(true);
      return;
    }
    Promise.all([fetchPerson(personId, worldId), fetchRuns()])
      .then(([nextPerson, nextRuns]) => {
        setPerson(nextPerson);
        setRuns(nextRuns);
      })
      .catch(() => {
        setPerson(null);
      })
      .finally(() => setLoaded(true));
  }, [personId, worldId]);

  const stancePoints = useMemo(
    () => (person ? stanceDriftSeries(person, runs) : []),
    [person, runs],
  );
  const influencePoints = useMemo(
    () => (person ? influenceSeries(person, runs) : []),
    [person, runs],
  );
  const maxInfluence = Math.max(0, ...influencePoints.map((point) => point.value));
  const account = person?.person.accounts[0];
  const identityRuns = person
    ? runs.filter((run) => person.run_ids.includes(run.run_id))
    : [];

  if (!loaded) {
    return <IdentitySkeleton />;
  }

  if (!worldId) {
    return (
      <section className="mx-auto max-w-5xl rounded-card border border-line bg-white p-8 shadow-spotlight">
        <h1 className="text-2xl font-black tracking-normal">缺少世界信息</h1>
        <p className="mt-2 text-sm text-slate-500">无法确认这个身份属于哪个世界。</p>
      </section>
    );
  }

  if (!person) {
    return (
      <section className="mx-auto max-w-5xl rounded-card border border-line bg-white p-8 shadow-spotlight">
        <h1 className="text-2xl font-black tracking-normal">没有找到这个身份</h1>
        <p className="mt-2 text-sm text-slate-500">可能已经被移除，或链接里的世界不匹配。</p>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-card border border-line bg-slate-950 p-5 text-white shadow-spotlight">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand text-xl font-black text-slate-950">
            {person.person.display_name.slice(0, 1)}
          </div>
          <div>
            <h1 className="text-xl font-black tracking-normal">{person.person.display_name}</h1>
            <div className="mt-1 text-sm text-white/60">{personaLabel(person.person.persona_kind)}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-card border border-white/10 bg-white/5 p-3">
            <div className="text-white/50">影响力</div>
            <div className="mt-2 text-2xl font-black">{Math.round(person.total_influence)}</div>
          </div>
          <div className="rounded-card border border-white/10 bg-white/5 p-3">
            <div className="text-white/50">立场</div>
            <div className="mt-2 text-2xl font-black">{stanceLabel(person.stance.dominant)}</div>
          </div>
        </div>
        {account && (
          <div className="mt-5 rounded-card border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-bold">名下账户</div>
            <div className="mt-3 text-sm text-white/70">@{account.handle}</div>
            <div className="mt-1 text-sm text-white/70">
              {account.num_followers.toLocaleString()} 粉丝
            </div>
          </div>
        )}
        <button
          className="mt-5 min-h-11 w-full rounded-card bg-brand text-sm font-semibold text-slate-950 hover:brightness-105"
          onClick={() => navigate(`/world/${worldId}/live`)}
        >
          看这个世界
        </button>
      </aside>

      <div className="grid gap-5">
        <section className="rounded-card border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black tracking-normal">立场时间线</h2>
              <p className="mt-1 text-sm text-slate-500">按这个身份历次发起的内容排序。</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
              {person.run_ids.length} 次围观
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {stancePoints.length === 0 && (
              <div className="rounded-card border border-dashed border-line p-5 text-sm text-slate-500">
                还没有足够记录形成时间线。
              </div>
            )}
            {stancePoints.map((point) => {
              const run = identityRuns.find((item) => item.run_id === point.run_id);
              return (
                <div key={point.run_id} className="rounded-card border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-bold text-slate-500">{point.label}</div>
                    <div className="text-xs font-bold text-amber-700">
                      {stanceLabel(point.dominant)} · 分值 {point.score}
                    </div>
                  </div>
                  {run && <div className="mt-2 line-clamp-2 font-bold">{run.content}</div>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-card border border-line bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black tracking-normal">影响力曲线</h2>
          {influencePoints.length === 0 || maxInfluence <= 0 ? (
            <div className="mt-4 rounded-card border border-dashed border-line p-5 text-sm text-slate-500">
              还没有足够记录形成影响力曲线。
            </div>
          ) : (
            <div className="mt-4 flex h-28 items-end gap-2">
              {influencePoints.map((point) => (
                <div key={point.run_id} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t bg-brand"
                    style={{ height: `${(point.value / maxInfluence) * 100}%` }}
                    aria-label={`${point.label} 影响力 ${point.value}`}
                  />
                  <div className="text-xs font-semibold text-slate-400">{point.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function IdentitySkeleton() {
  return (
    <section data-testid="identity-skeleton" className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[320px_minmax(0,1fr)]" aria-label="身份正在读取">
      <aside className="rounded-card border border-line bg-slate-950 p-5 shadow-spotlight">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-white/10" />
          <div className="min-w-0 flex-1">
            <div className="h-6 w-36 rounded-full bg-white/10" />
            <div className="mt-2 h-4 w-20 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="h-24 rounded-card border border-white/10 bg-white/5" />
          <div className="h-24 rounded-card border border-white/10 bg-white/5" />
        </div>
        <div className="mt-5 h-24 rounded-card border border-white/10 bg-white/5" />
        <div className="mt-5 h-11 rounded-card bg-white/10" />
      </aside>
      <div className="grid gap-5">
        <section className="rounded-card border border-line bg-white p-5 shadow-sm">
          <div className="h-7 w-36 rounded-full bg-cream" />
          <div className="mt-2 h-4 w-52 rounded-full bg-cream" />
          <div className="mt-5 grid gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-card border border-line p-4">
                <div className="h-4 w-24 rounded-full bg-cream" />
                <div className="mt-3 h-5 w-full max-w-lg rounded-full bg-cream" />
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-card border border-line bg-white p-5 shadow-sm">
          <div className="h-7 w-36 rounded-full bg-cream" />
          <div className="mt-5 flex h-28 items-end gap-2">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t bg-cream" style={{ height: `${35 + item * 10}%` }} />
                <div className="h-3 w-8 rounded-full bg-cream" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
