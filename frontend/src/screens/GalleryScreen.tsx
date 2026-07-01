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
    <div>
      <h1 className="mb-4 font-display text-2xl">选一个圈子</h1>
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
      <div className="mt-6">
        <textarea
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="一句话描述你的受众（如：一二线城市、重性价比的年轻妈妈）"
          className="w-full rounded-card border border-ink/15 p-3 text-sm"
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
