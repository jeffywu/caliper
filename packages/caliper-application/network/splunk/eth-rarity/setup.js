const fs = require('fs');
const Web3 = require('web3');
const {CaliperUtils} = require('caliper-core');
const ethereumConfig = require('./ethereum.json').ethereum;

const workspace_root = '../../../';

/**
 * Deploys the registry to the configured network.
 */
deployRegistry = function () {
  let web3 = new Web3(Web3.givenProvider || ethereumConfig.url);
  const contractData = require(CaliperUtils.resolvePath(ethereumConfig.registry.path, workspace_root));

  // Unlock and add private keys
  let contractDeployerPK = JSON.parse(fs.readFileSync(CaliperUtils.resolvePath(ethereumConfig.contractDeployerPrivateKeyFile, workspace_root)).toString())
  web3.eth.accounts.wallet.decrypt([contractDeployerPK], ethereumConfig.contractDeployerAddressPassword)

  return new Promise(function(resolve, reject) {
      let contract = new web3.eth.Contract(contractData.abi);
      let contractDeploy = contract.deploy({
          data: contractData.bytecode
      });
      contractDeploy.send({
        from: web3.eth.accounts.wallet[0].address,
        gas: contractData.gas,
      }).on('receipt', (receipt) => {
        console.log(receipt);
      }).on('error', (error) => {
        console.log(error)
        reject(error);
      }).then((newContractInstance) => {
        console.log("Deployed contract " + contractData.name + " at " + newContractInstance.options.address);
        resolve(newContractInstance);
      });
  });
}

/**
 * Creates a number of accounts and gives them each minEther from the donor account.
 * @param {integer} numAccounts number of new accounts to create
 * @param {string} minEther amount of wei to transfer into each account.
 * @param {object} donor private key of donor to get ether from
 * @param {string} keyfile path to keyfile to save to.
 */
createAccounts = async function (numAccounts, minEther, keyfile, parallelism) {
  let web3 = new Web3(Web3.givenProvider || ethereumConfig.url);
  let minWei = web3.utils.toWei(minEther, "ether");

  // Unlock and add private keys
  let contractDeployerPK = JSON.parse(fs.readFileSync(CaliperUtils.resolvePath(ethereumConfig.contractDeployerPrivateKeyFile, workspace_root)).toString());
  web3.eth.accounts.wallet.decrypt([contractDeployerPK], ethereumConfig.contractDeployerAddressPassword);
  let donor = web3.eth.accounts.wallet[0].address;

  // Create extra accounts if required.
  if (fs.existsSync(keyfile)) {
    let fromAddressPK = JSON.parse(fs.readFileSync(keyfile).toString());
    web3.eth.accounts.wallet.decrypt(fromAddressPK, ethereumConfig.fromAddressPassword)
    if (fromAddressPK.length < numAccounts) {
        web3.eth.accounts.wallet.create(numAccounts - fromAddressPK.length);
    }
  } else {
    web3.eth.accounts.wallet.create(numAccounts);
  }
 
  // Find accounts that need more ether
  let topUp = []
  for (let i = 1; i <= numAccounts; i++) {
    let balance = await web3.eth.getBalance(web3.eth.accounts.wallet[i].address);
    balance = parseInt(balance);
    if (balance < (minWei * 0.80)) {
      topUp.push(web3.eth.accounts.wallet[i].address);
    }
  }

  if (topUp.length == 0) {
    console.log("No transfers required, exiting");
    return;
  }

  // Determine how many txns each parallel address will send.
  // The first ${parallelism} accounts will be given (minWei + gas) * (txnsToSend + 1) ether.
  // After they are confirmed, they will then loop over the indexes parallelism + (i * txnsToSend)
  let txnsToSend = Math.ceil((topUp.length - parallelism) / parallelism);
  let gasPrice = await web3.eth.getGasPrice();
  let gasPerTxn = web3.utils.toBN(30000)
  let gasFee = web3.utils.toBN(gasPrice).mul(gasPerTxn);
  let initialValue = gasFee.add(web3.utils.toBN(minWei)).mul(web3.utils.toBN(txnsToSend + 1))

  let balance = await web3.eth.getBalance(donor);
  console.log(`Account at ${donor}, balance is ${balance} wei`);

  try {
    for (let i = 0; i < parallelism; i++) {
      // This is annoying but for some reason sendTransaction doesn't find the account.
      let txn = await web3.eth.accounts.wallet[0].signTransaction({
        from: donor,
        to: topUp[i],
        value: initialValue,
        gas: gasPerTxn,
      });
      
      await web3.eth.sendSignedTransaction(txn.rawTransaction).on("receipt", async (receipt) => {
        console.log(`Starting txns with ${receipt.to}`)
        let startIndex = parallelism + (i * txnsToSend);
        for (let j = startIndex; j < startIndex + txnsToSend && j < topUp.length; j++) {
          try {
            let balance = await web3.eth.getBalance(receipt.to);
            console.log(`Attemting to send txn to ${topUp[j]} from ${receipt.to}`);
            console.log(`Balance at ${receipt.to} is ${balance}`);
            await web3.eth.sendTransaction({
              from: receipt.to,
              to: topUp[j],
              value: minWei,
              gas: gasPerTxn
            });
          } catch (err) {
            console.log(err);
          }
          let balance = await web3.eth.getBalance(topUp[j]);
          console.log(`Account at ${topUp[j]}, balance is ${balance} wei`);
        }
      })
    }
  } catch (err) {
    console.log(`Error: ${err}`)
  } finally {
    web3.eth.accounts.wallet.remove(0);
    let wallet = web3.eth.accounts.wallet.encrypt(ethereumConfig.fromAddressPassword);
    fs.writeFileSync(keyfile, JSON.stringify(wallet));
  }
}

// deployRegistry();
createAccounts(10, "0.001", "remote-config/test1", 1)
