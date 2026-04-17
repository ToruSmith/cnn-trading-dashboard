import numpy as np

def build_dataset(df, window=30):

    X, y = [], []

    for i in range(len(df) - window - 5):
        x = df.iloc[i:i+window][["close","ma5","ma20","volume"]].values
        future = df.iloc[i+window+5]["close"]

        label = 1 if future > df.iloc[i+window]["close"] else 0

        X.append(x)
        y.append(label)

    return np.array(X), np.array(y)
