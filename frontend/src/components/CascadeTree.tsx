import type { CascadeNode } from "../api/client";

export function CascadeTree({ nodes }: { nodes: CascadeNode[] }) {  // review:P8-T7
  if (nodes.length === 0) {
    return <EmptyPanel label="还没有形成转发或引用级联。" />;
  }
  return (
    <div className="grid gap-3">
      {nodes.map((node) => (
        <div
          key={node.post_id}
          className="flex items-center gap-3 rounded-card border border-line bg-white p-3 shadow-sm"
          style={{ marginLeft: `${Math.min(node.depth, 4) * 28}px` }}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-slate-950">
            {node.depth === 0 ? "源" : node.depth}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-950">
              {node.depth === 0 ? "原帖" : "扩散节点"} @{node.author_id}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              下游 {node.children.length} 个 · 深度 {node.depth}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-white p-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}
