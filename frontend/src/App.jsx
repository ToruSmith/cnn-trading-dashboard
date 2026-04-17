import { useState } from "react";
import ControlPanel from "./components/ControlPanel";
import KPI from "./components/KPI";
import ChartPanel from "./components/ChartPanel";
import Table from "./components/Table";

function App() {
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f172a", color: "white" }}>
      <ControlPanel setResult={setResult} setHistory={setHistory} />

      <div style={{ flex: 1, padding: "20px" }}>
        <KPI data={result} />
        <ChartPanel data={result} />
        <Table history={history} />
      </div>
    </div>
  );
}

export default App;
