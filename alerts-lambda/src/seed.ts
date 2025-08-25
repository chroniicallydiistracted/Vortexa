import { handler } from "./index";

(async () => {
  const res = await handler({ seed: true });
  console.log("Seed result:", res);
})();
