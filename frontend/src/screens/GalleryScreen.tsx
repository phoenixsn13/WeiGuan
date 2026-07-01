import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchCrowds, type Crowd } from "../api/client";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

// review:P4-T5
export default function GalleryScreen() {
  const [crowds, setCrowds] = useState<Crowd[]>([]);
  const [custom, setCustom] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchCrowds()
      .then(setCrowds)
      .catch(() => setCrowds([]));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 rounded-card border border-line bg-white p-6 shadow-spotlight">
        <h1 className="text-3xl font-black tracking-normal">选一个圈子</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          先选择谁会看到这条内容，再像发微博一样写正文。
        </p>
      </div>
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
      </div>
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
