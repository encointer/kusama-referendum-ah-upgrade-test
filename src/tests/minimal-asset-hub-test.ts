import { setupNetworks } from "@acala-network/chopsticks-testing";
import assert from 'assert'

async function main() {
  const { assetHub } = await setupNetworks({
    assetHub: {
      endpoint: 'wss://asset-hub-kusama-rpc.n.dwellir.com',
      "build-block-mode": "Manual",
      "log-level": 4,
      runtimeLogLevel: 4,
    },
  });
  assert(assetHub, 'asset hub network setup failed')


  console.log("✅ Connected to assetHub.");

  console.log("⏳ Building new block...");
  await assetHub.dev.newBlock();

  console.log("✅ Successfully built one block.");

  await assetHub.teardown();
}

main().catch((err) => {
  console.error("❌ Error in main:", err);
  process.exit(1);
});
