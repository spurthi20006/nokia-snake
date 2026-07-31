/* Thin wrapper around fetch() for the Flask REST API. */
const Api = (() => {
  async function request(method, path, body) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    let res, data;
    try {
      res = await fetch(path, opts);
      data = await res.json();
    } catch (err) {
      return { success: false, error: "Network error. Is the server running?", status: 0 };
    }
    return { ...data, status: res.status };
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),

    register: (username, email, password) => request("POST", "/api/register", { username, email, password }),
    login: (username, password) => request("POST", "/api/login", { username, password }),
    logout: () => request("POST", "/api/logout"),
    me: () => request("GET", "/api/me"),

    saveScore: (payload) => request("POST", "/api/save-score", payload),
    highScore: () => request("GET", "/api/high-score"),
    statistics: () => request("GET", "/api/statistics"),

    leaderboard: (period) => request("GET", `/api/leaderboard?period=${encodeURIComponent(period)}`),

    unlockAchievement: (key) => request("POST", "/api/unlock-achievement", { key }),
    achievements: () => request("GET", "/api/achievements"),

    getSettings: () => request("GET", "/api/settings"),
    updateSettings: (updates) => request("PUT", "/api/settings", updates),

    dailyChallenge: () => request("GET", "/api/daily-challenge"),
    completeDailyChallenge: () => request("POST", "/api/daily-challenge/complete"),
  };
})();
