import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { expect } from 'chai';
import { LiskLedger } from '../../src/';
import TransportU2F from '@ledgerhq/hw-transport-u2f';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { isBrowser } from 'browser-or-node';
import { ITransport } from '../../src/ledger';

chai.use(chaiAsPromised);

describe('Communications', function () {
  this.timeout(150222200);
  let dl: LiskLedger;
  let transport: ITransport;

  before(async () => {
    transport = await (isBrowser ? TransportU2F.create() : TransportNodeHid.create());
    dl = new LiskLedger(transport);
  });
  after(() => {
    transport.close();
  });

  /**
   * VERSION AND PING
   */

  it('version() should return version', async () => {
    expect(await dl.version()).to.be.deep.eq({
      version: '2.0.0',
      coinID: 'lisk'
    });
  });

  it('should ping', async () => {
    await dl.ping();
  });


  describe('Errors', () => {

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

});