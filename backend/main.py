@app.post("/run")
def run(params: dict):
    result = run_experiment(params)

    return {
        "params": params,
        "metrics": {
            "accuracy": result["accuracy"],
            "sharpe": result["sharpe"]
        },
        "equity_curve": result["equity"],
        "history": {
            "loss": result["loss"],
            "val_loss": result["val_loss"]
        }
    }
