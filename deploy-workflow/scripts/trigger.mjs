// CLI trigger — runs the deploy workflow and streams status
const BASE = process.env.DEPLOY_WORKFLOW_URL ?? "http://localhost:3000";

const res = await fetch(`${BASE}/api/deploy`, { method: "POST" });
const { runId } = await res.json();
console.log(`Deploy started — runId: ${runId}`);

// Poll until done
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const poll = await fetch(`${BASE}/api/deploy/${runId}`);
  const data = await poll.json();
  if (data.done) {
    console.log("Deploy complete:", data.result);
    process.exit(0);
  }
  process.stdout.write(".");
}
console.error("\nTimed out waiting for deploy");
process.exit(1);
