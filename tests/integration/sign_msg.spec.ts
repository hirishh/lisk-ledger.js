import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { expect } from 'chai';
import { cryptography } from '@liskhq/lisk-client';
import { DposLedger, LedgerAccount } from '../../src/';
import TransportU2F from '@ledgerhq/hw-transport-u2f';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { isBrowser } from 'browser-or-node';
import { ITransport } from '../../src/ledger';
import { encode as encodeVarInt } from 'varuint-bitcoin';
import { sha256 } from 'js-sha256';

chai.use(chaiAsPromised);

function verifySignedMessage(prefix: string, message: string | Buffer, signature: Buffer, pubKey: string): boolean {
  const prefixBuf = Buffer.from(prefix, 'utf8');
  const msgBuf = Buffer.isBuffer(message) ? message : Buffer.from(message, 'utf8');
  const buf = Buffer.concat([
    encodeVarInt(prefixBuf.length),
    prefixBuf,
    encodeVarInt(msgBuf.length),
    msgBuf,
  ]);

  const firstSha = Buffer.from(sha256(buf), 'hex');
  const signablePayload = Buffer.from(sha256(firstSha), 'hex');

  return cryptography.verifyData(signablePayload, signature, Buffer.from(pubKey, 'hex'))
}

describe('signMSG API', function () {
  this.timeout(150222200);
  let dl: DposLedger;
  let account: LedgerAccount;
  let pubKey: string;
  let address: string;
  let lisk32: string;
  let transport: ITransport;
  const msgPrefix = cryptography.constants.SIGNED_MESSAGE_PREFIX;

  before(async () => {
    transport = await (isBrowser ? TransportU2F.create() : TransportNodeHid.create());
    dl = new DposLedger(transport);
  });
  after(() => {
    transport.close();
  });

  beforeEach(async () => {
    account = new LedgerAccount();
    const res = await dl.getPubKey(account);
    expect(res.publicKey).to.match(/^[a-z0-9]{64}$/);
    pubKey = res.publicKey;
    address = res.address;
    lisk32 = res.lisk32;
  });

  it('it should generate valid signature', async () => {
    const msg = 'testMessage';
    const signature = await dl.signMSG(account, msg);
    const res = verifySignedMessage(msgPrefix, msg, signature, pubKey);
    expect(res).is.true;
  });
  it('should show <binary data> if not printable', async () => {
    const msg = Buffer.concat([
      Buffer.from(new Array(32).fill(1)),
    ]);
    const signature = await dl.signMSG(account, msg);
    const res = verifySignedMessage(msgPrefix, msg, signature, pubKey);
    expect(res).is.true;
  });
  it('should rewrite msg to binary data if more than 40% of data is non printable', async () => {
    const msg = Buffer.concat([
      Buffer.from('abcde', 'utf8'), // 6 bytes
      Buffer.from('00000000', 'hex'), // 4 bytes
    ]);
    const signature = await dl.signMSG(account, msg);
    const res = verifySignedMessage(msgPrefix, msg, signature, pubKey);
    expect(res).is.true;
  });
  it('should rewrite msg to binary data if all text but first byte unprintable', async () => {
    const msg = Buffer.concat([
      Buffer.from('00', 'hex'), // 4 bytes,
      Buffer.from('abcde', 'utf8'), // 6 bytes
    ]);
    const signature = await dl.signMSG(account, msg);
    const res = verifySignedMessage(msgPrefix, msg, signature, pubKey);
    expect(res).is.true;
  });
  it('should gen valid signature for short message with newline', async () => {
    const msg = 'hey\nhi';
    const signature = await dl.signMSG(account, msg);
    const res = verifySignedMessage(msgPrefix, msg, signature, pubKey);
    expect(res).is.true;
  });
  it('should gen valid signature for 1000-prefix-4 message', async () => {
    const msg = `${new Array(1000 - msgPrefix.length - 4).fill(null)
      .map(() => String.fromCharCode('a'.charCodeAt(0) + Math.ceil(Math.random() * 21)))
      .join('')}`;
    const signature = await dl.signMSG(account, msg);
    const res = verifySignedMessage(msgPrefix, msg, signature, pubKey);
    expect(res).is.true;
  });

});