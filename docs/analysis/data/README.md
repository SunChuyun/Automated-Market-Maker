# Data

`eth_usd_hourly_kraken.csv` — ETH/USD hourly OHLC candles from Kraken's public API
(`/0/public/OHLC?pair=XETHZUSD&interval=60`), retrieved 2026-10-28. The last row is the
candle in progress at retrieval time; the notebook drops it. Used by Section 5 (DCA backtest)
as the external reference price path. Prices are in USD; the model assumes 1 USDX = 1 USD.
