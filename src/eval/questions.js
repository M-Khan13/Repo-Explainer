export const EVAL_SET = [
  { q: "what fields does the order schema have", files: ["server/models/Order.js"] },
  { q: "how does user authentication work", files: ["server/middleware/auth.js", "server/routes/auth.js"] },
  { q: "how are JWT tokens generated", files: ["server/utils/token.js"] },
  { q: "how does the AI task generation work", files: ["server/utils/ai.js"] },
  { q: "what does the menu item model look like", files: ["server/models/MenuItem.js"] },
  { q: "how does role based access control work", files: ["server/middleware/auth.js"] },
  { q: "how does the login page submit credentials", files: ["client/src/pages/Login.jsx"] },
  { q: "how does real time order updates work", files: ["client/src/lib/socket.js", "server/server.js"] },
  { q: "how are tasks assigned to staff", files: ["server/routes/tasks.js"] },
  { q: "what does the protected route component do", files: ["client/src/components/ProtectedRoute.jsx"] },
];