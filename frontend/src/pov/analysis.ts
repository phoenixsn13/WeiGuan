import type { AnalysisProjection, TemporalMetrics } from "../api/client";

export type AnalysisTab = "diffusion" | "opinion" | "influence" | "temporal" | "trends";
export type Sentiment = "positive" | "negative" | "neutral";

export const analysisTabs: Array<{ key: AnalysisTab; label: string }> = [
  { key: "diffusion", label: "传播树" },
  { key: "opinion", label: "立场分化" },
  { key: "influence", label: "影响力榜" },
  { key: "temporal", label: "情绪时间线" },
  { key: "trends", label: "数据趋势" },
];

export function riskLabel(risk: string): string {
  if (risk === "high") return "高";
  if (risk === "medium") return "中等";
  return "低";
}

export function sentimentLabel(value: string): string {
  if (value === "positive") return "正向";
  if (value === "negative") return "负向";
  return "中立";
}

export function insightCards(a: AnalysisProjection): { title: string; body: string; sentiment?: Sentiment }[] {  // review:P8-T7
  const cards: { title: string; body: string; sentiment?: Sentiment }[] = [];
  const keyNode = a.diffusion.key_rebroadcasters[0] ?? a.influence.top_leaders[0];
  if (keyNode !== undefined) {
    cards.push({
      title: "关键传播节点",
      body: `@${keyNode} 带动了主要扩散，适合优先回应或补充材料。`,
      sentiment: "positive",
    });
  }
  const reversal = a.temporal.sentiment_reversals[0];
  if (reversal) {
    cards.push({
      title: "立场拐点",
      body: `第 ${reversal.tick} 拍出现从${sentimentLabel(reversal.from)}到${sentimentLabel(reversal.to)}的转向。`,
      sentiment: reversal.to === "negative" ? "negative" : "positive",
    });
  }
  if (a.opinion.echo_chamber_risk !== "low" || a.opinion.polarization_index >= 0.5) {
    cards.push({
      title: "走向极化",
      body: `极化指数 ${Math.round(a.opinion.polarization_index * 100)}%，跨立场互动偏低，建议主动桥接不同观点。`,
      sentiment: "negative",
    });
  }
  if (a.temporal.half_life_ticks > 0) {
    cards.push({
      title: "发酵半衰期",
      body: `半衰期约 ${a.temporal.half_life_ticks} 拍，峰值过后仍有窗口补充事实。`,
      sentiment: "neutral",
    });
  }
  if (cards.length === 0) {
    cards.push({
      title: "讨论尚浅",
      body: "暂未形成明确传播节点或立场拐点，可以等待更多评论后再复盘。",
      sentiment: "neutral",
    });
  }
  return cards;
}

export function phaseCards(a: AnalysisProjection): Array<{ title: string; body: string; value: string }> {
  return [
    {
      title: `传播树深度 ${a.diffusion.max_depth} 层`,
      body: `一级扩散 ${a.diffusion.breadth} 个节点，级联规模 ${a.diffusion.cascade_size}。`,
      value: `${a.diffusion.cascade_size}`,
    },
    {
      title: `极化风险${riskLabel(a.opinion.echo_chamber_risk)}`,
      body: `同立场互动 ${Math.round(a.opinion.homophily * 100)}%，跨立场互动 ${Math.round(a.opinion.cross_stance_ratio * 100)}%。`,
      value: `${Math.round(a.opinion.polarization_index * 100)}%`,
    },
    {
      title: "结构影响力",
      body: a.influence.ranking[0]
        ? `@${a.influence.ranking[0].actor_id} 居首，入度 ${a.influence.ranking[0].in_degree}。`
        : "暂无可排序的互动节点。",
      value: `${a.influence.ranking.length}`,
    },
    {
      title: `峰值第 ${a.temporal.peak_tick} 拍`,
      body: `半衰期约 ${a.temporal.half_life_ticks || 0} 拍。`,
      value: `${peakVolume(a.temporal)}`,
    },
  ];
}

function peakVolume(temporal: TemporalMetrics): number {
  return Math.max(0, ...temporal.fermentation_curve.map((point) => point.volume));
}
