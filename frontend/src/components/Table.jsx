export default function Table({ history }) {

  const sorted = [...history].sort(
    (a, b) => b.metrics.sharpe - a.metrics.sharpe
  );

  return (
    <div>
      <h3>🏆 Experiment Ranking</h3>

      <table>
        <thead>
          <tr>
            <th>Acc</th>
            <th>Sharpe</th>
            <th>LR</th>
            <th>Batch</th>
          </tr>
        </thead>

        <tbody>
          {sorted.map((item, i) => (
            <tr key={i}>
              <td>{item.metrics.accuracy.toFixed(3)}</td>
              <td>{item.metrics.sharpe.toFixed(2)}</td>
              <td>{item.params.lr}</td>
              <td>{item.params.batch}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
