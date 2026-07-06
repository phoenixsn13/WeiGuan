import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  createMultiRun,
  createPerson,
  createRun,
  getIdentities,
  previewCost,
  type IdentitySummary,
  type PersonaKind,
  type PreviewCost,
} from "../api/client";
import { saveCurrentIdentity, useApiKey } from "../api/useApiKey";
import { Button } from "../components/Button";
import { world } from "../design/tokens";
import { labelForPlatform } from "../skins/skin";

type LaunchPlatform = "twitter" | "reddit";

const ROUNDS = [
  { value: 6, label: "快速围观", hint: "看第一波反应" },
  { value: 10, label: "标准", hint: "适合多数内容" },
  { value: 15, label: "深度发酵", hint: "观察讨论分化" },
];

const MAX_CUSTOM_STEPS = 1000;
const IDENTITY_VISIBLE_LIMIT = 20;
const DEFAULT_MEMORY_BUDGET = 4;
const DEFAULT_VISIBLE_PEOPLE = 8;
const DEFAULT_COMMENT_BUDGET = 12;

const PERSONAS: Array<{
  value: PersonaKind;
  label: string;
  hint: string;
  standing: string;
}> = [
  { value: "ordinary", label: "普通人", hint: "普通网友视角", standing: "约 20 粉丝" },
  { value: "verified", label: "大V", hint: "自带基础扩散", standing: "约 2,000 粉丝" },
  { value: "kol", label: "KOL", hint: "头部意见领袖", standing: "约 50,000 粉丝" },
];

const PLATFORMS: Array<{ value: LaunchPlatform; label: string; hint: string }> = [
  { value: "twitter", label: labelForPlatform("twitter"), hint: "中文社交媒体" },
  { value: "reddit", label: labelForPlatform("reddit"), hint: "全球社区讨论" },
];

function personaLabel(kind: PersonaKind): string {
  return PERSONAS.find((persona) => persona.value === kind)?.label ?? "普通人";
}

function defaultIdentityName(kind: PersonaKind): string {
  return `${personaLabel(kind)}${Math.random().toString(36).slice(2, 6)}`;
}

function defaultHandle(name: string): string {
  return name.trim().replace(/\s+/g, "_") || `user_${Math.random().toString(36).slice(2, 6)}`;
}

function clampSteps(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.max(1, Math.min(MAX_CUSTOM_STEPS, Math.round(value)));
}

