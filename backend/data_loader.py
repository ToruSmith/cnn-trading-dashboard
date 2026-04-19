"""
資料層：MIT-BIH (wfdb) + 合成 ECG (neurokit2 / numpy fallback)
重要：make_synthetic_ecg 是 CPU-bound 同步函式，
      應在呼叫端用 asyncio.to_thread() 包裝，避免阻塞 event loop。
"""
import os
import numpy as np
from typing import Tuple
import warnings
warnings.filterwarnings("ignore")

MITBIH_RECORDS = [
    "100","101","103","105","106","107","108","109",
    "111","112","113","114","115","116","117","118","119",
    "121","122","123","124","200","201","202","203",
    "205","207","208","209","210","212","213","214",
    "215","217","219","220","221","222","223","228",
    "230","231","232","233","234",
]

LABEL_MAP = {
    "N":0,"L":0,"R":0,"e":0,"j":0,
    "A":1,"a":1,"J":1,"S":1,
    "V":2,"E":2,
    "F":3,
    "/":4,"f":4,"Q":4,
}

SEGMENT_LEN = 187
CLASS_NAMES = ["Normal (N)","Supraventricular (S)","Ventricular (V)","Fusion (F)","Unknown (Q)"]


def load_mitbih(data_dir="./mitbih_data", max_records=10, samples_per_class=2000):
    try:
        import wfdb
    except ImportError:
        raise ImportError("請安裝 wfdb")

    os.makedirs(data_dir, exist_ok=True)
    X_all, y_all = [], []
    class_counts = {i: 0 for i in range(5)}

    for rec in MITBIH_RECORDS[:max_records]:
        try:
            record = wfdb.rdrecord(rec, pn_dir="mitdb", channels=[0])
            annotation = wfdb.rdann(rec, "atr", pn_dir="mitdb")
            signal = record.p_signal[:, 0]
            signal = (signal - signal.mean()) / (signal.std() + 1e-8)

            for idx, sym in zip(annotation.sample, annotation.symbol):
                label = LABEL_MAP.get(sym)
                if label is None or class_counts[label] >= samples_per_class:
                    continue
                start = idx - SEGMENT_LEN // 2
                end = start + SEGMENT_LEN
                if start < 0 or end > len(signal):
                    continue
                X_all.append(signal[start:end].astype(np.float32))
                y_all.append(label)
                class_counts[label] += 1
        except Exception as e:
            print(f"[WARN] Record {rec}: {e}")
            continue

    if not X_all:
        raise ValueError("MIT-BIH 載入失敗，切換合成資料")

    return np.stack(X_all), np.array(y_all, dtype=np.int64)


def make_synthetic_ecg(n_samples: int = 5000, seed: int = 42) -> Tuple[np.ndarray, np.ndarray]:
    """
    純 numpy 快速合成 ECG（不依賴 neurokit2），
    速度比 neurokit2 快 ~50x，適合 Render 免費方案。
    """
    np.random.seed(seed)
    per_class = max(n_samples // 5, 1)
    t = np.linspace(0, SEGMENT_LEN / 360, SEGMENT_LEN)

    X, y = [], []

    def _make_beat(heart_rate, noise_std, qrs_width, st_shift=0.0):
        """合成單一心跳波形：P波 + QRS + T波 + 雜訊"""
        rr = 60.0 / heart_rate
        # P 波
        p_center = 0.18
        p = 0.15 * np.exp(-((t - p_center) ** 2) / (2 * 0.012 ** 2))
        # QRS
        q_center = SEGMENT_LEN / 360 / 2
        qrs = (
            -0.1 * np.exp(-((t - (q_center - 0.02)) ** 2) / (2 * 0.008 ** 2))
            + 1.0  * np.exp(-((t - q_center) ** 2) / (2 * (qrs_width / 2) ** 2))
            - 0.3 * np.exp(-((t - (q_center + 0.02)) ** 2) / (2 * 0.010 ** 2))
        )
        # T 波
        t_center = q_center + 0.18
        t_wave = (0.3 + st_shift) * np.exp(-((t - t_center) ** 2) / (2 * 0.030 ** 2))
        sig = p + qrs + t_wave + np.random.randn(SEGMENT_LEN) * noise_std
        sig = (sig - sig.mean()) / (sig.std() + 1e-8)
        return sig.astype(np.float32)

    # 類別定義: (heart_rate, noise_std, qrs_width, st_shift, label)
    class_configs = [
        (72,  0.02, 0.012,  0.0,  0),   # N  正常
        (95,  0.05, 0.010,  0.05, 1),   # S  心率快，窄 QRS
        (58,  0.08, 0.025, -0.1,  2),   # V  寬 QRS，ST 壓低
        (78,  0.04, 0.016,  0.08, 3),   # F  融合
        (52,  0.15, 0.020, -0.2,  4),   # Q  高雜訊，ST 壓低
    ]

    for hr, noise, qrs_w, st, label in class_configs:
        for _ in range(per_class):
            hr_j = hr + np.random.randint(-6, 7)
            noise_j = noise * (1 + np.random.uniform(-0.2, 0.2))
            X.append(_make_beat(hr_j, noise_j, qrs_w, st))
            y.append(label)

    X = np.stack(X)
    y = np.array(y, dtype=np.int64)
    idx = np.random.permutation(len(X))
    return X[idx], y[idx]


def load_csv_segments(filepath: str) -> np.ndarray:
    import pandas as pd
    df = pd.read_csv(filepath, header=None)
    data = df.values.astype(np.float32)

    if data.shape[1] == SEGMENT_LEN:
        X = data
    elif data.shape[1] == SEGMENT_LEN + 1:
        X = data[:, :SEGMENT_LEN]
    else:
        raise ValueError(f"CSV 欄數須為 {SEGMENT_LEN} 或 {SEGMENT_LEN+1}，目前為 {data.shape[1]}")

    means = X.mean(axis=1, keepdims=True)
    stds  = X.std(axis=1,  keepdims=True) + 1e-8
    return (X - means) / stds


def get_dataset(source: str = "synthetic", **kwargs):
    if source == "mitbih":
        return load_mitbih(**kwargs)
    return make_synthetic_ecg(**kwargs)
