import numpy as np

def backtest(pred, price):

    capital = 100
    equity = []

    for i in range(len(pred)):
        if pred[i] == 1:
            capital *= (price[i+1] / price[i])

        equity.append(capital)

    return equity


def sharpe_ratio(equity):
    returns = np.diff(equity) / equity[:-1]
    return np.mean(returns) / (np.std(returns)+1e-6)
