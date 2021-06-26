import * as sodium from 'libsodium-wrappers';
import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { expect } from 'chai';
import { cryptography, transactions } from '@liskhq/lisk-client';
import { DposLedger, LedgerAccount } from '../../src/';
import TransportU2F from '@ledgerhq/hw-transport-u2f';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { isBrowser } from 'browser-or-node';
import { ITransport } from '../../src/ledger';
import { encode as encodeVarInt } from 'varuint-bitcoin';
import { sha256 } from 'js-sha256';
import { TransferAssetSchema } from '../LiskSchemas';

chai.use(chaiAsPromised);

function verifySignedMessage(prefix: string, message: string | Buffer, signature: Buffer, pubKey: string): boolean {
  const prefixBuf = Buffer.from(prefix, 'utf8');
  const msgBuf    = Buffer.isBuffer(message) ? message : Buffer.from(message, 'utf8');
  const buf       = Buffer.concat([
    encodeVarInt(prefixBuf.length),
    prefixBuf,
    encodeVarInt(msgBuf.length),
    msgBuf,
  ]);

  const firstSha        = Buffer.from(sha256(buf), 'hex');
  const signablePayload = Buffer.from(sha256(firstSha), 'hex');

  return cryptography.verifyData(signablePayload, signature, Buffer.from(pubKey, 'hex'))
}

