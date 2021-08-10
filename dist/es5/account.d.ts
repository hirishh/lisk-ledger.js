/// <reference types="node" />
/**
 * Class to specify An account used to query the ledger.
 */
declare enum SupportedCoin {
    /**
     * @see https://lisk.io
     */
    LISK = 134
}
/**
 * Defines an Account to be used when communicating with ledger
 */
export declare class LedgerAccount {
    private _account;
    private _coinIndex;
    /**
     * Specify the account number
     * @param {number} newAccount
     * @returns {this}
     */
    account(newAccount: number): this;
    /**
     * Specify the coin index. At the moment will force alwais Lisk.
     * @see https://github.com/satoshilabs/slips/blob/master/slip-0044.md
     * @param {number} newIndex
     * @returns {this}
     */
    coinIndex(newIndex: SupportedCoin): this;
    /**
     * Derive the path using hardened entries.
     * @returns {Buffer} defines the path in buffer form.
     */
    derivePath(): Buffer;
    /**
     * Asserts that the given param is a valid path (integer > 0)
     */
    private assertValidPath;
}
export {};
