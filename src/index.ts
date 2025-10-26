#!/usr/bin/env ts-node

import { kusama_asset_hub, kusama_relay } from '@polkadot-api/descriptors'
import { getPolkadotSigner } from 'polkadot-api/signer'
import { compactAddLength } from '@polkadot/util'
import { Binary, AccountId, HexString } from '@polkadot-api/substrate-bindings'
import { createClient } from 'polkadot-api'
import { getWsProvider } from "polkadot-api/ws-provider"
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat'
import { setupNetworks } from '@acala-network/chopsticks-testing'
import assert from 'assert'
import { Command } from 'commander'
import { readFileSync } from 'fs'

export const KSM = (x: number) => BigInt(x) * BigInt(1e10)

export function stringifyWithBigInt(x: unknown): string {
  return JSON.stringify(x, (_k, v) =>
    typeof v === 'bigint' ? { __type: 'bigint', value: v.toString() } : v
  )
}

const fakeSignature = new Uint8Array(64)
fakeSignature.fill(0xcd)
fakeSignature.set([0xde, 0xad, 0xbe, 0xef])
const getFakeSignature = () => fakeSignature
const fakeSigner = (from: HexString) =>
  getPolkadotSigner(AccountId().enc(from), 'Sr25519', getFakeSignature)

const program = new Command()

program
  .name('kusama-referenda-upgrade')
  .description('Execute Kusama referenda upgrade on Asset Hub')
  .version('1.0.0')
  .requiredOption('--call-to-create-fellowship-referendum <hex>', 'Fellowship referendum submit call data (hex)')
  .requiredOption('--call-to-create-asset-hub-referendum <hex>', 'Asset Hub referendum submit call data (hex)')
  .requiredOption('--call-to-note-preimage-for-asset-hub-referendum <hex>', 'Asset Hub note preimage call data (hex)')
  .requiredOption('--expected-code-hash <hash>', 'Expected code hash for authorized upgrade (hex)')
  .requiredOption('--signer-for-fellowship-referendum <address>', 'Signer address for fellowship referendum')
  .requiredOption('--signer-for-asset-hub-referendum <address>', 'Signer address for asset hub referendum and preimage')
  .requiredOption('--wasm <file>', 'Path to WASM file to execute apply_authorized_upgrade')
  .parse()

const options = program.opts()

interface CliOptions {
  callToCreateFellowshipReferendum: string
  callToCreateAssetHubReferendum: string
  callToNotePreimageForAssetHubReferendum: string
  expectedCodeHash: string
  signerForFellowshipReferendum: string
  signerForAssetHubReferendum: string
  wasm: string
}

