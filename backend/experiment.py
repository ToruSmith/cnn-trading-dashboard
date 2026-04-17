from dataset import generate_data
from model import build_model
import numpy as np

def run_experiment(params):
    X, y = generate_data()

    split = int(len(X)*0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    model = build_model(
        filters=params.get("filters", 32),
        lr=params.get("lr", 0.001)
    )

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=5,
        batch_size=params.get("batch", 32),
        verbose=0
    )

    acc = max(history.history['val_accuracy'])

    return {
        "accuracy": float(acc),
        "loss": history.history['loss'],
        "val_loss": history.history['val_loss']
    }
