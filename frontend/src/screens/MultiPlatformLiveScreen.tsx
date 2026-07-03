import { useMemo } from "react";

import type { WorldEvent } from "../api/client";
import { multiPlatformView } from "../pov/multiplatform";
import { PlatformSkinFeed, skinForPlatform } from "../skins/skin";

function platformName(platform: string) {
  if (platform === "twitter") return "微博";
  if (platform === "reddit") return "Reddit";
  return platform;
}

// review:P9-T6
export default function MultiPlatformLiveScreen({ events = [] }: { events?: WorldEvent[] }) {
  const view = useMemo(() => multiPlatformView(events), [events]);
  const hasBridges = view.bridges.length > 0;

  return (
    <div className="mx-auto max-w-[1500px] pb-8">
      <section className="mb-4 rounded-card border border-line bg-white p-5 shadow-spotlight">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-normal">多平台围观</h1>
            <p className="mt-1 text-sm text-slate-500">同一条内容在不同平台各自发酵，桥接线表示讨论外溢。</p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
            世界时钟 · 第 {view.clockTick} 拍
          </div>
        </div>
      </section>

      {hasBridges && (
        <div className="mb-4 flex flex-wrap gap-2">
          {view.bridges.map((bridge, index) => (
            <div
              key={`${bridge.fromPlatform}-${bridge.toPlatform}-${bridge.tick}-${index}`}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700"
            >
              {platformName(bridge.fromPlatform)} → {platformName(bridge.toPlatform)} · 第 {bridge.tick} 拍
            </div>
          ))}
        </div>
      )}

      <div
        className={[
          "relative grid gap-4",
          view.columns.length > 1 ? "xl:grid-cols-2 2xl:grid-cols-3" : "max-w-4xl",
        ].join(" ")}
      >
        {hasBridges && view.columns.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-32 z-10 hidden h-24 xl:block">
            {view.bridges.map((bridge, index) => (
              <div
                key={`line-${bridge.fromPlatform}-${bridge.toPlatform}-${bridge.tick}-${index}`}
                aria-label={`跨平台桥 ${bridge.fromPlatform} 到 ${bridge.toPlatform}`}
                className="absolute left-[calc(50%-64px)] top-8 flex w-32 items-center justify-center"
              >
                <span className="h-3 w-3 rounded-full border-2 border-indigo-400 bg-white shadow-sm" />
                <span className="h-0.5 flex-1 bg-indigo-400" />
                <span className="rounded-card border border-indigo-200 bg-white px-2 py-1 text-[11px] font-bold text-indigo-700 shadow-sm">
                  外溢
                </span>
                <span className="h-0.5 flex-1 bg-indigo-400" />
                <span className="h-3 w-3 rounded-full border-2 border-indigo-400 bg-white shadow-sm" />
              </div>
            ))}
          </div>
        )}
        {view.columns.map((column) => {
          const skin = skinForPlatform(column.platform);
          return (
            <article key={column.platform} className="min-w-0">
              <div className="mb-2 flex items-center justify-between rounded-card border border-line bg-white px-4 py-3 shadow-sm">
                <div className="text-lg font-black">{skin.label}</div>
                <div className="text-xs font-semibold text-slate-500">{platformName(column.platform)} 现场</div>
              </div>
              <PlatformSkinFeed skin={skin.id} vm={column.view} />
            </article>
          );
        })}
      </div>

      {view.columns.length === 0 && (
        <div className="rounded-card border border-dashed border-line bg-white p-10 text-center text-sm text-slate-400">
          等待多平台内容出现...
        </div>
      )}
    </div>
  );
}
