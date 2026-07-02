const RULES: Array<[RegExp, string]> = [
  [/spacex|space x/i, "SpaceX"],
  [/特斯拉|tesla/i, "特斯拉"],
  [/deepseek|深度求索/i, "DeepSeek"],
  [/智谱|glm/i, "智谱"],
  [/稀宇|moonshot|kimi/i, "稀宇"],
  [/股价|股票|财报|估值|现金流|市值/, "股价讨论"],
  [/大模型|模型|AI|llm/i, "大模型"],
  [/性能|构建|缓存|前端|后端|架构|部署|编译/, "技术讨论"],
  [/游戏|主机|显卡|帧率/, "游戏圈"],
  [/育儿|孩子|妈妈|亲子|早教/, "育儿"],
  [/粉丝|超话|安利|控评|热搜/, "饭圈"],
];

export function topicTags(content: string): string[] {
  const tags: string[] = [];
  for (const [pattern, tag] of RULES) {
    if (pattern.test(content) && !tags.includes(tag)) tags.push(tag);
    if (tags.length >= 2) break;
  }
  return tags;
}
