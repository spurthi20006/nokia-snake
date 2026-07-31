/* Tracks the logged-in user on the client and wraps register/login/logout. */
const Auth = (() => {
  let currentUser = null;

  async function refresh() {
    const res = await Api.me();
    currentUser = res.success ? res.user : null;
    return currentUser;
  }

  async function register(username, email, password) {
    const res = await Api.register(username, email, password);
    if (res.success) currentUser = res.user;
    return res;
  }

  async function login(username, password) {
    const res = await Api.login(username, password);
    if (res.success) currentUser = res.user;
    return res;
  }

  async function logout() {
    await Api.logout();
    currentUser = null;
  }

  return {
    refresh,
    register,
    login,
    logout,
    isLoggedIn: () => !!currentUser,
    getUser: () => currentUser,
  };
})();
