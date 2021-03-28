import * as chai from 'chai';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSpy, SinonStub } from 'sinon';
import { DposLedger } from '../../src/library';
import { LedgerAccount } from '../../src/account';
import { crc16ccitt as crc16 } from 'crc';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

describe('library', () => {
  let instance: DposLedger;
  let commSendStub: SinonStub;
  let closeStub: SinonStub;
  let setScrambleKeyStub: SinonStub;
  beforeEach(() => {
    commSendStub       = sinon.stub();
    closeStub          = sinon.stub();
    setScrambleKeyStub = sinon.stub();
    const transport    = {
      send          : commSendStub,
      close         : closeStub,
      setScrambleKey: setScrambleKeyStub
    };
    instance           = new DposLedger(transport);
  });
  function buildCommProtocol(data: Buffer, finalResp: Buffer[] = [Buffer.from('aa', 'hex')], chunkSize: number = 240) {
    const chunks  = Math.ceil(data.length / chunkSize);
    const crcBuff = Buffer.from('020200000002000000', 'hex');
    let prevCRC = 0;
    for (let i = 0; i < chunks; i++) {
      crcBuff.writeUInt16LE(crc16(data.slice(i * chunkSize, (i + 1) * chunkSize)), 3);
      crcBuff.writeUInt16LE(prevCRC, 7);
      commSendStub.onCall(i + 1).resolves(Buffer.from(crcBuff));
      prevCRC = crc16(data.slice(i * chunkSize, (i + 1) * chunkSize));
    }

    // Final response result
    const finalResultResponse = buildResponseFromLedger(finalResp);
    commSendStub.onCall(chunks + 1)
      .resolves(finalResultResponse);
  }
  function buildResponseFromLedger(resps: Buffer[]) {
    return Buffer
      .concat(
        [
          Buffer.from([resps.length]),
        ].concat(
          resps.map((b) => {
            const outBuf = Buffer.alloc(2 + b.length);
            outBuf.writeUInt16LE(b.length, 0);
            b.copy(outBuf, 2, 0, b.length);
            return outBuf;
          }))
      );
  }

  describe('constructor', () => {
    it ('should throw if chunkSize > 240', () => {
      expect(() => new DposLedger({} as never, 241))
        .to.throw('Chunk size cannot exceed 240');
    });
    it ('should throw if chunkSize < 1', () => {
      expect(() => new DposLedger({} as never, 0))
        .to.throw('Chunk size cannot be less than 1');
    });
    it ('should throw if transport is null', () => {
      expect(() => new DposLedger(null))
        .to.throw('Transport cannot be empty');
    });
    it ('should throw if transport is undefined', () => {
      expect(() => new DposLedger(undefined))
        .to.throw('Transport cannot be empty');
    });
  });

  describe('exchange comm protocol', () => {
    describe('all good', () => {
      it('should send one chunk of data and call .comm.exchange twice with proper data', async () => {
        buildCommProtocol(
          Buffer.from('abcdef', 'hex')
        );
        await instance.exchange('abcdef');
        expect(commSendStub.callCount).is.eq(3);
        expect(commSendStub.firstCall.args).to.be.deep.eq(
          [0xe0, 0x59, 0, 0, Buffer.from('0003', 'hex')]
        );

        // Second call - Communication continuation
        expect(commSendStub.secondCall.args).to.be.deep.eq(
          [0xe0, 90, 0, 0, Buffer.from('abcdef', 'hex')]
        );

        // Third call - Communication closure.
        expect(commSendStub.thirdCall.args).to.be.deep.eq(
          [0xe0, 91, 0, 0]
        );
      });

      it('should send multiple chunks of data (properly splitted)', async () => {
        const buffer = Buffer.alloc(1024);
        for (let i = 0; i < buffer.length; i++) {
          buffer.writeUInt8(i % 256, i);
        }
        buildCommProtocol(buffer);
        await instance.exchange(buffer);

        expect(commSendStub.callCount).to.be.gt(2);
        let read = 0;
        for (let i = 0; i < commSendStub.callCount - 2; i++) {
          const call = commSendStub.getCall(i + 1);

          const sent = call.args[4].length;

          expect(call.args[4]).to.be.deep.eq(Buffer.from(buffer.slice(read, sent + read)));
          read += sent;
        }
        expect(read).to.be.eq(buffer.length);
      });

      it('should treat string param as hexEncoded string', async () => {
        buildCommProtocol(Buffer.from('aabb', 'hex'));
        await instance.exchange('aabb');
        expect(commSendStub.secondCall.args[4]).to.be.deep.eq(Buffer.from('aabb', 'hex'));
      });
      it('should treat array param as mixed string, buffer, number and reconstruct it', async () => {
        const buf = Buffer.from('0001', 'hex');
        buildCommProtocol(Buffer.from('aabb0001', 'hex'));
        await instance.exchange(['aa', 187 /*bb*/, buf]);
        expect(commSendStub.secondCall.args[4]).to.be.deep.eq(Buffer.from('aabb0001', 'hex'));
      });
      it('should work even for 1 chunksize with proper data sent and # of comm with ledger', async () => {
        instance['chunkSize'] = 1;
        const buffer          = Buffer.alloc(1024);
        for (let i = 0; i < buffer.length; i++) {
          buffer.writeUInt8(i % 256, i);
        }
        buildCommProtocol(buffer, [Buffer.from('aa', 'hex')], 1);
        await instance.exchange(buffer);

        expect(commSendStub.callCount).eq(buffer.length + 2);
      });
    });
    it('should fail if one of the CRC fails', () => {
      const buffer = Buffer.from('aabb', 'hex');
      buildCommProtocol(buffer);
      commSendStub.onCall(1).resolves(Buffer.from('0102000000', 'hex'));
      return expect(instance.exchange(buffer)).to.be.rejectedWith('Something went wrong during CRC validation');
    });
  });

  describe('getPubKey', () => {
    let account: LedgerAccount;
    let derivePathSpy: SinonSpy;
    let instanceExchangeStub: SinonStub;
    beforeEach(() => {
      account              = new LedgerAccount();
      derivePathSpy        = sinon.spy(account, 'derivePath');
      instanceExchangeStub = sinon.stub(instance, 'exchange');
      instanceExchangeStub.resolves([Buffer.from('aa', 'hex'), Buffer.from('123','utf8')]);
    });

    it('should call account derivePath', async () => {
      await instance.getPubKey(account);
      expect(derivePathSpy.calledOnce).is.true;
    });
    it('should call instance.exchange with proper data', async () => {
      await instance.getPubKey(account);
      expect(instanceExchangeStub.calledOnce).is.true;
      expect(instanceExchangeStub.firstCall.args[0]).to.be.deep.eq([
        0x04,
        0x00,
        account.derivePath().length / 4,
        account.derivePath()
      ]);
    });
    it('should allow custom path32 derivation buffer', async () => {
      await instance.getPubKey(account.derivePath());
      expect(instanceExchangeStub.firstCall.args[0]).to.be.deep.eq([
        0x04,
        0x00,
        account.derivePath().length / 4,
        account.derivePath()
      ]);
    });
    it('should allow true in second param to show address', async () => {
      await instance.getPubKey(account, true);
      expect(instanceExchangeStub.calledOnce).is.true;
      expect(instanceExchangeStub.firstCall.args[0]).to.be.deep.eq([
        0x04,
        0x01, // show address on ledger.
        account.derivePath().length / 4,
        account.derivePath()
      ]);
    });
    it('should return publicKey and address', async () => {
      const {publicKey, address} = await instance.getPubKey(account);
      expect(publicKey).to.be.eq('aa');
      expect(address).to.be.eq('123');
    });
  });

  describe('signTX', () => {
    let account: LedgerAccount;
    let derivePathSpy: SinonSpy;
    let instanceExchangeStub: SinonStub;
    beforeEach(() => {
      account              = new LedgerAccount();
      derivePathSpy        = sinon.spy(account, 'derivePath');
      instanceExchangeStub = sinon.stub(instance, 'exchange');
      instanceExchangeStub.resolves([Buffer.from('aa', 'hex')]);
    });

    it('should call account derivePath', async () => {
      await instance.signTX(account, Buffer.alloc(2));
      expect(derivePathSpy.calledOnce).is.true;
    });
    it('should call instance.exchange with signType 05', async () => {
      await instance.signTX(account, Buffer.alloc(2));
      expect(instanceExchangeStub.calledOnce).is.true;
      expect(instanceExchangeStub.firstCall.args[0][0]).to.be.deep.eq(0x05);
    });
    it('should propagate correct data derived from inputbuffer and account', async () => {
      const buff = Buffer.alloc(2);
      await instance.signTX(account, buff);
      expect(instanceExchangeStub.calledOnce).is.true;
      const lengthBuff = Buffer.alloc(2);
      lengthBuff.writeUInt16BE(2, 0);
      expect(instanceExchangeStub.firstCall.args[0]).to.be.deep.eq([
        0x05, // sign type
        account.derivePath().length / 4,
        account.derivePath(),
        lengthBuff, // buffer length
        buff
      ]);
    });
    it('should do the same as above ^^ for custom bip32 buffer', async () => {
      const buff = Buffer.alloc(2);
      await instance.signTX(account.derivePath(), buff);
      expect(instanceExchangeStub.calledOnce).is.true;
      const lengthBuff = Buffer.alloc(2);
      lengthBuff.writeUInt16BE(2, 0);
      expect(instanceExchangeStub.firstCall.args[0]).to.be.deep.eq([
        0x05, // sign type
        account.derivePath().length / 4,
        account.derivePath(),
        lengthBuff, // buffer length
        buff
      ]);
    });
  });

  describe('signMSG', () => {
    let account: LedgerAccount;
    let derivePathSpy: SinonSpy;
    let instanceExchangeStub: SinonStub;
    beforeEach(() => {
      account              = new LedgerAccount();
      derivePathSpy        = sinon.spy(account, 'derivePath');
      instanceExchangeStub = sinon.stub(instance, 'exchange');
      instanceExchangeStub.resolves([Buffer.from('aa', 'hex')]);
    });

    it('should call account derivePath', async () => {
      await instance.signMSG(account, Buffer.alloc(2));
      expect(derivePathSpy.calledOnce).is.true;
    });
    it('should propagate correct data derived from inputbuffer and account', async () => {
      const buff = Buffer.alloc(2);
      await instance.signMSG(account, buff);
      expect(instanceExchangeStub.calledOnce).is.true;
      const lengthBuff = Buffer.alloc(2);
      lengthBuff.writeUInt16BE(2, 0);
      expect(instanceExchangeStub.firstCall.args[0]).to.be.deep.eq([
        0x06, // sign type
        account.derivePath().length / 4,
        account.derivePath(),
        lengthBuff, // buffer length
        buff,
      ]);
    });
    it('should do the same as above ^^ but with custom bip32 buffer', async () => {
      const buff = Buffer.alloc(2);
      await instance.signMSG(account.derivePath(), buff);
      expect(instanceExchangeStub.calledOnce).is.true;
      const lengthBuff = Buffer.alloc(2);
      lengthBuff.writeUInt16BE(2, 0);
      expect(instanceExchangeStub.firstCall.args[0]).to.be.deep.eq([
        0x06, // sign type
        account.derivePath().length / 4,
        account.derivePath(),
        lengthBuff, // buffer length
        buff,
      ]);
    });
    it('should call convert string to buffer', async () => {
      await instance.signMSG(account, 'message String');
      expect(instanceExchangeStub.calledOnce).is.true;
      expect(instanceExchangeStub.firstCall.args[0][4]).to.be.deep
        .eq(Buffer.from('message String', 'utf8'));
    });
  });

  describe('ping', () => {
    let instanceExchangeStub: SinonStub;
    beforeEach(() => {
      instanceExchangeStub = sinon.stub(instance, 'exchange');
      instanceExchangeStub.resolves([Buffer.from('PONG', 'utf8')]);
    });
    it('should send 08 with exchange', async () => {
      await instance.ping();
      expect(instanceExchangeStub.calledOnce).is.true;
      expect(instanceExchangeStub.firstCall.args[0]).is.eq(0x08);
    });
    it('should throw if exchange did not respond with PONG', () => {
      instanceExchangeStub.resolves('POOOONG');
      return expect(instance.ping()).to.rejectedWith('Didnt receive PONG');
    });
  });
  describe('version', () => {
    let instanceExchangeStub: SinonStub;
    beforeEach(() => {
      instanceExchangeStub = sinon.stub(instance, 'exchange');
      instanceExchangeStub.resolves([Buffer.from('1.0.0', 'ascii'), Buffer.from('dPoS', 'ascii')]);
    });
    it('should send 09 with exchange', async () => {
      await instance.version();
      expect(instanceExchangeStub.calledOnce).is.true;
      expect(instanceExchangeStub.firstCall.args[0]).is.eq(0x09);
    });
    it('should respond utf8 representation of exchange output', async () => {
      expect(await instance.version()).to.be.deep.eq({
        version: '1.0.0',
        coinID: 'dPoS'
      });
    });
  });

  describe('progress', () => {
    it('should report multiple chunks of data (properly splitted)', async () => {
      const buffer = Buffer.alloc(1024);
      for (let i = 0; i < buffer.length; i++) {
        buffer.writeUInt8(i % 256, i);
      }
      buildCommProtocol(buffer);
      instance.progressListener = {
        onStart(): void {},
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onChunkProcessed(chunk: Buffer): void {},
        onEnd(): void {},
      };

      const startSpy = sinon.spy(instance.progressListener, 'onStart');
      const chunkSpy = sinon.spy(instance.progressListener, 'onChunkProcessed');
      const endSpy = sinon.spy(instance.progressListener, 'onEnd');

      await instance.exchange(buffer);

      expect(startSpy.calledOnce).is.true;
      expect(commSendStub.callCount).to.be.gt(2);
      let read = 0;
      for (let i = 0; i < commSendStub.callCount - 2; i++) {
        const call = commSendStub.getCall(i + 1);

        const sent = call.args[4].length;

        expect(chunkSpy.getCall(i).args[0]).deep.eq(Buffer.from(buffer.slice(read, sent + read)));

        read += sent;
      }
      expect(endSpy.calledOnce).is.true;
    });
  });
});
