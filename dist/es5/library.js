"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DposLedger = void 0;
var crc16 = require("crc/lib/crc16_ccitt");
/**
 * Communication Protocol class.
 * @example
 * ```javascript
 *
 * import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
 * import { DposLedger, LedgerAccount } from 'dpos-ledger-ts';
 *
 * const account = new LedgerAccount();
 * TransportNodeHid.create()
 *   .then((transport) => new DposLedger(transport))
 *   .then((instance) => instance.getPubKey(account));
 *   .then(({publicKey}) => console.log(`pubKey: ${publicKey}`);
 * ```
 */
var DposLedger = /** @class */ (function () {
    /**
     * @param {ITransport} transport transport class.
     * @param {number} chunkSize lets you specify the chunkSize for each communication.<br/>
     * <strong>DO not</strong> change if you don't know what you're doing.
     */
    function DposLedger(transport, chunkSize) {
        if (chunkSize === void 0) { chunkSize = 240; }
        this.transport = transport;
        this.chunkSize = chunkSize;
        this.progressListener = null;
        if (chunkSize > 240) {
            throw new Error('Chunk size cannot exceed 240');
        }
        if (chunkSize < 1) {
            throw new Error('Chunk size cannot be less than 1');
        }
        if (transport === null || typeof (transport) === 'undefined') {
            throw new Error('Transport cannot be empty');
        }
        transport.setScrambleKey('hirishh');
    }
    /**
     * Retrieves a publicKey associated to an account
     * @param {LedgerAccount|Buffer} account or bip32 buffer
     * @param {boolean} showOnLedger ask ledger to show the address.
     * @returns {Promise<{publicKey: string, account:string, lisk32: string}>}
     * @example
     * ```javascript
     *
     * instance.getPubKey(account)
     *   .then((resp) => {
     *     console.log(resp.publicKey);
     *     console.log(resp.address);
     *     console.log(resp.lisk32);
     *   });
     * ```
     */
    // tslint:disable-next-line max-line-length
    DposLedger.prototype.getPubKey = function (account, showOnLedger) {
        if (showOnLedger === void 0) { showOnLedger = false; }
        return __awaiter(this, void 0, void 0, function () {
            var pathBuf, resp, publicKey, address, lisk32;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pathBuf = Buffer.isBuffer(account) ? account : account.derivePath();
                        return [4 /*yield*/, this.exchange([
                                0x04,
                                showOnLedger ? 0x1 : 0x0,
                                (pathBuf.length / 4),
                                pathBuf,
                            ])];
                    case 1:
                        resp = _a.sent();
                        publicKey = resp[0], address = resp[1], lisk32 = resp[2];
                        return [2 /*return*/, {
                                publicKey: publicKey.toString('hex'),
                                address: address.toString('hex'),
                                lisk32: lisk32.toString('utf8')
                            }];
                }
            });
        });
    };
    /**
     * Signs a transaction. Transaction must be provided as a buffer using getBytes.
     * @see https://github.com/vekexasia/dpos-offline/blob/master/src/trxTypes/BaseTx.ts#L52
     * @param {LedgerAccount | Buffer} account or raw bip32 buffer
     * @param {Buffer} buff buffer containing the bytes of a transaction
     * @returns {Promise<Buffer>} signature.
     * @example
     * ```javascript
     *
     * instance.signTX(account, transaction.getBytes(), false)
     *   .then((signature) => {
     *     console.log('Signature is: ', signature.toString('hex'));
     *   });
     * ```
     */
    DposLedger.prototype.signTX = function (account, buff) {
        return this.sign(0x05, account, buff);
    };
    /**
     * Signs a message. The message can be passed as a string or buffer.
     * Note that if buffer contains "non-printable" characters, then the ledger will probably have some issues
     * Displaying the message to the user.
     * @param {LedgerAccount | Buffer} account or raw bip32 buffer
     * @param {string | Buffer} what the message to sign
     * @returns {Promise<Buffer>} the "non-detached" signature.
     * Signature goodness can be verified using sodium. See tests.
     * @example
     * ```javascript
     *
     * instance.signMSG(account, 'message string', false)
     *   .then((signature) => {
     *     console.log('Signature is: ', signature.toString('hex'));
     *   });
     * ```
     */
    DposLedger.prototype.signMSG = function (account, what) {
        return __awaiter(this, void 0, void 0, function () {
            var buffer;
            return __generator(this, function (_a) {
                buffer = typeof (what) === 'string' ? Buffer.from(what, 'utf8') : what;
                return [2 /*return*/, this.sign(0x06, account, buffer)];
            });
        });
    };
    /**
     * Gets Ledger App Version
     * @returns {Promise<object>} see example
     * @example
     * ```javascript
     *
     * instance.version()
     *   .then((resp) => {
     *     console.log('CoinID is: ', resp.coinID);
     *     console.log('Version is: ', resp.version);
     *   });
     * ```
     */
    DposLedger.prototype.version = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, version, coinID;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.exchange(0x09)];
                    case 1:
                        _a = _b.sent(), version = _a[0], coinID = _a[1];
                        return [2 /*return*/, {
                                coinID: coinID.toString('ascii'),
                                version: version.toString('ascii'),
                            }];
                }
            });
        });
    };
    /**
     * Simple ping utility. It won't throw if ping suceeded.
     * @returns {Promise<void>}
     */
    DposLedger.prototype.ping = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.exchange(0x08)];
                    case 1:
                        res = (_a.sent())[0];
                        if (res.toString('ascii') !== 'PONG') {
                            throw new Error('Didnt receive PONG');
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Raw exchange protocol handling. It's exposed but it is meant for internal usage only.
     * @param {string | Buffer} hexData
     * @returns {Promise<Buffer[]>} Raw response buffers.
     */
    DposLedger.prototype.exchange = function (hexData) {
        return __awaiter(this, void 0, void 0, function () {
            var inputBuffer, startCommBuffer, chunkDataSize, nChunks, prevCRC, i, dataSize, dataBuffer, _a, curCRC, prevCRCLedger, _b, crc, receivedCRC, resBuf;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (Array.isArray(hexData)) {
                            inputBuffer = Buffer.concat(hexData.map(function (item) {
                                if (typeof (item) === 'string') {
                                    return Buffer.from(item, 'hex');
                                }
                                else if (typeof (item) === 'number') {
                                    return Buffer.alloc(1).fill(item);
                                }
                                return item;
                            }));
                        }
                        else if (typeof (hexData) === 'string') {
                            inputBuffer = Buffer.from(hexData, 'hex');
                        }
                        else if (typeof (hexData) === 'number') {
                            inputBuffer = Buffer.alloc(1).fill(hexData);
                        }
                        else {
                            inputBuffer = hexData;
                        }
                        startCommBuffer = Buffer.alloc(2);
                        startCommBuffer.writeUInt16BE(inputBuffer.length, 0);
                        if (this.progressListener) {
                            this.progressListener.onStart();
                        }
                        return [4 /*yield*/, this.transport.send(0xe0, 89, 0, 0, startCommBuffer)];
                    case 1:
                        _c.sent();
                        chunkDataSize = this.chunkSize;
                        nChunks = Math.ceil(inputBuffer.length / chunkDataSize);
                        prevCRC = 0;
                        i = 0;
                        _c.label = 2;
                    case 2:
                        if (!(i < nChunks)) return [3 /*break*/, 5];
                        dataSize = Math.min(inputBuffer.length, (i + 1) * chunkDataSize) - i * chunkDataSize;
                        dataBuffer = inputBuffer.slice(i * chunkDataSize, i * chunkDataSize + dataSize);
                        _b = this.decomposeResponse;
                        return [4 /*yield*/, this.transport.send(0xe0, 90, 0, 0, dataBuffer)];
                    case 3:
                        _a = _b.apply(this, [_c.sent()]), curCRC = _a[0], prevCRCLedger = _a[1];
                        crc = crc16(dataBuffer);
                        receivedCRC = curCRC.readUInt16LE(0);
                        if (crc !== receivedCRC) {
                            throw new Error('Something went wrong during CRC validation');
                        }
                        if (prevCRCLedger.readUInt16LE(0) !== prevCRC) {
                            throw new Error('Prev CRC is not valid');
                        }
                        prevCRC = crc;
                        if (this.progressListener) {
                            this.progressListener.onChunkProcessed(dataBuffer);
                        }
                        _c.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, this.transport.send(0xe0, 91, 0, 0)];
                    case 6:
                        resBuf = _c.sent();
                        if (this.progressListener) {
                            this.progressListener.onEnd();
                        }
                        return [2 /*return*/, this.decomposeResponse(resBuf)];
                }
            });
        });
    };
    /**
     * Raw sign protocol utility. It will handle signature of both msg and txs.
     * @param {number} signType type of signature. 0x05 for txs, 0x06 for messages.
     * @param {LedgerAccount|Buffer} account acount or bip32 buffer
     * @param {Buffer} buff buffer to sign
     * @param {boolean} hasRequesterPKey if it has a requesterpublickey (used only in tx signing mode)
     * @returns {Promise<Buffer>} the signature
     */
    DposLedger.prototype.sign = function (signType, account, buff) {
        return __awaiter(this, void 0, void 0, function () {
            var pathBuf, buffLength, args, signature;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pathBuf = Buffer.isBuffer(account) ? account : account.derivePath();
                        buffLength = Buffer.alloc(2);
                        buffLength.writeUInt16BE(buff.length, 0);
                        return [4 /*yield*/, this.exchange([
                                signType,
                                // Bip32
                                (pathBuf.length / 4),
                                pathBuf,
                                // headers
                                buffLength,
                                // data
                                buff,
                            ])];
                    case 1:
                        args = _a.sent();
                        signature = args[0];
                        return [2 /*return*/, signature];
                }
            });
        });
    };
    /**
     * Internal utility to decompose the ledger response as protocol definition.
     * @param {Buffer} resBuf response from ledger
     * @returns {Array<Buffer>} decomposed response.
     */
    DposLedger.prototype.decomposeResponse = function (resBuf) {
        var totalElements = resBuf.readInt8(0);
        var toRet = [];
        var index = 1; // 1 read uint8_t
        for (var i = 0; i < totalElements; i++) {
            var elLength = resBuf.readInt16LE(index);
            index += 2;
            toRet.push(resBuf.slice(index, index + elLength));
            index += elLength;
        }
        return toRet;
    };
    return DposLedger;
}());
exports.DposLedger = DposLedger;