async function main(cliOptions: CliOptions) {
  console.log('Setting up Kusama and AssetHub networks...')
  const { kusama, assetHub } = await setupNetworks({
    kusama: {
      endpoint: 'wss://kusama-rpc.n.dwellir.com',
      port: 8000,
      'mock-signature-host': true,
      'build-block-mode': 'Instant',
      runtimeLogLevel: 0,
      'log-level': 0
    },
    assetHub: {
      endpoint: 'wss://asset-hub-kusama-rpc.n.dwellir.com',
      port: 8001,
      'mock-signature-host': true,
      'build-block-mode': 'Instant',
      runtimeLogLevel: 0,
      'log-level': 0
    },
  })

  console.log(`Asserting Kusama network setup: ${kusama ? 'SUCCESS' : 'FAILED'}`)
  assert(kusama, 'Kusama network setup failed')
  console.log(`Asserting AssetHub network setup: ${assetHub ? 'SUCCESS' : 'FAILED'}`)
  assert(assetHub, 'AssetHub network setup failed')
  console.log('Both networks initialized successfully')

  const kusamaRelayClient = createClient(
    withPolkadotSdkCompat(getWsProvider('ws://localhost:8000'))
  )
  const kusamaRelayApi = kusamaRelayClient.getTypedApi(kusama_relay)

  const kusamaAssetHubClient = createClient(
    withPolkadotSdkCompat(getWsProvider('ws://localhost:8001'))
  )
  const kusamaAssetHubApi = kusamaAssetHubClient.getTypedApi(kusama_asset_hub)

  const fellowshipRefSubmitCall = await kusamaRelayApi.txFromCallData(
    Binary.fromHex(cliOptions.callToCreateFellowshipReferendum)
  )

  const assetHubRefSubmitCall = await kusamaAssetHubApi.txFromCallData(
    Binary.fromHex(cliOptions.callToCreateAssetHubReferendum)
  )

  const assetHubNotePreimageCall = await kusamaAssetHubApi.txFromCallData(
    Binary.fromHex(cliOptions.callToNotePreimageForAssetHubReferendum)
  )

  console.log(`Fellowship referendum signer: ${cliOptions.signerForFellowshipReferendum}`)
  const fellowshipSigner = fakeSigner(cliOptions.signerForFellowshipReferendum)
  console.log(`Asset Hub referendum signer: ${cliOptions.signerForAssetHubReferendum}`)
  const assetHubSigner = fakeSigner(cliOptions.signerForAssetHubReferendum)

  console.log('Submitting fellowship referendum...')
  let fellowshipRefSubmitResult = await fellowshipRefSubmitCall.signAndSubmit(fellowshipSigner)
  console.log(`Asserting fellowship referendum submission result: ${fellowshipRefSubmitResult.ok ? 'SUCCESS' : 'FAILED'}`)
  assert(fellowshipRefSubmitResult.ok)

  console.log('Pulling FellowshipReferenda.Submitted events...')
  let fellowshipRefEvents = await kusamaRelayApi.event.FellowshipReferenda.Submitted.pull()
  console.log(`Asserting exactly 1 fellowship referendum event received: ${fellowshipRefEvents.length} events found`)
  assert(fellowshipRefEvents.length == 1)
  const fellowshipRefEvent = fellowshipRefEvents[0]
  console.log(`Asserting fellowship referendum event exists: ${fellowshipRefEvent ? 'SUCCESS' : 'FAILED'}`)
  assert(fellowshipRefEvent, 'No fellowship referendum event found')
  const fellowshipReferendumIndex = fellowshipRefEvent.payload.index
  console.log(`Fellowship referendum index: ${fellowshipReferendumIndex}`)

  console.log('Submitting public referendum on AssetHub...')
  let publicRefSubmitResult = await assetHubRefSubmitCall.signAndSubmit(assetHubSigner)
  console.log(`Asserting public referendum submission result: ${publicRefSubmitResult.ok ? 'SUCCESS' : 'FAILED'}`)
  assert(publicRefSubmitResult.ok)

  console.log('Pulling Referenda.Submitted events...')
  let publicRefEvents = await kusamaAssetHubApi.event.Referenda.Submitted.pull()
  console.log(`Asserting exactly 1 public referendum event received: ${publicRefEvents.length} events found`)
  assert(publicRefEvents.length == 1)
  const publicRefEvent = publicRefEvents[0]
  console.log(`Asserting public referendum event exists: ${publicRefEvent ? 'SUCCESS' : 'FAILED'}`)
  assert(publicRefEvent, 'No public referendum event found')
  const publicReferendumIndex = publicRefEvent.payload.index
  console.log(`Public referendum index: ${publicReferendumIndex}`)

  console.log('Submitting preimage note on AssetHub...')
  let assetHubPreimageNoteResult = await assetHubNotePreimageCall.signAndSubmit(assetHubSigner)
  console.log(`Asserting preimage note submission result: ${assetHubPreimageNoteResult.ok ? 'SUCCESS' : 'FAILED'}`)
  assert(assetHubPreimageNoteResult.ok)
  console.log('Pulling Preimage.Noted events...')
  let premiageEvents = await kusamaAssetHubApi.event.Preimage.Noted.pull()
  console.log(`Asserting exactly 1 preimage event received: ${premiageEvents.length} events found`)
  assert(premiageEvents.length == 1)
  console.log('Preimage noted successfully')

  await assetHub.dev.newBlock()

  // lets assume Fellowship referenda passed
  console.log(`Querying fellowship referendum state for index ${fellowshipReferendumIndex}...`)
  let fellowRef =
    await kusamaRelayApi.query.FellowshipReferenda.ReferendumInfoFor.getValue(
      fellowshipReferendumIndex
    )
  console.log(`Fellowship referendum type: ${fellowRef?.type || 'undefined'}`)
  console.log(`Asserting fellowship referendum is 'Ongoing': ${fellowRef?.type === 'Ongoing' ? 'SUCCESS' : 'FAILED'}`)
  assert(fellowRef?.type === 'Ongoing')
  console.log(`Fellowship referendum proposal type: ${fellowRef.value.proposal.type}`)
  console.log(`Asserting proposal is 'Inline': ${fellowRef.value.proposal.type === 'Inline' ? 'SUCCESS' : 'FAILED'}`)
  assert(fellowRef.value.proposal.type === 'Inline')
  await kusama.dev.setStorage({
    Scheduler: {
      agenda: [
        [
          [(await kusamaRelayClient.getBlockHeader()).number + 1],
          [
            {
              call: {
                Inline: fellowRef.value.proposal.value.asHex(),
              },
              origin: {
                Origins: 'Fellows',
              },
            },
          ],
        ],
      ],
    },
  })
  console.log('Setting fellowship referendum to pass via scheduler...')
  await kusama.dev.newBlock()
  console.log('Fellowship referendum scheduled and executed')

  // lets assume public referenda also passed
  console.log(`Querying public referendum state for index ${publicReferendumIndex}...`)
  let publicRef =
    await kusamaAssetHubApi.query.Referenda.ReferendumInfoFor.getValue(publicReferendumIndex)
  console.log(`Public referendum type: ${publicRef?.type || 'undefined'}`)
  console.log(`Asserting public referendum is 'Ongoing': ${publicRef?.type === 'Ongoing' ? 'SUCCESS' : 'FAILED'}`)
  assert(publicRef?.type === 'Ongoing')
  console.log(`Public referendum proposal type: ${publicRef.value.proposal.type}`)
  console.log(`Asserting proposal is 'Lookup': ${publicRef.value.proposal.type === 'Lookup' ? 'SUCCESS' : 'FAILED'}`)
  assert(publicRef.value.proposal.type === 'Lookup')
  await assetHub.dev.setStorage({
    Scheduler: {
      agenda: [
        [
          [
            (await kusamaAssetHubApi.query.ParachainSystem.LastRelayChainBlockNumber.getValue()) +
              1,
          ],
          [
            {
              call: {
                Lookup: {
                  hash: publicRef.value.proposal.value.hash.asHex(),
                  len: publicRef.value.proposal.value.len,
                },
              },
              origin: {
                Origins: 'WhitelistedCaller',
              },
            },
          ],
        ],
      ],
    },
  })
  console.log('Setting public referendum to pass via scheduler...')
  await assetHub.dev.newBlock()
  console.log('Public referendum scheduled and executed')

  console.log('Querying System.AuthorizedUpgrade on AssetHub...')
  const authorizedUpgradeOnAh = await kusamaAssetHubApi.query.System.AuthorizedUpgrade.getValue()
  const actualCodeHash = authorizedUpgradeOnAh?.code_hash.asHex()
  console.log(`Authorized upgrade code hash: ${actualCodeHash}`)
  console.log(`Expected code hash: ${cliOptions.expectedCodeHash}`)
  console.log(`Asserting code hash matches expected: ${actualCodeHash === cliOptions.expectedCodeHash ? 'SUCCESS' : 'FAILED'}`)
  assert(
    authorizedUpgradeOnAh?.code_hash.asHex() == cliOptions.expectedCodeHash,
    `Expected code hash ${cliOptions.expectedCodeHash} but got ${authorizedUpgradeOnAh?.code_hash.asHex()}`
  )
  console.log('Code hash validation successful')

  console.log(`Executing apply_authorized_upgrade with WASM file: ${cliOptions.wasm}`)

  const wasmCode = readFileSync(cliOptions.wasm)
  console.log(`WASM file size: ${wasmCode.length} bytes`)

  const applyAuthorizedUpgradeCall = assetHub.api.tx.system.applyAuthorizedUpgrade(
    compactAddLength(wasmCode)
  )

  console.log('Submitting apply_authorized_upgrade as unsigned extrinsic...')

  await assetHub.api.rpc.author.submitExtrinsic(applyAuthorizedUpgradeCall.toHex())

  console.log('apply_authorized_upgrade submitted successfully')

  await assetHub.dev.newBlock()

  console.log('New block created after upgrade')

  // assetHub.pause()
  // await kusama.pause()

  console.log('Destroying polkadot-api clients...')
  kusamaRelayClient.destroy()
  kusamaAssetHubClient.destroy()

  await assetHub.teardown()
  await kusama.teardown()

  console.log('Cleanup complete, exiting...')
}

main(options as CliOptions)
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('error in main:', err)
    process.exit(1)
  })
