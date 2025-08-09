import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Bell,
  Settings,
  BarChart3,
  Target,
  Mail,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import axios from "axios";

const BitcoinAlertApp = () => {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [previousPage, setPreviousPage] = useState("");
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [btcPrice, setBtcPrice] = useState(0);
  const [btcPriceUSD, setBtcPriceUSD] = useState(0);
  const [priceHistory, setPriceHistory] = useState([]);
  const [btcData, setBtcData] = useState({
    current: 0,
    low: 0,
    high: 0,
    open: 0,
    sevenDayAvg: 0,
    rsi: 0,
    change24h: 0,
  });

  useEffect(() => {
    const fetchBTCData = async () => {
      if (currentPage !== "dashboard" && currentPage !== "analysis") return;
      try {
        // 1. Fetch BTC/USDT Kline (candlestick) data for 14 days
        const res1 = await axios.get(
          "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=14"
        );

        const candles = res1.data; // Each candle = [time, open, high, low, close, ...]

        // 2. Fetch current BTC/USDT price
        const priceRes = await axios.get(
          "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
        );
        const currentUSD = parseFloat(priceRes.data.price);
        setBtcPriceUSD(currentUSD);
        // 3. Fetch USD to INR rate using the new API
        const fxRes = await axios.get(
          "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json"
        );
        const usdToInr = fxRes.data.usd.inr;
        // 4. Extract historical closing prices (for RSI, 7-day avg)
        const closePrices = candles.map((c) => parseFloat(c[4])); // close price

        const current = Math.round(currentUSD * usdToInr);

        // Fixed: Properly calculate low and high prices in INR
        const low = Math.round(
          Math.min(...candles.map((c) => parseFloat(c[3]) * usdToInr))
        ); // 14-day low
        const high = Math.round(
          Math.max(...candles.map((c) => parseFloat(c[2]) * usdToInr))
        ); // 14-day high
        const open = Math.round(
          parseFloat(candles[candles.length - 1][1]) * usdToInr
        ); // yesterday's open

        // 5. Calculate 7-day average (last 7 closes)
        const last7ClosesUSD = closePrices.slice(-7);
        const last7ClosesINR = last7ClosesUSD.map((price) =>
          Math.round(price * usdToInr)
        );
        const sevenDayAvg =
          last7ClosesINR.reduce((sum, val) => sum + val, 0) /
          last7ClosesINR.length;

        setPriceHistory(last7ClosesINR);

        // 6. Calculate RSI
        const changes = closePrices.slice(1).map((p, i) => p - closePrices[i]);
        const gains = changes.filter((c) => c > 0);
        const losses = changes.filter((c) => c < 0).map((x) => Math.abs(x));
        const avgGain = gains.reduce((a, b) => a + b, 0) / 14 || 0.01;
        const avgLoss = losses.reduce((a, b) => a + b, 0) / 14 || 0.01;
        const rs = avgGain / avgLoss;
        const rsi = 100 - 100 / (1 + rs);

        // 7. Change in 24h %
        const yesterdayClose = parseFloat(candles[candles.length - 2][4]);
        const change24h =
          ((currentUSD - yesterdayClose) / yesterdayClose) * 100;

        setBtcPrice(current);
        setBtcData({
          current,
          low,
          high,
          open,
          sevenDayAvg: Math.round(sevenDayAvg),
          rsi: Math.round(rsi),
          change24h: parseFloat(change24h.toFixed(2)),
        });
      } catch (err) {
        console.error("Error fetching Binance BTC data:", err);
      }
    };

    fetchBTCData();
    const interval = setInterval(fetchBTCData, 5000); // update every 5 sec
    return () => clearInterval(interval);
  }, [currentPage]);

  // Handle page transitions
  const handlePageChange = (newPage) => {
    if (newPage !== currentPage) {
      setPreviousPage(currentPage);
      setIsPageTransitioning(true);
      setCurrentPage(newPage);

      setTimeout(() => {
        setIsPageTransitioning(false);
      }, 800);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const isGoodTimeToBuy = () => {
    return (
      btcData.rsi < 30 ||
      btcPrice < btcData.sevenDayAvg ||
      btcData.priceChange24h < -5
    );
  };

  const MiniChart = () => {
    return (
      <div className="w-full h-16 flex items-end space-x-1">
        {priceHistory.map((price, index) => {
          const maxPrice = Math.max(...priceHistory);
          const minPrice = Math.min(...priceHistory);
          const height =
            ((price - minPrice) / (maxPrice - minPrice)) * 140 + 20;

          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center group"
            >
              <div
                className={`w-full rounded-t-lg transition-all duration-500 hover:scale-105 ${
                  index === priceHistory.length - 1
                    ? "bg-gradient-to-t from-gray-600 to-gray-400 shadow-lg shadow-orange-500/30 animate-pulse"
                    : "bg-gradient-to-t from-gray-600 to-gray-400"
                }`}
                style={{
                  height: `${height}px`,
                  animationDelay: `${index * 100}ms`,
                }}
              />

              {/* ✅ New: Show price value */}
              <span className="text-sm font-semibold text-gray-200 mt-2">
                ₹{(price / 100000).toFixed(2)}L
              </span>

              {/* Existing Day label */}
              <span className="text-xs mt-1 group-hover:text-orange-100 transition-colors text-amber-100 duration-300">
                Day {index + 1}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const Dashboard = () => (
    <div
      className={`space-y-6 ${
        isPageTransitioning && currentPage === "dashboard"
          ? "animate-fade-in"
          : ""
      }`}
    >
      <div
        className={`bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white p-8 rounded-3xl shadow-2xl border border-orange-400/20 backdrop-blur-sm hover:shadow-orange-500/25 transition-all duration-500 hover:scale-[1.02] ${
          isPageTransitioning && currentPage === "dashboard"
            ? "animate-slide-up"
            : ""
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className={`text-2xl font-bold ${
              isPageTransitioning && currentPage === "dashboard"
                ? "animate-fade-in-delay"
                : ""
            }`}
          >
            Live Bitcoin Price
          </h2>
          <div className="flex items-center space-x-2 animate-bounce-gentle">
            {btcData.change24h >= 0 ? (
              <TrendingUp className="w-6 h-6 text-green-300 animate-pulse" />
            ) : (
              <TrendingDown className="w-6 h-6 text-red-300 animate-pulse" />
            )}
            <span
              className={`text-lg font-semibold transition-colors duration-300 ${
                btcData.change24h >= 0 ? "text-green-300" : "text-red-300"
              }`}
            >
              {btcData.change24h > 0 ? "+" : ""}
              {btcData.change24h}%
            </span>
          </div>
        </div>

        <div className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-orange-100 bg-clip-text text-transparent">
          {btcPriceUSD}$
        </div>
        <div className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-orange-100 bg-clip-text text-transparent">
          {formatPrice(btcPrice)}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <p className="text-orange-200 text-sm">Today's Low</p>
            <p className="text-xl font-semibold">{formatPrice(btcData.low)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <p className="text-orange-200 text-sm">Today's High</p>
            <p className="text-xl font-semibold">{formatPrice(btcData.high)}</p>
          </div>
        </div>

        <div
          className={`${
            isPageTransitioning && currentPage === "dashboard"
              ? "animate-slide-up-delay"
              : ""
          }`}
        >
          <MiniChart />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          className={`bg-gray-800/90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-gray-700/50 hover:border-orange-500/50 transition-all duration-500 hover:scale-105 ${
            isPageTransitioning && currentPage === "dashboard"
              ? "animate-slide-left"
              : ""
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-100">
              Market Analysis
            </h3>
            <BarChart3 className="w-5 h-5 text-orange-400 animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors duration-300">
              <span className="text-gray-300">7-Day Average</span>
              <span className="font-semibold text-gray-100">
                {formatPrice(btcData.sevenDayAvg)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors duration-300">
              <span className="text-gray-300">RSI (14)</span>
              <span
                className={`font-semibold transition-colors duration-300 ${
                  btcData.rsi < 30
                    ? "text-green-400"
                    : btcData.rsi > 70
                    ? "text-red-400"
                    : "text-yellow-400"
                }`}
              >
                {btcData.rsi.toFixed(2)}{" "}
                {btcData.rsi < 30
                  ? "(Oversold)"
                  : btcData.rsi > 70
                  ? "(Overbought)"
                  : "(Neutral)"}
              </span>
            </div>
          </div>
        </div>

        {/* ✅ Place your Investment Signal card here */}
        <div
          className={`rounded-2xl p-6 shadow-2xl border backdrop-blur-sm transition-all duration-500 hover:scale-105 ${
            isPageTransitioning && currentPage === "dashboard"
              ? "animate-slide-right"
              : ""
          } ${
            isGoodTimeToBuy()
              ? "bg-gradient-to-br from-green-900/80 to-green-800/80 border-green-500/50 hover:border-green-400/70"
              : "bg-gradient-to-br from-red-900/80 to-red-800/80 border-red-500/50 hover:border-red-400/70"
          }`}
        >
          <div className="flex items-center space-x-3 mb-4">
            {isGoodTimeToBuy() ? (
              <CheckCircle2 className="w-6 h-6 text-green-400 animate-pulse" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-400 animate-pulse" />
            )}
            <h3 className="text-lg font-semibold text-gray-100">
              Investment Signal
            </h3>
          </div>
          <p
            className={`text-lg font-medium transition-colors duration-300 ${
              isGoodTimeToBuy() ? "text-green-200" : "text-red-200"
            }`}
          >
            {isGoodTimeToBuy()
              ? "Today might be a dip — you could consider buying!"
              : "BTC is currently above average. Not the best time to buy."}
          </p>
        </div>
      </div>

      <div
        className={`flex space-x-4 ${
          isPageTransitioning && currentPage === "dashboard"
            ? "animate-slide-up-delay"
            : ""
        }`}
      >
        <button
          onClick={() => handlePageChange("alerts")}
          className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-300 shadow-lg hover:shadow-orange-500/25 hover:scale-105 transform"
        >
          <Bell className="w-5 h-5" />
          <span>Set New Alert</span>
        </button>
        <button
          onClick={() => handlePageChange("analysis")}
          className="flex items-center space-x-2 bg-gray-700/80 hover:bg-gray-600/80 text-gray-100 px-8 py-4 rounded-2xl font-semibold transition-all duration-300 backdrop-blur-sm border border-gray-600/50 hover:border-orange-500/50 hover:scale-105 transform"
        >
          <BarChart3 className="w-5 h-5" />
          <span>See Analysis</span>
        </button>
      </div>
    </div>
  );

  const AlertsPage = () => {
    const [alerts, setAlerts] = useState({
      priceAlert: "",
      useRSI: true,
      useMA: true,
      notifications: {
        email: true,
        telegram: false,
        sms: false,
      },
    });

    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleSaveAlert = async () => {
      try {
        // Convert both values to numbers for comparison
        const alertPrice = Number(alerts.priceAlert);
        const currentPrice = Number(btcPriceUSD);

        // Validate the alert price
        if (alertPrice >= currentPrice) {
          setError(
            "⚠️ Alert price must be lower than the current BTC price ($" +
              btcPriceUSD +
              ")"
          );
          return;
        }

        if (!alertPrice || isNaN(alertPrice)) {
          setError("⚠️ Please enter a valid price alert value");
          return;
        }

        const subject = "Crypto Alert Triggered";
        const message = `
      Your alert has been set with the following details:
      Price Alert: $${alerts.priceAlert}
      Strategies: ${alerts.useRSI ? "RSI " : ""}${alerts.useMA ? "MA" : ""}
    `;

        const res = await fetch("http://localhost:5000/api/send-alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject,
            message,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to send alert");
        }

        // Clear error and show success message
        setError("");
        alert(`Alert settings saved! Email sent to ${email}`);
      } catch (err) {
        setError(err.message || "Error saving alert settings.");
      }
    };

    const handleSaveClick = () => {
      if (alerts.notifications.email) {
        if (!email || !validateEmail(email)) {
          setError("Please enter a valid email address.");
          return;
        }
      }
      setError("");
      handleSaveAlert();
    };

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-gray-700/50">
          <h2 className="text-3xl font-bold text-gray-100 mb-8 flex items-center space-x-3">
            <Target className="w-8 h-8 text-orange-500 animate-pulse" />
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Set Smart Alerts
            </span>
          </h2>

          <div className="space-y-8">
            {/* Price Alert */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Alert me when BTC price drops below:
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-orange-400 font-bold text-lg">
                  ₹
                </span>
                <input
                  type="text" // changed from number to text to prevent auto-blur issue
                  pattern="\d*"
                  inputMode="numeric"
                  value={alerts.priceAlert}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, ""); // allow only digits
                    setAlerts((prev) => ({
                      ...prev,
                      priceAlert: value,
                    }));
                  }}
                  placeholder="45000$"
                  className="w-full pl-10 pr-4 py-4 bg-gray-700/50 border border-gray-600 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg text-gray-100 placeholder-gray-400 backdrop-blur-sm transition-all duration-300 hover:bg-gray-700/70"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            {/* Notification Methods */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-100">
                Notification Methods
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center space-x-3 p-4 border border-gray-600/50 rounded-2xl hover:bg-gray-700/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alerts.notifications.email}
                    onChange={(e) =>
                      setAlerts((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          email: e.target.checked,
                        },
                      }))
                    }
                    className="w-5 h-5 text-green-500 bg-gray-700 border-gray-600 rounded"
                  />
                  <Mail className="w-5 h-5 text-green-400" />
                  <span className="font-medium text-gray-100">Email</span>
                </label>
              </div>

              {/* Email Input */}
              {alerts.notifications.email && (
                <div className="relative group">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-4 pr-4 py-4 bg-gray-700/50 border border-gray-600 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg text-gray-100 placeholder-gray-400"
                  />
                  {error && <p className="text-red-500 mt-2">{error}</p>}
                </div>
              )}
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveClick}
              className="w-full bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 text-white py-5 rounded-2xl font-bold text-xl"
            >
              <span className="flex items-center justify-center space-x-2">
                <Bell className="w-6 h-6" />
                <span>Save Alert Settings</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AnalysisPage = () => (
    <div
      className={`space-y-6 ${
        isPageTransitioning && currentPage === "analysis"
          ? "animate-fade-in"
          : ""
      }`}
    >
      <div
        className={`bg-gray-800/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-gray-700/50 hover:border-orange-500/50 transition-all duration-500 ${
          isPageTransitioning && currentPage === "analysis"
            ? "animate-slide-up"
            : ""
        }`}
      >
        <h2 className="text-3xl font-bold text-gray-100 mb-8 flex items-center space-x-3">
          <BarChart3 className="w-8 h-8 text-orange-500 animate-pulse" />
          <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            Price Analysis
          </span>
        </h2>

        <div
          className={`mb-8 ${
            isPageTransitioning && currentPage === "analysis"
              ? "animate-slide-up-delay"
              : ""
          }`}
        >
          <h3 className="text-xl font-semibold text-gray-100 mb-6">
            7-Day Price Trend
          </h3>
          <div className="bg-gradient-to-r from-gray-700/50 to-gray-800/50 p-6 rounded-2xl border border-gray-600/30 backdrop-blur-sm">
            <div className="h-40 flex items-end space-x-3">
              {priceHistory.map((price, index) => {
                const maxPrice = Math.max(...priceHistory);
                const minPrice = Math.min(...priceHistory);
                const height =
                  ((price - minPrice) / (maxPrice - minPrice)) * 140 + 20;

                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center group"
                  >
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 hover:scale-105 ${
                        index === priceHistory.length - 1
                          ? "bg-gradient-to-t from-orange-600 to-orange-400 shadow-lg shadow-orange-500/30 animate-pulse"
                          : "bg-gradient-to-t from-gray-600 to-gray-400 hover:from-orange-500 hover:to-orange-400"
                      }`}
                      style={{
                        height: `${height}px`,
                        animationDelay: `${index * 100}ms`,
                      }}
                    />
                    <span
                      className={`text-xs mt-2 font-semibold ${
                        index === priceHistory.length - 1
                          ? "text-orange-400"
                          : "text-gray-300"
                      } group-hover:text-orange-400 transition-colors duration-300`}
                    >
                      ₹{price.toLocaleString("en-IN")}
                    </span>

                    <span className="text-[10px] text-gray-500 group-hover:text-orange-300 transition-colors duration-300">
                      Day {index + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className={`${
            isPageTransitioning && currentPage === "analysis"
              ? "animate-slide-left"
              : ""
          }`}
        >
          <h3 className="text-xl font-semibold text-gray-100 mb-6">
            Recent Alert History
          </h3>
          <div className="space-y-4">
            {[].map((alert, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-6 bg-gray-700/30 rounded-2xl border border-gray-600/30 hover:bg-gray-700/50 transition-all duration-300 hover:scale-[1.02] hover:border-orange-500/30 group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/30"></div>
                  <div>
                    <p className="font-semibold text-gray-100 group-hover:text-orange-300 transition-colors duration-300">
                      {alert.strategy}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {alert.date} at {alert.time}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-100 text-lg">
                    {formatPrice(alert.price)}
                  </p>
                  <span className="text-xs text-green-300 bg-green-900/50 px-3 py-1 rounded-full border border-green-500/30 backdrop-blur-sm">
                    Alert Sent
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-left {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slide-right {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes bounce-gentle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.8s ease-out;
        }
        .animate-slide-left {
          animation: slide-left 0.8s ease-out;
        }
        .animate-slide-right {
          animation: slide-right 0.8s ease-out;
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 2s ease-in-out infinite;
        }
        .animate-fade-in-delay {
          animation: fade-in 0.6s ease-out 0.2s both;
        }
        .animate-slide-up-delay {
          animation: slide-up 0.8s ease-out 0.3s both;
        }
      `}</style>

      <header className="bg-gray-900/95 backdrop-blur-sm shadow-xl border-b border-gray-700/50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 animate-slide-left">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/25 animate-pulse">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                BTC Smart Alert
              </h1>
            </div>

            <div className="flex items-center space-x-6 animate-slide-right">
              <div className="text-right bg-gray-800/50 p-4 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                <p className="text-sm text-gray-400">Live BTC Price</p>
                <p className="text-xl font-bold text-orange-400">
                  {btcPriceUSD}$
                </p>
                <p className="text-xl font-bold text-orange-400">
                  {formatPrice(btcPrice)}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-800/50 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-gray-700/50 hover:border-orange-500/50 transition-all duration-300 hover:scale-110 cursor-pointer">
                <Settings className="w-6 h-6 text-gray-300 hover:text-orange-400 transition-colors duration-300" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-gray-900/90 backdrop-blur-sm border-b border-gray-700/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-8">
            {[
              { id: "dashboard", label: "Dashboard", icon: TrendingUp },
              { id: "alerts", label: "Set Alerts", icon: Bell },
              { id: "analysis", label: "Analysis", icon: BarChart3 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handlePageChange(id)}
                className={`flex items-center space-x-3 py-6 px-4 border-b-3 transition-all duration-300 hover:scale-105 ${
                  currentPage === id
                    ? "border-orange-500 text-orange-400 bg-orange-500/10"
                    : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {currentPage === "dashboard" && <Dashboard />}
        {currentPage === "alerts" && <AlertsPage />}
        {currentPage === "analysis" && <AnalysisPage />}
      </main>
    </div>
  );
};

export default BitcoinAlertApp;
