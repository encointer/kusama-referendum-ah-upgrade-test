import { setupNetworks } from "@acala-network/chopsticks-testing";
import assert from 'assert'

async function main() {
  const { kusama } = await setupNetworks({
    kusama: {
      endpoint: 'wss://kusama-rpc.n.dwellir.com',
      "build-block-mode": "Manual",
      "log-level": 4,
      runtimeLogLevel: 4,
      timeout: 120000
    },
  });
  assert(kusama, 'relay network setup failed')


  console.log("✅ Connected to Kusama relaychain.");

  console.log("⏳ Building new block...");
  await kusama.dev.newBlock();

  console.log("✅ Successfully built one block.");

  await kusama.teardown();
}

main().catch((err) => {
  console.error("❌ Error in main:", err);
  process.exit(1);
});
