import { setupNetworks } from "@acala-network/chopsticks-testing";
import assert from 'assert'

async function main() {
  const { encointer } = await setupNetworks({
    encointer: {
      endpoint: 'wss://encointer-kusama-rpc.n.dwellir.com',
      "build-block-mode": "Manual",
      "log-level": 4,
      runtimeLogLevel: 4,
    },
  });
  assert(encointer, 'encointer network setup failed')


  console.log("✅ Connected to encointer.");

  console.log("⏳ Building new block...");
  await encointer.dev.newBlock();

  console.log("✅ Successfully built one block.");

  await encointer.teardown();
}

main().catch((err) => {
  console.error("❌ Error in main:", err);
  process.exit(1);
});
