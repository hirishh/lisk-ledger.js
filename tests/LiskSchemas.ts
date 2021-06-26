/*
const modules = {
  token: 2,
  dpos: 5,
  multiSignature: 4,
  legacyAccount: 1000,
};
  
const assets = {
  transfer: 0,
  registerDelegate: 0,
  voteDelegate: 1,
  unlockToken: 2,
  registerMultisignatureGroup: 0,
  reclaimLSK: 0,
};
*/

/**
 * - token module - tranfer asset [2:0]
 * - multisignature module - registermultisignaturegroup asset [4:0]
 * - dpos module - registerDelegate / voteDelegate / unlockToken / reportMisbehavior
 * - legacyAccount module - reclaimLSK
 */

// token module - tranfer asset
export const TransferAssetSchema = {
  "moduleID": 2,
  "moduleName": "token",
  "assetID": 0,
  "assetName": "transfer",
  "schema": {
    "$id": "lisk/transfer-asset",
    "title": "Transfer transaction asset",
    "type": "object",
    "required": [
      "amount",
      "recipientAddress",
      "data"
    ],
    "properties": {
      "amount": {
        "dataType": "uint64",
        "fieldNumber": 1
      },
      "recipientAddress": {
        "dataType": "bytes",
        "fieldNumber": 2,
        "minLength": 20,
        "maxLength": 20
      },
      "data": {
        "dataType": "string",
        "fieldNumber": 3,
        "minLength": 0,
        "maxLength": 64
      }
    }
  }
}

// multisignature module - registermultisignaturegroup asset
export const MultisignatureRegistrationSchema = {
  "moduleID": 4,
  "moduleName": "keys",
  "assetID": 0,
  "assetName": "registerMultisignatureGroup",
  "schema": {
    "$id": "lisk/keys/register",
    "type": "object",
    "required": [
      "numberOfSignatures",
      "optionalKeys",
      "mandatoryKeys"
    ],
    "properties": {
      "numberOfSignatures": {
        "dataType": "uint32",
        "fieldNumber": 1,
        "minimum": 1,
        "maximum": 64
      },
      "mandatoryKeys": {
        "type": "array",
        "items": {
          "dataType": "bytes",
          "minLength": 32,
          "maxLength": 32
        },
        "fieldNumber": 2,
        "minItems": 0,
        "maxItems": 64
      },
      "optionalKeys": {
        "type": "array",
        "items": {
          "dataType": "bytes",
          "minLength": 32,
          "maxLength": 32
        },
        "fieldNumber": 3,
        "minItems": 0,
        "maxItems": 64
      }
    }
  }
}

// dpos module - registerDelegate
export const DPOSRegisterDelegateSchema = {
  "moduleID": 5,
  "moduleName": "dpos",
  "assetID": 0,
  "assetName": "registerDelegate",
  "schema": {
    "$id": "lisk/dpos/register",
    "type": "object",
    "required": [
      "username"
    ],
    "properties": {
      "username": {
        "dataType": "string",
        "fieldNumber": 1,
        "minLength": 1,
        "maxLength": 20
      }
    }
  }
};

// dpos module - voteDelegate
export const DPOSVoteDelegateSchema = {
  "moduleID": 5,
  "moduleName": "dpos",
  "assetID": 1,
  "assetName": "voteDelegate",
  "schema": {
    "$id": "lisk/dpos/vote",
    "type": "object",
    "required": [
      "votes"
    ],
    "properties": {
      "votes": {
        "type": "array",
        "minItems": 1,
        "maxItems": 20,
        "items": {
          "type": "object",
          "required": [
            "delegateAddress",
            "amount"
          ],
          "properties": {
            "delegateAddress": {
              "dataType": "bytes",
              "fieldNumber": 1,
              "minLength": 20,
              "maxLength": 20
            },
            "amount": {
              "dataType": "sint64",
              "fieldNumber": 2
            }
          }
        },
        "fieldNumber": 1
      }
    }
  }
};

// dpos module - unlockToken
export const DPOSUnlockTokenSchema = {
  "moduleID": 5,
  "moduleName": "dpos",
  "assetID": 2,
  "assetName": "unlockToken",
  "schema": {
    "$id": "lisk/dpos/unlock",
    "type": "object",
    "required": [
      "unlockObjects"
    ],
    "properties": {
      "unlockObjects": {
        "type": "array",
        "minItems": 1,
        "maxItems": 20,
        "items": {
          "type": "object",
          "required": [
            "delegateAddress",
            "amount",
            "unvoteHeight"
          ],
          "properties": {
            "delegateAddress": {
              "dataType": "bytes",
              "fieldNumber": 1,
              "minLength": 20,
              "maxLength": 20
            },
            "amount": {
              "dataType": "uint64",
              "fieldNumber": 2
            },
            "unvoteHeight": {
              "dataType": "uint32",
              "fieldNumber": 3
            }
          }
        },
        "fieldNumber": 1
      }
    }
  }
};

// legacyAccount module - reclaimLSK
export const LegacyAccountReclaimSchema = {
  "moduleID": 1000,
  "moduleName": "legacyAccount",
  "assetID": 0,
  "assetName": "reclaimLSK",
  "schema": {
    "$id": "lisk/legacyAccount/reclaim",
    "title": "Reclaim transaction asset",
    "type": "object",
    "required": [
      "amount"
    ],
    "properties": {
      "amount": {
        "dataType": "uint64",
        "fieldNumber": 1
      }
    }
  }
};
