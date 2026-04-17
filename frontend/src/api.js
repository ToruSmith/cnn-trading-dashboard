export async function runExperiment(params) {
  const res = await fetch("YOUR_BACKEND_URL/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return res.json();
}
