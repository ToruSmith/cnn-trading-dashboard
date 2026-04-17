export async function runExperiment(params) {
  try {
    const res = await fetch("YOUR_BACKEND_URL/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params)
    });

    return await res.json();

  } catch (err) {
    console.error(err);
  }
}
