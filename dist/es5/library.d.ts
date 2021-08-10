/// <reference types="node" />
import { LedgerAccount } from './account';
import { IProgressListener } from './IProgressListener';
import { ITransport } from './ledger';
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
export declare class DposLedger {
    private transport;
    private chunkSize;
    progressListener: IProgressListener;
    /**
     * @param {ITransport} transport transport class.
     * @param {number} chunkSize lets you specify the chunkSize for each communication.<br/>
     * <strong>DO not</strong> change if you don't know what you're doing.
     */
    constructor(transport: ITransport, chunkSize?: number);
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
    getPubKey(account: LedgerAccount | Buffer, showOnLedger?: boolean): Promise<{
        publicKey: string;
        address: string;
        lisk32: string;
    }>;
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
    signTX(account: LedgerAccount | Buffer, buff: Buffer): Promise<Buffer>;
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
    signMSG(account: LedgerAccount | Buffer, what: string | Buffer): Promise<Buffer>;
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
    version(): Promise<{
        version: string;
        coinID: string;
    }>;
    /**
     * Simple ping utility. It won't throw if ping suceeded.
     * @returns {Promise<void>}
     */
    ping(): Promise<void>;
    /**
     * Raw exchange protocol handling. It's exposed but it is meant for internal usage only.
     * @param {string | Buffer} hexData
     * @returns {Promise<Buffer[]>} Raw response buffers.
     */
    exchange(hexData: string | Buffer | number | Array<(string | Buffer | number)>): Promise<Buffer[]>;
    /**
     * Raw sign protocol utility. It will handle signature of both msg and txs.
     * @param {number} signType type of signature. 0x05 for txs, 0x06 for messages.
     * @param {LedgerAccount|Buffer} account acount or bip32 buffer
     * @param {Buffer} buff buffer to sign
     * @param {boolean} hasRequesterPKey if it has a requesterpublickey (used only in tx signing mode)
     * @returns {Promise<Buffer>} the signature
     */
    private sign;
    /**
     * Internal utility to decompose the ledger response as protocol definition.
     * @param {Buffer} resBuf response from ledger
     * @returns {Array<Buffer>} decomposed response.
     */
    private decomposeResponse;
}
