/**
* Copyright 2019 Splunk. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict';

module.exports.info = 'writes hashes to contract';

let indexes = new Map();
let txnPerBatch;
let bc, contx;

module.exports.init = function(blockchain, context, args) {
  if(!args.hasOwnProperty('txnPerBatch')) {
    args.txnPerBatch = 1;
  }

  if(!args.hasOwnProperty('numIndexes')) {
    return Promise.reject(new Error('adi.write - \'numIndexes\' is a required argument'));
  }

  for(let i=0; i < args.numIndexes; i++) {
    indexes.set('index_' + i, []);
  }

  txnPerBatch = args.txnPerBatch;
  bc = blockchain;
  contx = context;

  return Promise.resolve();
};

/**
 * Generates a random string of given length.
 */
String.random = function (length) {
	let random13chars = function () {
		return Math.random().toString(16).substring(2, 15)
	}
	let loops = Math.ceil(length / 13)
	return new Array(loops).fill(random13chars).reduce((string, func) => {
		return string + func()
	}, '').substring(0, length)
}

module.exports.run = function() {
  let workload = [];
  for(let i=0; i < txnPerBatch; i++) {
    indexes.forEach((buckets, indexName, i) => {
      let newBucket = indexName + '_bucket_' + (buckets.length + 1);
      indexes.get(indexName).push(newBucket);
      let hash = String.random(45);

      if (bc.bcType === 'fabric-ccp') {
        workload.push({
          chaincodeFunction: 'submitHash',
          chaincodeArguments: [newBucket, indexName, hash]
        })
      } else {
        workload.push({
          'verb': 'submitHash',
          'bucket': newBucket,
          'index': indexName,
          'hash': hash
        })
      }
    });
  }

  return bc.invokeSmartContract(contx, 'adi', 'v0', workload, 100);
};


module.exports.end = function() {
  return Promise.resolve();
};

module.exports.indexes = indexes;