// review:P4-T6
export default function ComposeScreen() {
  const audience =
    (useLocation().state as { audience?: { crowd_id?: string; custom?: string } } | null)
      ?.audience ?? { crowd_id: "tech_devs" };
  const {
    key,
    model,
    baseUrl,
    reasoningEffort,
    thinking,
    setKey,
    setModel,
    setBaseUrl,
    setReasoningEffort,
    setThinking,
  } = useApiKey();
  const [content, setContent] = useState("");
  const [steps, setSteps] = useState(10);
  const [customSteps, setCustomSteps] = useState(30);
  const [customMode, setCustomMode] = useState(false);
  const [posterPersona, setPosterPersona] = useState<PersonaKind>("ordinary");
  const [identityMode, setIdentityMode] = useState<"new" | "continue">("new");
  const [identityName, setIdentityName] = useState("");
  const [identities, setIdentities] = useState<IdentitySummary[]>([]);
  const [selectedIdentityId, setSelectedIdentityId] = useState("");
  const [identitySearch, setIdentitySearch] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<LaunchPlatform[]>(["twitter"]);
  const [cost, setCost] = useState<PreviewCost | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const selectedSteps = customMode ? clampSteps(customSteps) : steps;
  const selectedIdentity = identities.find((identity) => identity.person_id === selectedIdentityId);
  const normalizedIdentitySearch = identitySearch.trim().toLowerCase();
  const filteredIdentities = useMemo(
    () =>
      identities.filter((identity) => {
        if (!normalizedIdentitySearch) return true;
        return [
          identity.display_name,
          personaLabel(identity.persona_kind),
          identity.person_id,
          identity.world_id,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedIdentitySearch);
      }),
    [identities, normalizedIdentitySearch],
  );
  const visibleIdentities = filteredIdentities.slice(0, IDENTITY_VISIBLE_LIMIT);

  useEffect(() => {
    let active = true;
    previewCost({
      steps: selectedSteps,
      llm_max_agents: DEFAULT_VISIBLE_PEOPLE,
      attention_comment_budget: DEFAULT_COMMENT_BUDGET,
      person_memory_budget: DEFAULT_MEMORY_BUDGET,
    })
      .then((nextCost) => {
        if (
          active &&
          typeof nextCost.estimated_rmb === "number" &&
          typeof nextCost.budgeted_agents === "number" &&
          typeof nextCost.decision_steps === "number"
        ) {
          setCost(nextCost);
        }
      })
      .catch(() => {
        if (active) setCost(null);
      });
    return () => {
      active = false;
    };
  }, [selectedSteps]);

  useEffect(() => {
    if (identityMode !== "continue") {
      return;
    }
    let active = true;
    getIdentities()
      .then((items) => {
        if (!active) return;
        setIdentities(items);
        setSelectedIdentityId((current) => current || items[0]?.person_id || "");
      })
      .catch(() => {
        if (active) setIdentities([]);
      });
    return () => {
      active = false;
    };
  }, [identityMode]);

  async function startRun() {
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      if (selectedPlatforms.length === 0) {
        throw new Error("至少选择一个平台");
      }
      let worldId: string | undefined;
      let personId: string | undefined;
      let runPersona = posterPersona;
      if (identityMode === "new") {  // review:P7-T12
        const displayName = identityName.trim() || defaultIdentityName(posterPersona);
        const created = await createPerson({
          display_name: displayName,
          persona_kind: posterPersona,
          platform: selectedPlatforms[0],
          handle: defaultHandle(displayName),
        });
        worldId = created.world_id;
        personId = created.person.person_id;
        saveCurrentIdentity(personId, worldId);
      } else {
        const selected = identities.find((item) => item.person_id === selectedIdentityId);
        if (!selected) {
          throw new Error("请选择要继续的身份");
        }
        worldId = selected.world_id;
        personId = selected.person_id;
        runPersona = selected.persona_kind;
        saveCurrentIdentity(personId, worldId);
      }
      if (selectedPlatforms.length >= 2) {  // review:P11-T5
        const { world_id, run_ids } = await createMultiRun(
          {
            audience,
            content,
            steps: selectedSteps,
            persona: runPersona,
            platforms: selectedPlatforms,
            world_id: worldId,
            poster_person_id: personId,
            person_memory_budget: DEFAULT_MEMORY_BUDGET,
          },
          { key, model, baseUrl, reasoningEffort, thinking },
        );
        const query = new URLSearchParams();
        for (const runId of run_ids) {
          query.append("run_id", runId);
        }
        navigate(`/world/${world_id}/live?${query.toString()}`);
        return;
      }
      const { run_id } = await createRun(
        {
          audience,
          content,
          steps: selectedSteps,
          platform: selectedPlatforms[0],
          world_id: worldId,
          poster_persona: runPersona,
          poster_person_id: personId,
          person_memory_budget: DEFAULT_MEMORY_BUDGET,
        },
        { key, model, baseUrl, reasoningEffort, thinking },
      );
      navigate(`/run/${run_id}/live`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  const identitySummary =
    identityMode === "continue" && selectedIdentity
      ? {
          label: selectedIdentity.display_name,
          detail: `${personaLabel(selectedIdentity.persona_kind)} · 影响力 ${Math.round(selectedIdentity.total_influence)} · ${selectedIdentity.run_count} 次`,
        }
      : {
          label: identityName.trim() || `${personaLabel(posterPersona)}新身份`,
          detail: `${personaLabel(posterPersona)} · ${selectedPlatforms.map((platform) => labelForPlatform(platform)).join(" + ")}`,
        };

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-card border border-line bg-white p-6 shadow-spotlight">
        <h1 className="text-3xl font-black tracking-normal">写点什么</h1>
        <p className="mt-2 text-sm text-slate-500">像发微博一样输入正文，发出后看评论如何逐渐出现。</p>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="有什么新鲜事？"
          rows={7}
          className="mt-5 w-full resize-none rounded-card border border-line p-4 text-[16px] leading-7 focus:border-accent focus:outline-none"
        />
        <div className="mt-4 rounded-card border border-line bg-white p-4"> {/* review:P11-T5 */}
          <div className="text-sm font-bold text-slate-950">平台</div>
          <p className="mt-1 text-sm text-slate-500">选择这条内容会出现在哪些现场。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PLATFORMS.map((platform) => {
              const checked = selectedPlatforms.includes(platform.value);
              return (
                <label
                  key={platform.value}
                  className={[
                    "cursor-pointer rounded-card border p-3 text-sm",
                    checked ? "text-slate-950" : "border-line text-slate-600",
                  ].join(" ")}
                  style={checked ? { borderColor: world.line, backgroundColor: "#F8FAFC" } : undefined}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block font-bold">{platform.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{platform.hint}</span>
                    </span>
                    <input
                      aria-label={platform.label}
                      type="checkbox"
                      name="platforms"
                      checked={checked}
                      onChange={() =>
                        setSelectedPlatforms((current) =>
                          current.includes(platform.value)
                            ? current.filter((item) => item !== platform.value)
                            : [...current, platform.value],
                        )
                      }
                    />
                  </span>
                </label>
              );
            })}
          </div>
          {selectedPlatforms.length >= 2 && (
            <div
              className="mt-3 rounded-card border p-3 text-sm"
              style={{ borderColor: world.line, backgroundColor: "#F8FAFC" }}
            >
              <div className="font-bold" style={{ color: world.line }}>多平台并发</div>
              <p className="mt-1 leading-6 text-slate-500">
                这条会同时在微博和 Reddit 发酵，热点会互相外溢。
              </p>
            </div>
          )}
        </div>
        <div className="mt-4 rounded-card border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-950">发帖身份</div>
              <p className="mt-1 text-sm text-slate-500">
                选择这条内容最初出现时的身份基础，会影响后续可见度和扩散强度。
              </p>
            </div>
            {cost && (
              <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                已预估费用
              </div>
            )}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {PERSONAS.map((persona) => (
              <label
                key={persona.value}
                className={[
                  "cursor-pointer rounded-card border p-3 text-sm",
                  posterPersona === persona.value
                    ? "border-brand bg-amber-50 text-slate-950"
                    : "border-line text-slate-600",
                ].join(" ")}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-bold">{persona.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{persona.hint}</span>
                  </span>
                  <input
                    type="radio"
                    name="poster_persona"
                    checked={posterPersona === persona.value}
                    onChange={() => setPosterPersona(persona.value)}
                  />
                </span>
                <span className="mt-2 block text-xs text-slate-400">{persona.standing}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <label
              className={[
                "cursor-pointer rounded-card border p-3",
                identityMode === "new" ? "border-accent bg-blue-50 text-accent" : "border-line text-slate-600",
              ].join(" ")}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold">新身份</span>
                <input
                  type="radio"
                  name="identity_mode"
                  checked={identityMode === "new"}
                  onChange={() => setIdentityMode("new")}
                />
              </span>
              <span className="mt-1 block text-xs text-slate-400">从这次内容开始建立身份</span>
            </label>
            <label
              className={[
                "cursor-pointer rounded-card border p-3",
                identityMode === "continue" ? "border-accent bg-blue-50 text-accent" : "border-line text-slate-600",
              ].join(" ")}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold">继续身份</span>
                <input
                  type="radio"
                  name="identity_mode"
                  checked={identityMode === "continue"}
                  onChange={() => setIdentityMode("continue")}
                />
              </span>
              <span className="mt-1 block text-xs text-slate-400">沿用已经保存的人物身份</span>
            </label>
          </div>
          {identityMode === "new" && (
            <label className="mt-3 grid max-w-sm gap-2 text-sm font-semibold text-slate-700">
              身份昵称
              <input
                value={identityName}
                onChange={(event) => setIdentityName(event.target.value)}
                placeholder={`${personaLabel(posterPersona)}昵称，可不填`}
                className="rounded-card border border-line px-3 py-2 text-base text-slate-950 focus:border-accent focus:outline-none"
              />
            </label>
          )}
          {identityMode === "continue" && (
            <div className="mt-3 rounded-card border border-line bg-slate-50 p-3"> {/* review:P7-T12 */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-950">
                    {selectedIdentity ? "当前选择" : "选择一个保存身份"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    已保存 {identities.length} 个身份
                    {selectedIdentity && (
                      <>
                        {" · 当前 "}
                        {personaLabel(selectedIdentity.persona_kind)}
                        {" · 影响力 "}
                        {Math.round(selectedIdentity.total_influence)}
                        {" · "}
                        {selectedIdentity.run_count}
                        {" 次"}
                      </>
                    )}
                  </div>
                </div>
                {filteredIdentities.length > IDENTITY_VISIBLE_LIMIT && (
                  <div className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                    显示前 {IDENTITY_VISIBLE_LIMIT} 个，搜索可定位更多
                  </div>
                )}
              </div>
              <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
                搜索身份
                <input
                  value={identitySearch}
                  onChange={(event) => setIdentitySearch(event.target.value)}
                  placeholder="输入昵称、身份类型或 ID"
                  className="rounded-card border border-line px-3 py-2 text-base text-slate-950 focus:border-accent focus:outline-none"
                />
              </label>
              {identities.length === 0 && (
                <div className="mt-3 rounded-card border border-dashed border-line p-3 text-sm text-slate-500">
                  还没有保存的身份。先用新身份发一条内容。
                </div>
              )}
              {identities.length > 0 && filteredIdentities.length === 0 && (
                <div className="mt-3 rounded-card border border-dashed border-line p-3 text-sm text-slate-500">
                  没有匹配的身份。
                </div>
              )}
              {filteredIdentities.length > 0 && (
                <div
                  data-testid="identity-picker-list"
                  className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1"
                >
                  {visibleIdentities.map((identity) => (
                    <label
                      key={`${identity.world_id}:${identity.person_id}`}
                      className={[
                        "cursor-pointer rounded-card border bg-white p-3 text-sm",
                        selectedIdentityId === identity.person_id
                          ? "border-accent bg-blue-50 text-accent"
                          : "border-line text-slate-600",
                      ].join(" ")}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>
                          <span className="block font-bold">{identity.display_name}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {personaLabel(identity.persona_kind)} · 影响力 {Math.round(identity.total_influence)} · {identity.run_count} 次
                          </span>
                        </span>
                        <input
                          type="radio"
                          name="identity_picker"
                          checked={selectedIdentityId === identity.person_id}
                          onChange={() => {
                            setSelectedIdentityId(identity.person_id);
                            setPosterPersona(identity.persona_kind);
                          }}
                        />
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 rounded-card border border-line bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-950">讨论轮次</div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                第 1 拍发布原帖；之后每一轮让一批用户基于当前评论区继续点赞、评论或转发。
                轮次越多，越接近一条长微博持续发酵的过程。
              </p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              当前 {selectedSteps} 轮
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          {ROUNDS.map((round) => (
            <label
              key={round.value}
              className={[
                "flex min-h-16 cursor-pointer items-center justify-between rounded-card border px-3",
                !customMode && steps === round.value ? "border-accent bg-blue-50 text-accent" : "border-line text-slate-600",
              ].join(" ")}
            >
              <span>
                <span className="block font-semibold">{round.label}</span>
                <span className="mt-1 block text-xs text-slate-400">{round.value} 轮 · {round.hint}</span>
              </span>
              <input
                type="radio"
                name="steps"
                checked={!customMode && steps === round.value}
                onChange={() => {
                  setCustomMode(false);
                  setSteps(round.value);
                }}
              />
            </label>
          ))}
          <label
            className={[
              "flex min-h-16 cursor-pointer items-center justify-between rounded-card border px-3",
              customMode ? "border-accent bg-blue-50 text-accent" : "border-line text-slate-600",
            ].join(" ")}
          >
            <span>
              <span className="block font-semibold">自定义轮次</span>
              <span className="mt-1 block text-xs text-slate-400">1-1000 轮</span>
            </span>
            <input
              type="radio"
              name="steps"
              checked={customMode}
              onChange={() => setCustomMode(true)}
            />
          </label>
        </div>
        {customMode && (
          <div className="mt-3 rounded-card border border-line bg-white p-4">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              自定义轮次数
              <input
                type="number"
                min={1}
                max={MAX_CUSTOM_STEPS}
                value={customSteps}
                onChange={(event) => setCustomSteps(clampSteps(Number(event.target.value)))}
                className="max-w-48 rounded-card border border-line px-3 py-2 text-base text-slate-950 focus:border-accent focus:outline-none"
              />
            </label>
            {selectedSteps > 100 && (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                长跑会生成更多数据库记录和回放事件。评论区只保留窗口化展示，历史页会优先看摘要和热词。
              </p>
            )}
          </div>
        )}
        {cost && (
          <div className="mt-3 rounded-card border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"> {/* review:P7-T10 */}
            <div>
              预计约 ¥{cost.estimated_rmb.toFixed(2)}；本次约 {cost.budgeted_agents} 个可见人物，
              {cost.decision_steps} 个决策拍。
            </div>
            <div className="mt-1">
              自有算力不额外计费；付费 API 按 token 估算约 ¥{cost.estimated_rmb.toFixed(2)}。
            </div>
          </div>
        )}
        {error && <div className="mt-3 text-sm text-sentiment-negative">{error}</div>}
        <div className="mt-5">
          <Button onClick={startRun} disabled={submitting}>
            {submitting ? "正在发起" : "开始围观"}
          </Button>
        </div>
      </section>

      <aside className="rounded-card border border-line bg-white p-5 shadow-sm">
        <h2 className="font-bold">发布前设置</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          不填前端字段时会使用服务 `.env` 默认值。
        </p>
        <div className="mt-4 rounded-card border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="text-xs font-bold uppercase tracking-wide">费用预览</div>
          {cost ? (
            <>
              <div className="mt-2 text-xl font-black tabular">¥{cost.estimated_rmb.toFixed(2)}</div>
              <div className="mt-1 leading-6">
                本次约 {cost.budgeted_agents} 个可见人物，{cost.decision_steps} 个决策拍。
              </div>
            </>
          ) : (
            <div className="mt-2 leading-6">正在根据轮次和可见人物估算。</div>
          )}
        </div>
        <div className="mt-3 rounded-card border border-line bg-cream p-3 text-sm">
          <div className="text-xs font-bold text-slate-500">当前身份</div>
          <div className="mt-2 font-black text-slate-950">当前：{identitySummary.label}</div>
          <div className="mt-1 leading-6 text-slate-500">{identitySummary.detail}</div>
        </div>
        <details className="mt-4 min-w-0 rounded-card border border-line bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">BYOK 设置</summary>
          <div className="mt-3 grid min-w-0 gap-3">
            {/* review:PA-T3 */}
            <label className="grid min-w-0 gap-1 text-xs text-ink/60">
              API Key
              <input
                value={key}
                placeholder="填入你的 LLM API Key"
                onChange={(event) => setKey(event.target.value)}
                className="min-w-0 rounded-card border border-line p-2 text-sm text-ink"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-ink/60">
              Base URL
              <input
                value={baseUrl}
                placeholder="https://api.deepseek.com"
                onChange={(event) => setBaseUrl(event.target.value)}
                className="min-w-0 rounded-card border border-line p-2 text-sm text-ink"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-ink/60">
              Model
              <input
                value={model}
                placeholder="deepseek-v4-pro"
                onChange={(event) => setModel(event.target.value)}
                className="min-w-0 rounded-card border border-line p-2 text-sm text-ink"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-ink/60">
              Reasoning
              <input
                value={reasoningEffort}
                placeholder="high"
                onChange={(event) => setReasoningEffort(event.target.value)}
                className="min-w-0 rounded-card border border-line p-2 text-sm text-ink"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-ink/60">
              Thinking
              <input
                value={thinking}
                placeholder="enabled"
                onChange={(event) => setThinking(event.target.value)}
                className="min-w-0 rounded-card border border-line p-2 text-sm text-ink"
              />
            </label>
          </div>
        </details>
      </aside>
    </div>
  );
}
