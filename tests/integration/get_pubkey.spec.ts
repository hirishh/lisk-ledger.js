import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { expect } from 'chai';
import { cryptography } from '@liskhq/lisk-client';
import { DposLedger, LedgerAccount } from '../../src/';
import TransportU2F from '@ledgerhq/hw-transport-u2f';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { isBrowser } from 'browser-or-node';
import { ITransport } from '../../src/ledger';

chai.use(chaiAsPromised);

describe('getPubKey API', function () {
  this.timeout(150222200);
  let dl: DposLedger;
  let account: LedgerAccount;
  let pubKey: string;
  let address: string;
  let lisk32: string;
  let transport: ITransport;

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