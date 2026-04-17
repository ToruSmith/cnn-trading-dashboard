import { useState } from "react";
import { runExperiment } from "../api";

export default function ControlPanel({ setResult, setHistory }) {

  const [lr, setLr] = useState(0.001);
  const [batch, setBatch] = useState(32);

  const run = async () => {
    const params = { lr, batch, filters: 32 };

    const res = await runExperiment(params);

    setResult(res);
    setHistory(prev => [res, ...prev]);
  };

  return (
    <div>
      <h3>控制面板</h3>

      <label>LR:</label>
      <input value={lr} onChange={e=>setLr(Number(e.target.value))} />

      <label>Batch:</label>
      <input value={batch} onChange={e=>setBatch(Number(e.target.value))} />

      <button onClick={run}>🚀 Run</button>
    </div>
  );
}
