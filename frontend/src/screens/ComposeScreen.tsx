import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  createMultiRun,
  createPerson,
  createRun,
  fetchWorlds,
  getIdentities,
  previewCost,
  type IdentitySummary,
  type PersonaKind,
  type PreviewCost,
  type WorldSummary,
} from "../api/client";
import { saveCurrentIdentity, useApiKey } from "../api/useApiKey";
import { Button } from "../components/Button";
import {
  GlobeIcon,
  MessageCircleIcon,
  MultiPlatformIcon,
  RedditIcon,
  SearchIcon,
  SendIcon,
  ShieldIcon,
  WalletIcon,
  WeiboIcon,
} from "../components/icons";
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
const WORLD_VISIBLE_LIMIT = 8;
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
  const [worldMode, setWorldMode] = useState<"new" | "continue">("new");
  const [worldName, setWorldName] = useState("");
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState("");
  const [worldSearch, setWorldSearch] = useState("");
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
  const selectedWorld = worlds.find((item) => item.world_id === selectedWorldId);
  const normalizedWorldSearch = worldSearch.trim().toLowerCase();
  const filteredWorlds = useMemo(
    () =>
      worlds.filter((item) => {
        if (!normalizedWorldSearch) return true;
        return [item.name, item.latest?.content ?? ""].join(" ").toLowerCase().includes(normalizedWorldSearch);
      }),
    [worlds, normalizedWorldSearch],
  );
  const visibleWorlds = filteredWorlds.slice(0, WORLD_VISIBLE_LIMIT);
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
    let active = true;
    fetchWorlds()
      .then((items) => {
        if (!active) return;
        setWorlds(items);
        setSelectedWorldId((current) => current || items[0]?.world_id || "");
      })
      .catch(() => {
        if (active) setWorlds([]);
      });
    return () => {
      active = false;
    };
  }, []);

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
      const chosenWorldId = worldMode === "continue" ? selectedWorldId : undefined;
      const chosenWorldName = worldMode === "new" ? worldName.trim() : "";
      if (worldMode === "continue" && !chosenWorldId) {
        throw new Error("请选择要继续的世界");
      }
      if (identityMode === "new") {  // review:P7-T12
        const displayName = identityName.trim() || defaultIdentityName(posterPersona);
        const created = await createPerson({
          ...(chosenWorldId ? { world_id: chosenWorldId } : {}),
          ...(!chosenWorldId && chosenWorldName ? { world_name: chosenWorldName } : {}),
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
        if (chosenWorldId && selected.world_id !== chosenWorldId) {
          throw new Error("请选择这个世界里的身份，或改用新身份");
        }
        worldId = selected.world_id;
        personId = selected.person_id;
        runPersona = selected.persona_kind;
        saveCurrentIdentity(personId, worldId);
      }
      if (selectedPlatforms.length >= 2) {  // review:P11-T5
        const { world_id, run_ids, launch_id } = await createMultiRun(
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
        if (!launch_id) {
          throw new Error("发起会话缺少 launch_id");
        }
        const query = new URLSearchParams();
        query.set("launch", launch_id); // review:P15-T5
        for (const runId of run_ids) {
          query.append("run_id", runId);
        }
        navigate(`/world/${world_id}/live?${query.toString()}`);
        return;
      }
      const { launch_id, world_id: responseWorldId } = await createRun(
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
      if (!launch_id) {
        throw new Error("发起会话缺少 launch_id");
      }
      navigate(`/world/${responseWorldId ?? worldId}/live?launch=${launch_id}`); // review:P15-T4
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

  const worldSummary =
    worldMode === "continue" && selectedWorld
      ? {
          label: selectedWorld.name,
          detail: `${selectedWorld.identity_count} 个身份 · ${selectedWorld.run_count} 次发起`,
        }
      : {
          label: worldName.trim() || "自动命名新世界",
          detail: worldName.trim() ? "发起后保存为新世界" : "留空时会按内容自动命名",
        };

  return (
    <div
      data-testid="compose-desktop-layout"
      className="mx-auto grid max-w-[1340px] gap-5 lg:grid-cols-[minmax(0,1fr)_380px]"
    >
      <section className="rounded-card border border-line bg-white p-5 shadow-spotlight md:p-6">
        <h1 className="text-3xl font-black tracking-normal">写点什么</h1>
        <p className="mt-2 text-sm text-slate-500">像发微博一样输入正文，发出后看评论如何逐渐出现。</p>
        <div className="mt-5 rounded-card border border-line bg-white">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="有什么新鲜事？"
            rows={5}
            className="h-44 w-full resize-none rounded-card border-0 p-4 text-[16px] leading-7 focus:outline-none"
          />
          <div className="border-t border-line px-4 py-2 text-right text-xs font-semibold text-slate-400">
            {content.length}/2000
          </div>
        </div>

        <div className="mt-4 rounded-card border border-line bg-white p-4"> {/* review:P14-T6 */}
          <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <GlobeIcon className="h-4 w-4" />
            <span>世界</span>
          </div>
          <div
            data-testid="compose-world-panel"
            className="mt-3 grid overflow-hidden rounded-card border border-line lg:grid-cols-2"
          >
            <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
              <label
                className={[
                  "flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm",
                  worldMode === "new" ? "border-accent bg-accentSoft text-accent" : "border-line text-slate-600",
                ].join(" ")}
              >
                <span className="font-bold">新建世界</span>
                <input
                  type="radio"
                  name="world_mode"
                  checked={worldMode === "new"}
                  onChange={() => {
                    setWorldMode("new");
                    setIdentityMode("new");
                  }}
                />
              </label>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
                世界名称
                <span className="relative">
                  <input
                    aria-label="世界名称"
                    value={worldName}
                    onChange={(event) => setWorldName(event.target.value.slice(0, 30))}
                    placeholder="留空自动命名"
                    className="w-full rounded-card border border-line px-3 py-2 pr-14 text-base text-slate-950 focus:border-accent focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {worldName.length}/30
                  </span>
                </span>
              </label>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                为你的讨论创建一个新的世界，所有内容将归于此世界。
              </p>
            </div>
            <div className="p-4">
              <label
                className={[
                  "flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm",
                  worldMode === "continue" ? "border-accent bg-accentSoft text-accent" : "border-line text-slate-600",
                ].join(" ")}
              >
                <span className="font-bold">继续世界</span>
                <input
                  aria-label="继续世界"
                  type="radio"
                  name="world_mode"
                  checked={worldMode === "continue"}
                  onChange={() => setWorldMode("continue")}
                />
              </label>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
                搜索世界
                <span className="relative">
                  <input
                    aria-label="搜索世界"
                    value={worldSearch}
                    onChange={(event) => setWorldSearch(event.target.value)}
                    placeholder="搜索已有世界"
                    className="w-full rounded-card border border-line px-3 py-2 pr-9 text-base text-slate-950 focus:border-accent focus:outline-none"
                  />
                  <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </span>
              </label>
              <div className="mt-2 text-xs text-slate-500">已保存 {worlds.length} 个世界</div>
              {worlds.length === 0 && (
                <div className="mt-3 rounded-card border border-dashed border-line p-3 text-sm text-slate-500">
                  还没有保存的世界。可以先新建一个。
                </div>
              )}
              {worlds.length > 0 && filteredWorlds.length === 0 && (
                <div className="mt-3 rounded-card border border-dashed border-line p-3 text-sm text-slate-500">
                  没有匹配的世界。
                </div>
              )}
              {filteredWorlds.length > 0 && (
                <div
                  data-testid="world-picker-list"
                  className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1"
                >
                  {visibleWorlds.map((item) => (
                    <label
                      key={item.world_id}
                      className={[
                        "cursor-pointer rounded-card border bg-white p-3 text-sm",
                        selectedWorldId === item.world_id
                          ? "border-accent bg-accentSoft text-accent"
                          : "border-line text-slate-600",
                      ].join(" ")}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{item.name}</span>
                          <span className="mt-1 block truncate text-xs text-slate-500">
                            {item.identity_count} 人参与 · {item.latest?.content ?? "暂无最近内容"}
                          </span>
                        </span>
                        <input
                          type="radio"
                          name="world_picker"
                          checked={selectedWorldId === item.world_id}
                          onChange={() => {
                            setWorldMode("continue");
                            setSelectedWorldId(item.world_id);
                          }}
                        />
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div data-testid="compose-platform-panel" className="mt-4 rounded-card border border-line bg-white p-4"> {/* review:P11-T5 */}
          <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <SendIcon className="h-4 w-4" />
            <span>发布到</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {PLATFORMS.map((platform) => {
              const checked = selectedPlatforms.includes(platform.value);
              const PlatformIcon = platform.value === "reddit" ? RedditIcon : WeiboIcon;
              return (
                <label
                  key={platform.value}
                  className={[
                    "min-h-16 cursor-pointer rounded-card border p-3 text-sm",
                    checked ? "border-accent bg-accentSoft text-slate-950" : "border-line text-slate-600",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <PlatformIcon data-testid={`platform-icon-${platform.value}`} className="h-8 w-8 shrink-0" />
                      <span className="min-w-0">
                      <span className="block font-bold">{platform.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{platform.hint}</span>
                      </span>
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
            <div
              className={[
                "min-h-16 rounded-card border p-3 text-sm",
                selectedPlatforms.length >= 2 ? "border-accent bg-accentSoft" : "border-line bg-slate-50",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <MultiPlatformIcon data-testid="platform-icon-multi" className="h-8 w-8 shrink-0" />
                <div className="font-bold text-slate-950">多平台并发</div>
              </div>
              <p className="mt-1 leading-5 text-slate-500">
                {selectedPlatforms.length >= 2
                  ? "这条会同时在微博和 Reddit 发酵，热点会互相外溢。"
                  : "同时勾选微博和 Reddit 后启用。"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <aside
        data-testid="compose-launch-rail"
        className="grid gap-4 lg:sticky lg:top-24 lg:self-start"
      >
        <div className="rounded-card border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <ShieldIcon className="h-4 w-4" />
            <span>发帖身份</span>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-card border border-line px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-950">
                {identityMode === "continue" && selectedIdentity ? "已选身份" : identitySummary.label}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">{identitySummary.detail}</div>
            </div>
            <select
              aria-label="发帖身份类型"
              value={posterPersona}
              onChange={(event) => setPosterPersona(event.target.value as PersonaKind)}
              className="ml-3 rounded-md border border-line bg-white px-2 py-1 text-sm font-semibold text-slate-700"
            >
              {PERSONAS.map((persona) => (
                <option key={persona.value} value={persona.value}>
                  {persona.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {posterPersona === "kol" ? "头部意见领袖，适合观察强扩散场景。" : posterPersona === "verified" ? "自带基础扩散，适合观点型内容。" : "普通网友视角，适合看自然评论。"}
          </p>
          <details className="mt-3 rounded-card border border-line bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-bold text-accent">更换身份</summary>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              {PERSONAS.map((persona) => (
                <label
                  key={persona.value}
                  className={[
                    "cursor-pointer rounded-card border p-2",
                    posterPersona === persona.value
                      ? "border-accent bg-accentSoft text-accent"
                      : "border-line bg-white text-slate-600",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span>
                      <span className="block font-bold">{persona.label}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{persona.hint}</span>
                    </span>
                    <input
                      type="radio"
                      name="poster_persona"
                      checked={posterPersona === persona.value}
                      onChange={() => setPosterPersona(persona.value)}
                    />
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <label
                className={[
                  "cursor-pointer rounded-card border p-3",
                  identityMode === "new" ? "border-accent bg-accentSoft text-accent" : "border-line bg-white text-slate-600",
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
              </label>
              <label
                className={[
                  "cursor-pointer rounded-card border p-3",
                  identityMode === "continue" ? "border-accent bg-accentSoft text-accent" : "border-line bg-white text-slate-600",
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
              </label>
            </div>
            {identityMode === "new" && (
            <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
              身份昵称
              <input
                value={identityName}
                aria-label="身份昵称"
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
                  aria-label="搜索身份"
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
                          ? "border-accent bg-accentSoft text-accent"
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
          </details>
        </div>

        <div className="rounded-card border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <MessageCircleIcon className="h-4 w-4" />
            <span>讨论轮次</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
            {ROUNDS.map((round) => (
              <label
                key={round.value}
                className={[
                  "cursor-pointer rounded-card border px-2 py-2 text-center",
                  !customMode && steps === round.value ? "border-accent bg-accentSoft text-accent" : "border-line text-slate-600",
                ].join(" ")}
              >
                <span className="block font-bold">{round.value} 拍</span>
                <input
                  className="sr-only"
                  aria-label={round.label}
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
                "cursor-pointer rounded-card border px-2 py-2 text-center",
                customMode ? "border-accent bg-accentSoft text-accent" : "border-line text-slate-600",
              ].join(" ")}
            >
              <span className="block font-bold">自定义</span>
              <input
                className="sr-only"
                aria-label="自定义轮次"
                type="radio"
                name="steps"
                checked={customMode}
                onChange={() => setCustomMode(true)}
              />
            </label>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            第 1 拍发布原帖；之后每轮让一批模拟用户基于当前评论区继续互动。
          </p>
          <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
            自定义轮次数
            <input
              type="number"
              min={1}
              max={MAX_CUSTOM_STEPS}
              aria-label="自定义轮次数"
              value={customSteps}
              onChange={(event) => {
                setCustomMode(true);
                setCustomSteps(clampSteps(Number(event.target.value)));
              }}
              className="rounded-card border border-line px-3 py-2 text-base text-slate-950 focus:border-accent focus:outline-none"
            />
          </label>
          <div className="mt-2 text-xs text-slate-500">范围 1-1000 拍，当前 {selectedSteps} 拍。</div>
        </div>

        <div className="rounded-card border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <WalletIcon className="h-4 w-4" />
            <span>预计消耗</span>
          </div>
          {cost ? (
            <>
              <div className="mt-3 text-2xl font-black tabular text-slate-950">
                ¥{cost.estimated_rmb.toFixed(2)}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                约 ¥{cost.estimated_rmb.toFixed(2)} · {cost.budgeted_agents} 个可见人物 · {cost.decision_steps} 个决策拍
              </div>
              <div className="mt-3 rounded-card border border-warnBorder bg-warnSoft p-3 text-sm leading-6 text-warnInk"> {/* review:P7-T10 */}
                自有算力不额外计费；付费 API 按 token 估算约 ¥{cost.estimated_rmb.toFixed(2)}。
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-card border border-dashed border-line p-3 text-sm text-slate-500">
              正在根据轮次和可见人物估算。
            </div>
          )}
        </div>

        {error && <div className="rounded-card border border-red-200 bg-red-50 p-3 text-sm text-sentiment-negative">{error}</div>}
        <Button onClick={startRun} disabled={submitting}>
          {submitting ? "正在发起" : "开始围观"}
        </Button>
        <div className="text-center text-xs text-slate-400">点击即表示同意《围观服务条款》</div>

        <details className="min-w-0 rounded-card border border-line bg-slate-50 p-3 text-sm">
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
