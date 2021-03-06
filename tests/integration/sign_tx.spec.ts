import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { expect } from 'chai';
import { cryptography, transactions } from '@liskhq/lisk-client';
import { LiskLedger, LedgerAccount } from '../../src/';
import TransportU2F from '@ledgerhq/hw-transport-u2f';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { isBrowser } from 'browser-or-node';
import { ITransport } from '../../src/ledger';
import {
  TransferAssetSchema,
  MultisignatureRegistrationSchema,
  DPOSRegisterDelegateSchema,
  DPOSVoteDelegateSchema,
  DPOSUnlockTokenSchema,
  LegacyAccountReclaimSchema } from '../LiskSchemas';

chai.use(chaiAsPromised);

describe('signTX API', function () {
  this.timeout(150222200);
  let dl: LiskLedger;
  let account: LedgerAccount;
  let pubKey: string;
  let address: string;
  let lisk32: string;
  let transport: ITransport;
  const networkIdentifier = Buffer.from('4c09e6a781fc4c7bdb936ee815de8f94190f8a7519becd9de2081832be309a99', 'hex');

  before(async () => {
    transport = await (isBrowser ? TransportU2F.create() : TransportNodeHid.create());
    dl        = new LiskLedger(transport);
  });
  after(() => {
    transport.close();
  });

  beforeEach(async () => {
    account   = new LedgerAccount()
      .account(1);
    const res = await dl.getPubKey(account);
    expect(res.publicKey).to.match(/^[a-z0-9]{64}$/);
    pubKey  = res.publicKey;
    address = res.address;
    lisk32 = res.lisk32;
  });

  /**
   * Sign TX
   */

  async function signAndVerify(txBytes: Buffer, acc: LedgerAccount = account) {
    const signature = await dl.signTX(acc, txBytes);
    const verified = cryptography.verifyData(txBytes, signature, Buffer.from(pubKey, 'hex'));
    expect(verified).is.true;
  }


  it('test 2:0 transfer',  async () => {

    const signingBytes = transactions.getSigningBytes(TransferAssetSchema.schema, {
      moduleID: 2,
      assetID: 0,
      nonce: BigInt(3),
      fee: BigInt(100000),
      senderPublicKey: Buffer.from(pubKey, "hex"),
      asset: {
        amount: BigInt(100000000),
        recipientAddress: Buffer.from(address, "hex"),
        data: '',
      },
    });

    const txBytes = Buffer.concat([ networkIdentifier, signingBytes ]);
    await signAndVerify(txBytes);
  });

  it('should fail if tx is too big > 448 bytes', async () => {
    const signingBytes = transactions.getSigningBytes(MultisignatureRegistrationSchema.schema, {
      moduleID: 4,
      assetID: 0,
      nonce: BigInt(3),
      fee: BigInt(100000),
      senderPublicKey: Buffer.from(pubKey, "hex"),
      asset: {
        numberOfSignatures: 11,
        mandatoryKeys: [
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
        ],
        optionalKeys: [
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex")
        ]
      },
    });
    const txBytes = Buffer.concat([ networkIdentifier, signingBytes ]);

    expect(txBytes.length).gt(448);

    await expect(dl.signTX(account, txBytes)).rejectedWith('Payload too big for Lisk Ledger implementation');
  })
  it('test 4:0 register multisignature',  async () => {

    const signingBytes = transactions.getSigningBytes(MultisignatureRegistrationSchema.schema, {
      moduleID: 4,
      assetID: 0,
      nonce: BigInt(3),
      fee: BigInt(100000),
      senderPublicKey: Buffer.from(pubKey, "hex"),
      asset: {
        numberOfSignatures: 9,
        mandatoryKeys: [
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex")
        ],
        optionalKeys: [
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex"),
          Buffer.from(pubKey, "hex")
        ]
      },
    });

    const txBytes = Buffer.concat([ networkIdentifier, signingBytes ]);
    await signAndVerify(txBytes);
  });

  it('test 5:0 register delegate',  async () => {

    const signingBytes = transactions.getSigningBytes(DPOSRegisterDelegateSchema.schema, {
      moduleID: 5,
      assetID: 0,
      nonce: BigInt(3),
      fee: BigInt(100000),
      senderPublicKey: Buffer.from(pubKey, "hex"),
      asset: {
        username: 'hirish_delegate',
      },
    });

    const txBytes = Buffer.concat([ networkIdentifier, signingBytes ]);
    await signAndVerify(txBytes);
  });

  it('test 5:1 vote delegate',  async () => {

    const signingBytes = transactions.getSigningBytes(DPOSVoteDelegateSchema.schema, {
      moduleID: 5,
      assetID: 1,
      nonce: BigInt(3),
      fee: BigInt(100000),
      senderPublicKey: Buffer.from(pubKey, "hex"),
      asset: {
        votes: [
          {
            delegateAddress: Buffer.from(address, "hex"),
            amount: BigInt(100000000)
          },
          {
            delegateAddress: Buffer.from(address, "hex"),
            amount: BigInt(100000000)
          },
          {
            delegateAddress: Buffer.from(address, "hex"),
            amount: BigInt(100000000)
          },
          {
            delegateAddress: Buffer.from(address, "hex"),
            amount: BigInt(-100000000)
          },
          {
            delegateAddress: Buffer.from(address, "hex"),
            amount: BigInt(-100000000)
          }
        ],
      },
    });

    const txBytes = Buffer.concat([ networkIdentifier, signingBytes ]);
    await signAndVerify(txBytes);
  });

  it('test 5:2 unlock tokens',  async () => {

    const signingBytes = transactions.getSigningBytes(DPOSUnlockTokenSchema.schema, {
      moduleID: 5,
      assetID: 2,
      nonce: BigInt(3),
      fee: BigInt(100000),
      senderPublicKey: Buffer.from(pubKey, "hex"),
      asset: {
        unlockObjects: [
          {
            delegateAddress: Buffer.from(address, "hex"),
            amount: BigInt(100000000),
            unvoteHeight: 123456789
          },
          {
            delegateAddress: Buffer.from(address, "hex"),
            amount: BigInt(200000000),
            unvoteHeight: 123456789
          },
          {
            delegateAddress: Buffer.from(address, "hex"),
            amount: BigInt(300000000),
            unvoteHeight: 123456789
          },
        ],
      },
    });

    const txBytes = Buffer.concat([ networkIdentifier, signingBytes ]);
    await signAndVerify(txBytes);
  });

  it('test 1000:0 reclaim LSK',  async () => {

    const signingBytes = transactions.getSigningBytes(LegacyAccountReclaimSchema.schema, {
      moduleID: 1000,
      assetID: 0,
      nonce: BigInt(3),
      fee: BigInt(100000),
      senderPublicKey: Buffer.from(pubKey, "hex"),
      asset: {
        amount: BigInt(100000000),
      },
    });

    const txBytes = Buffer.concat([ networkIdentifier, signingBytes ]);
    await signAndVerify(txBytes);
  });

});
