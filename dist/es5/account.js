"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerAccount = void 0;
var bip32path = require("bip32-path");
/**
 * Class to specify An account used to query the ledger.
 */
var SupportedCoin;
(function (SupportedCoin) {
    /**
     * @see https://lisk.io
     */
    SupportedCoin[SupportedCoin["LISK"] = 134] = "LISK";
})(SupportedCoin || (SupportedCoin = {}));
/**
 * Defines an Account to be used when communicating with ledger
 */
var LedgerAccount = /** @class */ (function () {
    function LedgerAccount() {
        // tslint:disable variable-name
        this._account = 0;
        this._coinIndex = SupportedCoin.LISK; // LISK
    }
    // tslint:enable variable-name
    /**
     * Specify the account number
     * @param {number} newAccount
     * @returns {this}
     */
    LedgerAccount.prototype.account = function (newAccount) {
        this.assertValidPath(newAccount);
        this._account = newAccount;
        return this;
    };
    /**
     * Specify the coin index. At the moment will force alwais Lisk.
     * @see https://github.com/satoshilabs/slips/blob/master/slip-0044.md
     * @param {number} newIndex
     * @returns {this}
     */
    LedgerAccount.prototype.coinIndex = function (newIndex) {
        this.assertValidPath(newIndex);
        // this._coinIndex = newIndex;
        this._coinIndex = SupportedCoin.LISK;
        return this;
    };
    /**
     * Derive the path using hardened entries.
     * @returns {Buffer} defines the path in buffer form.
     */
    LedgerAccount.prototype.derivePath = function () {
        var pathArray = bip32path.fromString("44'/" + this._coinIndex + "'/" + this._account + "'")
            .toPathArray();
        var retBuf = Buffer.alloc(pathArray.length * 4);
        pathArray.forEach(function (r, idx) { return retBuf.writeUInt32BE(r, idx * 4); });
        return retBuf;
    };
    /**
     * Asserts that the given param is a valid path (integer > 0)
     */
    LedgerAccount.prototype.assertValidPath = function (n) {
        if (!Number.isInteger(n)) {
            throw new Error('Param must be an integer');
        }
        if (n < 0) {
            throw new Error('Param must be greater than zero');
        }
    };
    return LedgerAccount;
}());
exports.LedgerAccount = LedgerAccount;