describe('Integration tests', function () {
  this.timeout(150222200);
  let dl: DposLedger;
  let account: LedgerAccount;
  let pubKey: string;
  let address: string;
  let lisk32: string;
  let transport: ITransport;
  const msgPrefix = cryptography.constants.SIGNED_MESSAGE_PREFIX;
  const networkIdentifier = cryptography.getNetworkIdentifier(
    cryptography.hexToBuffer("23ce0366ef0a14a91e5fd4b1591fc880ffbef9d988ff8bebf8f3666b0c09597d"),
    "Lisk",
  );

  before(async () => {
    transport = await (isBrowser ? TransportU2F.create() : TransportNodeHid.create());
    dl        = new DposLedger(transport);
  });
  after(() => {
    transport.close();
  });

  beforeEach(async () => {
    account   = new LedgerAccount();
    const res = await dl.getPubKey(account);
    expect(res.publicKey).to.match(/^[a-z0-9]{64}$/);
    pubKey  = res.publicKey;
    address = res.address;
    lisk32 = res.lisk32;
  });

  /**
   * VERSION AND PING
   */ 

  it('version() should return version', async () => {
    expect(await dl.version()).to.be.deep.eq({
      version: '1.4.3',
      coinID : 'lisk'
    });
  });

  describe('ping', () => {
    it('should ping', async () => {
      await dl.ping();
    });
  });

  /**
   * Errors
   */ 

   describe('comm_errors', () => {

    it('should fail if we start comm without having started', async () => {
      // first command 9bytes + 1bytes
      return expect(transport.send(0xe0, 90, 0, 0, Buffer.alloc(9)))
        .to.be.rejectedWith('Ledger device: CODE_NOT_INITIALIZED (0x9802)');
      // NOTE: this expects that there are no pending open comm from other tests.
      // If this fails suddenly, then it probably means that c implementation has a BUG

    });

    it('should fail if we close comm without having sent anything', async () => {
      return expect(transport.send(0xe0, 91, 0, 0))
        .to.be.rejectedWith('Ledger device: CODE_NOT_INITIALIZED (0x9802)');
    });

    /*
    it('should fail if we try to sign an unknown tx', async () => {
      const tx = new SendTx()
        .set('amount', 0)
        .set('timestamp', 10)
        .set('fee', 100)
        .set('recipientId', '123456781230L')
        .set('senderPublicKey', pubKey);

      tx.type = 11; // unknwon type.

      return expect(dl.signTX(account, tx.getBytes()))
        .to.be.rejectedWith('Ledger device: Invalid data received (0x6a80)'); // INCORRECT_DATA
    });
    */

    it('should throw if unknown command', () => {
      return expect(dl.exchange(0x11))
        .to.be.rejectedWith('Ledger device: UNKNOWN_ERROR (0x6a81)'); // INCORRECT_DATA
    });
  });

  /**
   * Get PubKey
   */ 

  describe('getPubKey', () => {
    it('should return always the same pubKey for same path', async () => {
      const target = await dl.getPubKey(account);
      console.info('res', target);
      expect(target.publicKey).to.be.eq(pubKey);
    });
    it('should change if account index is changed', async () => {
      const target = await dl.getPubKey(account.account(2));
      expect(target.publicKey).to.be.not.eq(pubKey)
    });

    it('should treat every value as different', async () => {
      // reset;
      account.account(0);
      const zero = await dl.getPubKey(account);
      account.account(1);
      const acc = await dl.getPubKey(account);
      expect(zero.publicKey).to.not.be.equal(acc.publicKey);
    });

    it('returned publicKeys should match returned addresses', async () => {
      for (let acc = 0; acc < 3; acc++) {
        for (let index = 0; index < 3; index++) {
          const { publicKey, lisk32 } = await dl.getPubKey(account.account(acc + 200)
          );
          expect(publicKey.length).to.be.eq(64);
          expect(cryptography.getBase32AddressFromPublicKey(Buffer.from(publicKey, 'hex'))).to.be.eq(lisk32);
        }
      }
    });

    it('should prompt address on ledger screen', async () => {
      const res = await dl.getPubKey(account, true);
      expect(res.address).to.be.eq(address);
      expect(res.lisk32).to.be.eq(lisk32);
    });
  });

  /**
   * Sign MSG
   */ 

  describe('Messages', () => {
    it('it should generate valid signature', async () => {
      const msg       = 'testMessage';
      const signature = await dl.signMSG(account, msg);
      console.info('signature', signature);
      const res = verifySignedMessage(msgPrefix, msg, signature, pubKey);
      expect(res).is.true;
    });
    it('should show <binary data> if not printable', async () => {
      const msg       = Buffer.concat([
        Buffer.from(new Array(32).fill(1)),
      ]);
      const signature = await dl.signMSG(account, msg);
      const res       = verifySignedMessage(msgPrefix, msg, signature, pubKey);
      expect(res).is.true;
    });
    it('should rewrite msg to binary data if more than 40% of data is non printable', async () => {
      const msg       = Buffer.concat([
        Buffer.from('abcde', 'utf8'), // 6 bytes
        Buffer.from('00000000', 'hex'), // 4 bytes
      ]);
      const signature = await dl.signMSG(account, msg);
      const res       = verifySignedMessage(msgPrefix, msg, signature, pubKey);
      expect(res).is.true;
    });
    it('should rewrite msg to binary data if all text but first byte unprintable', async () => {
      const msg       = Buffer.concat([
        Buffer.from('00', 'hex'), // 4 bytes,
        Buffer.from('abcde', 'utf8'), // 6 bytes
      ]);
      const signature = await dl.signMSG(account, msg);
      const res       = verifySignedMessage(msgPrefix, msg, signature, pubKey);
      expect(res).is.true;
    });
    it('should gen valid signature for short message with newline', async () => {
      const msg       = 'hey\nhi';
      const signature = await dl.signMSG(account, msg);
      const res       = verifySignedMessage(msgPrefix, msg, signature, pubKey);
      expect(res).is.true;
    });
    it('should gen valid signature for 1000-prefix-4 message', async () => {
      const msg       = `${new Array(1000 - msgPrefix.length - 4).fill(null)
        .map(() => String.fromCharCode('a'.charCodeAt(0) + Math.ceil(Math.random() * 21)))
        .join('')}`;
      const signature = await dl.signMSG(account, msg);
      const res       = verifySignedMessage(msgPrefix, msg, signature, pubKey);
      expect(res).is.true;
    });
  });

  /**
   * Sign TX
   */ 

  /*
   describe('transactions', () => {

    async function signAndVerify(txBytes: Buffer, acc: LedgerAccount = account) {
      const signature = await dl.signTX(acc, txBytes);
      const txHash = cryptography.hash(txBytes);
      const verified  = sodium.crypto_sign_verify_detached(signature, txHash, Buffer.from(pubKey, 'hex'));
      expect(verified).is.true;
    }

    describe('test',  async () => {
      const signingBytes = transactions.getSigningBytes(TransferAssetSchema.schema, {
        moduleID: 2,
        assetID: 0,
        nonce: BigInt(3),
        fee: BigInt(10000000),
        senderPublicKey: Buffer.from('lsks96vwgy7yjaspoy2c2dnrujeebfhe63f7x3pov'),
        asset: {
            amount: BigInt(10000000),
            recipientAddress: Buffer.from('lsks96vwgy7yjaspoy2c2dnrujeebfhe63f7x3pov'),
            data: '',
        },
      });
    
      const txBytes = Buffer.concat([ networkIdentifier, signingBytes ]);
      await signAndVerify(txBytes);
    });
   });
*/

  /*
  describe('transactions', () => {
    async function signAndVerify(tx: BaseTx<any>, acc: LedgerAccount = account) {
      const signature = await dl.signTX(acc, tx.getBytes());
      const verified  = sodium.crypto_sign_verify_detached(signature, tx.getHash(), Buffer.from(pubKey, 'hex'));
      expect(verified).is.true;
    };
    describe('votes', () => {
      it('vote with 25 added and 8 removed.', async () => {
        const tx = new VoteTx({
          votes: [
            '+76c321881c08b0c2f538abf753044603ab3081f5441fe069c125a6e2803015da',
            '+186ffbe710bc27690934ef6cd64aeda2afdd634cbbaf6d23310ca7a31ab96e60',
            '+e36f75a27598512c2f4ad06fffeeffa37d3aad81c3a4edb77d871ec0ee933471',
            '+e7ac617b33d0f019d9d030c2e34870767d8994680e7b10ebdaf2af0e59332524',
            '+a40c3e1549a9bbea71606ef05b793629923bdb151390145e3730dfe2b28b9217',
            '+9172179a88f8cfeeb81518ad31da4397555273b8658eb3ea2d1eca7965d8e615',
            '+ca1285393e1848ee41ba0c5e47789e5e0c570a7b51d8e2f7f6db37417b892cf9',
            '+6cb825715058d2e821aa4af75fbd0da52181910d9fda90fabe73cd533eeb6acb',
            '+2fc8f8048d2573529b7f37037a49724202a28a0fbee8741702bb4d96c09fcbbf',
            '+5386c93dbc76fce1e3a5ae5436ba98bb39e6a0929d038ee2118af54afd45614a',
            '+aad413159fe85e4f4d1941166ddcc97850f5964ee2ef8bda95519d019af8d488',
            '+d9299750eeb71720dda470bccb8fafa57cf13f4939749615642c75a191481dea',
            '+b68f666f1ede5615bf382958a815988a42aea8e4e03fbf0470a57bceac7714db',
            '+9c99976107b5d98e5669452392d912edf33c968e5832b52f2eedcd044b5cc2f2',
            '+c4d96fbfe80102f01579945fe0c5fe2a1874a7ffeca6bacef39140f9358e3db6',
            '+f91766de68f3a8859a3634c3a0fdde38ebd82dd91fc37b67ac6cf010800a3e6e',
            '+abe994f962c34d7997506a657beee403f6b807eb2b2605dc6c3b93bb67b839eb',
            '+ac09bc40c889f688f9158cca1fcfcdf6320f501242e0f7088d52a5077084ccba',
            '+0fec636f5866c66f63a0d3db9b00e3cd5ba1b3a0324712c7935ae845dbfcf58a',
            '+226e78386cb6e79aa5005c847b806da1d1d7dc995e3b76945d174b87de3b6099',
            '+942972349c8f2afe93ad874b3f19de05de7e34c120b23803438c7eeb8e6113b7',
            '+ad936990fb57f7e686763c293e9ca773d1d921888f5235189945a10029cd95b0',
            '+c58078a7d12d81190ef0c5deb7611f97fc923d064647b66b9b25512029a13daf',
            '+72f0cd8486d8627b5bd4f10c2e592a4512ac58e572edb3e37c0448b3ac7dd405',
            '+de918e28b554600a81cbf119abf5414648b58a8efafbc3b0481df0242684dc1b',
            '-77c59f444c8a49bcd354759cc912166fe6eaa603a5f9d4a9525405b30a52ac10',
            '-6a01c4b86f4519ec9fa5c3288ae20e2e7a58822ebe891fb81e839588b95b242a',
            '-b690204a2a4a39431b8aaa4bb9af4e53aead93d2d46c5042edada9f5d43d6cd3',
            '-88260051bbe6634431f8a2f3ac66680d1ee9ef1087222e6823d9b4d81170edc7',
            '-8966b54a95b327651e3103d8adb69579ff50bf22a004a65731a41f7caca2859f',
            '-90ad9bfed339af2d6b4b3b7f7cdf25d927b255f9f25dbbc892ee9ca57ef67807',
            '-b73fa499a7794c111fcd011cdc7dcc426341a28c6c2d6a32b8d7d028dcb8493f',
            '-619a3113c6cb1d3db7ef9731e6e06b618296815b3cfe7ca8d23f3767198b00ea'

          ]
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('senderPublicKey', pubKey);

        await signAndVerify(tx);
      });
      it('vote with 0 added and 0 removed', async () => {
        const tx = new VoteTx({
          votes: []
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('senderPublicKey', pubKey);

        await signAndVerify(tx);
      });
      it('vote with 1 added and 1 removed', async () => {
        const tx = new VoteTx({
          votes: [
            '+a',
            '-b'
          ]
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('senderPublicKey', pubKey);

        await signAndVerify(tx);
      });
      it('vote with requesterPublicKey, signature and secondSignature (multi-sig-wallet)', async () => {
        const tx           = new VoteTx({
          votes: [
            '+a',
            '-b'
          ]
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('senderPublicKey', pubKey)
          .set('requesterPublicKey', pubKey);
        tx.signature       = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';
        tx.secondSignature = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';
        await signAndVerify(tx);
      });

    });
    describe('delegates', async () => {
      it('reg delegate', async () => {
        const tx = new DelegateTx({
          delegate: {
            username : 'vekexasia',
            publicKey: '01389197bbaf1afb0acd47bbfeabb34aca80fb372a8f694a1c0716b3398db7aa'
          }
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('senderPublicKey', pubKey);

        await signAndVerify(tx);
      });
      it('reg delegate with 21 chars name', async () => {
        const tx = new DelegateTx({
          delegate: {
            username : '1vote1vekexasia1vote1',
            publicKey: '01389197bbaf1afb0acd47bbfeabb34aca80fb372a8f694a1c0716b3398db7aa'
          }
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('senderPublicKey', pubKey);

        await signAndVerify(tx);
      });
      it('reg delegate with requesterpublickey, sign and secondSign (multisig-account)', async () => {
        const tx           = new DelegateTx({
          delegate: {
            username : 'multisig',
            publicKey: '01389197bbaf1afb0acd47bbfeabb34aca80fb372a8f694a1c0716b3398db7aa'
          }
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('senderPublicKey', pubKey)
          .set('requesterPublicKey', pubKey);
        tx.signature       = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';
        tx.secondSignature = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';

        await signAndVerify(tx);
      });
      it('reg delegate with fancy name', async () => {
        const tx           = new DelegateTx({
          delegate: {
            username : '0123456789veke!@$&_.',
            publicKey: '01389197bbaf1afb0acd47bbfeabb34aca80fb372a8f694a1c0716b3398db7aa'
          }
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('senderPublicKey', pubKey)
          .set('requesterPublicKey', pubKey);
        tx.signature       = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';
        tx.secondSignature = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';

        await signAndVerify(tx);
      });
    });
    describe('send', () => {
      it('should sign 8.51 amount', async () => {
        const tx = new SendTx()
          .set('amount', 851000000)
          .set('timestamp', 10)
          .set('fee', 10000000)
          .set('recipientId', '15610359283786884938L')
          .set('senderPublicKey', pubKey);

        await signAndVerify(tx);
      });
      it('should sign 0.51 amount', async () => {
        const tx = new SendTx()
          .set('amount', 51000000)
          .set('timestamp', 10)
          .set('fee', 10000000)
          .set('recipientId', '15610359283786884938L')
          .set('senderPublicKey', pubKey);

        await signAndVerify(tx);
      });
      it('should sign with message', async () => {
        const tx = new SendTx({data: 'hey brotha :)'})
          .set('amount', 851000000)
          .set('timestamp', 10)
          .set('fee', 10000000)
          .set('recipientId', '15610359283786884938L')
          .set('senderPublicKey', pubKey);

        await signAndVerify(tx);
      });
      it('should sign with message and signature with printable chars `ab` as start', async () => {
        const tx = new SendTx({data: 'hey brotha :)'})
          .set('amount', 851000000)
          .set('timestamp', 10)
          .set('fee', 10000000)
          .set('recipientId', '15610359283786884938L')
          .set('senderPublicKey', pubKey);

        tx.signature       = '616266573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';

        await signAndVerify(tx);
      });

      it('should work with sign, secondSign, requesterPublicKey', async () => {
        const tx = new SendTx()
          .set('amount', 851000000)
          .set('timestamp', 10)
          .set('fee', 10000000)
          .set('recipientId', '15610359283786884938L')
          .set('requesterPublicKey', pubKey)
          .set('senderPublicKey', pubKey);

        tx.signature       = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';
        tx.secondSignature = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';
        await signAndVerify(tx);
      });
    });

    describe('multisignature', () => {
      it('simple multisig - min 3 - lifetime 24', async () => {
        const tx = new MultiSignatureTx({
          multisignature: {
            min      : 3,
            lifetime : 24,
            keysgroup: [pubKey, pubKey, pubKey, pubKey]
          }
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('senderPublicKey', pubKey);
        await signAndVerify(tx);
      });
      it('simple multisig - min 3 - lifetime 24 with sign, secondsign and requester', async () => {
        const tx = new MultiSignatureTx({
          multisignature: {
            min      : 3,
            lifetime : 24,
            keysgroup: [pubKey, pubKey, pubKey, pubKey]
          }
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('requesterPublicKey', pubKey)
          .set('senderPublicKey', pubKey);

        tx.signature       = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';
        tx.secondSignature = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';

        await signAndVerify(tx);
      });
      it('heavy multisig - min 12 - lifetime 24 with sign, second and requester', async () => {
        // 983 bytes
        const tx = new MultiSignatureTx({
          multisignature: {
            min      : 6,
            lifetime : 24,
            keysgroup: [pubKey, pubKey, pubKey, pubKey, pubKey, pubKey,
              pubKey, pubKey, pubKey, pubKey, pubKey, pubKey]
          }
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('requesterPublicKey', pubKey)
          .set('senderPublicKey', pubKey);

        tx.signature       = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';
        tx.secondSignature = 'e96c66573a67214867025fd478cadd363c0d558ef6d3e071dba4abfcb6cd01abfb78814544137191ac70fe4e44dcf922d638c7d963ce08ccd1acdc5f9113cf01';

        await signAndVerify(tx);
      });
    });

    describe('secondsignature', () => {
      it('simple secondsignature request creation', async () => {
        const tx = new CreateSignatureTx({
          signature: {
            publicKey: pubKey
          }
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('senderPublicKey', pubKey);
        await signAndVerify(tx);
      });
      it('creation with requesterPublicKey', async () => {
        const tx = new CreateSignatureTx({
          signature: {
            publicKey: pubKey
          }
        })
          .set('amount', 0)
          .set('timestamp', 10)
          .set('fee', 100)
          .set('recipientId', '123456781230L')
          .set('requesterPublicKey', pubKey)
          .set('senderPublicKey', pubKey);
        await signAndVerify(tx);
      });

    });
  });
  */

});