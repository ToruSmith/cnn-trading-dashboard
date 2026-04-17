import { runExperiment } from "../api";

export default function ControlPanel({ setResult, setHistory }) {

  const run = async () => {
    const params = {
      lr: 0.001,
      batch: 32
    };

    const res = await runExperiment(params);
    setResult(res);
    setHistory(prev => [res, ...prev]);
  };

  return (
    <div style={{ width: "250px", padding: "20px", borderRight: "1px solid gray" }}>
      <h3>控制面板</h3>
      <button onClick={run}>🚀 Run</button>
    </div>
  );
}
