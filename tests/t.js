const { cryptography, transactions } = require('@liskhq/lisk-client');

const msg = 0x80;
const rest = 0x7f;

const writeUInt64 = (value) => {
  const result = [];
  let index = 0;
  while (value > BigInt(rest)) {
      result[index] = Number(BigInt(msg) | (value & BigInt(rest)));
      value >>= BigInt(7);
      index += 1;
  }
  result[Number(index)] = Number(value);
  return Buffer.from(result);
};

const readUInt64 = (buffer, offset) => {
  let result = BigInt(0);
  let index = offset;
  for (let shift = BigInt(0); shift < BigInt(64); shift += BigInt(7)) {
      if (index >= buffer.length) {
          throw new Error('Invalid buffer length');
      }
      const bit = BigInt(buffer[index]);
      index += 1;
      if (index === 10 + offset && bit > 0x01) {
          throw new Error('Value out of range of uint64');
      }
      console.info("shift ", shift);
      result |= (bit & BigInt(rest)) << shift;
      if ((bit & BigInt(msg)) === BigInt(0)) {
          return [result, index - offset];
      }
  }
  throw new Error('Terminating bit not found');
};

const addr = cryptography.getAddressFromPublicKey(Buffer.from('06bbcef091660c9dd39286bf27c5161a20e3074056bf532ce305cad4642ea5cc', 'hex'));
console.info('addr', addr);

const DPOSVoteDelegateSchema = {
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

/*
const signingBytes = transactions.getSigningBytes(TransferAssetSchema.schema, {
    moduleID: 2,
    assetID: 0,
    nonce: BigInt(3),
    fee: BigInt(10000000),
    senderPublicKey: addr,
    asset: {
        amount: BigInt(10000000),
        recipientAddress: addr,
        data: '',
    },
  });
*/
  // const txBytes = Buffer.concat([ networkIdentifier, signingBytes ]);

  const signingBytes = transactions.getSigningBytes(DPOSVoteDelegateSchema.schema, {
    moduleID: 2,
    assetID: 0,
    nonce: BigInt(3),
    fee: BigInt(10000000),
    senderPublicKey: addr,
    asset: {
      votes: [
        {
          delegateAddress: addr,
          amount: BigInt(10000000),
        },
        {
          delegateAddress: addr,
          amount: BigInt(20000000),
        }
      ]
    },
  });

  console.info("signingBytes", signingBytes);
  console.info("signingBytes", signingBytes.toString('hex').toUpperCase());

  /*
  const resbig = BigInt(2500000000)
  console.info("resbig ", resbig);
  console.info("writeUInt64 ", writeUInt64(resbig))
  console.info("readUInt64 ", readUInt64(writeUInt64(resbig), 0))

  console.info("BigInt(0x00F90295FFFFFFFF)", BigInt("0x00F90295FFFFFFFF"));
  console.info("BigInt(0xFFFFFFFF00F90295)", BigInt("0xFFFFFFFF00F90295"));
  console.info("BigInt(0x0000000000F90295)", BigInt("0x0000000000F90295"));
  console.info("BigInt(0x000000009502F900)", BigInt("0x000000009502F900"));
  */