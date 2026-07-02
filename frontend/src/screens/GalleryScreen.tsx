import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchCrowds, type Crowd } from "../api/client";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

// review:P4-T5
export default function GalleryScreen() {
  const [crowds, setCrowds] = useState<Crowd[]>([]);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const loadCrowds = () => {
    setLoading(true);
    setError(false);
    fetchCrowds()
      .then((items) => {
        setCrowds(items);
        setError(false);
      })
      .catch(() => {
        setCrowds([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCrowds();
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 rounded-card border border-line bg-white p-6 shadow-spotlight">
        <h1 className="text-3xl font-black tracking-normal">选一个圈子</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          先选择谁会看到这条内容，再像发微博一样写正文。
        </p>
      </div>
      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="min-h-28 animate-pulse rounded-card border border-line bg-white p-4 shadow-sm"
            >
              <div className="h-7 w-7 rounded bg-slate-100" />
              <div className="mt-4 h-4 w-24 rounded bg-slate-100" />
              <div className="mt-3 h-3 w-32 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-card border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
          <div className="text-base font-black text-red-900">圈子加载失败</div>
          <p className="mt-2 leading-6">
            没有连上圈子接口。请确认后端服务在 http://127.0.0.1:8000，然后重试。
          </p>
          <button
            className="mt-4 min-h-10 rounded-card bg-white px-4 font-semibold text-red-700 shadow-sm hover:bg-red-100"
            onClick={loadCrowds}
          >
            重试
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {crowds.map((crowd) => (
            <button
              key={crowd.id}
              className="text-left"
              onClick={() =>
                navigate("/compose", { state: { audience: { crowd_id: crowd.id } } })
              }
            >
              <Card interactive>
                <div className="text-2xl">{crowd.emoji}</div>
                <div className="mt-1 font-medium">{crowd.name}</div>
                <div className="text-xs text-ink/50">{crowd.blurb}</div>
              </Card>
            </button>
          ))}
          {crowds.length === 0 && (
            <div className="col-span-full rounded-card border border-dashed border-line bg-white p-6 text-center text-sm text-slate-400">
              暂无可选圈子。
            </div>
          )}
        </div>
      )}
      <div className="mt-6 rounded-card border border-line bg-white p-5 shadow-sm">
        <textarea
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="一句话描述你的受众（如：一二线城市、重性价比的年轻妈妈）"
          className="w-full rounded-card border border-line p-3 text-sm focus:border-accent focus:outline-none"
          rows={2}
        />
        <div className="mt-2">
          <Button
            onClick={() =>
              custom.trim() &&
              navigate("/compose", { state: { audience: { custom: custom.trim() } } })
            }
          >
            用这个受众围观 →
          </Button>
        </div>
      </div>
    </div>
  );
}
