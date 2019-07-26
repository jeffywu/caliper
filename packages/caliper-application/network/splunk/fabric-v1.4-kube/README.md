# Prerequisites
For AWS, make sure that you have `kubectl` and `aws-iam-authenticator` installed. See these docs:
  * https://docs.aws.amazon.com/eks/latest/userguide/install-kubectl.html
  * https://docs.aws.amazon.com/eks/latest/userguide/install-aws-iam-authenticator.html

Then follow these instructions to setup your kubeconfig:
```
aws --version     # Check that this is > 1.16.156
aws eks --region region update-kubeconfig --name cluster_name
kubectl get svc
```
More details at: https://docs.aws.amazon.com/eks/latest/userguide/create-kubeconfig.html

# Running a Remote Test on Kubernetes
This network config enables you to run a remote test on a kubernetes environment. Setting up the test is simple.

1. Create a softlink from your crypto-config folder to this directory named remote-config. Your crypto config folder should also have
channel transaction files in the root directory. The end result should look something like this:

```
|- remote-config/ -> .../crypto-config
|-- ordererOrganizations/
|-- peerOrganizations/
|-- channel1.tx
|-- channel2.tx
|-- genesis.block
```

2. Map the `port_forward.sh` script to the service endpoints in your Kubernetes cluster. You can see these at `kubectl get svc --all-namespaces`.

3. Map the `network.json` file to your network's parameters.

    * `fabric.network`: should contain a list of orgs (orderer, peer orgs) and the nodes they contain.
    * `channel`: should contain a list of channels, their creation transaction, joined organizations and whether they are deployed or not.
    * `chaincodes`: will contain a list of chaincodes that need to be deployed (currently not tested)
    * `endorsement-policy`: not sure what this does :)
    * `context`: **IMPORTANT!** map javascript benchmark code in caliper-application/benchmark/<chaincode>/<operation>.js to the channel that they should run on.

For example:

```
"context": {
  "smallOperations": "groupchannel",
  "query": "groupchannel"
}
```

4. Turn on port forwarding so you can connect to the cluster. 
```
./port-forwarding.sh
```

5. Run the benchmark
```
cd packages/caliper-application/scripts
node run-benchmark.js -c ../benchmark/<chaincode>/config.yaml -t fabric-ccp -n ../network/splunk/fabric-v1.4-kube/network.json
```

6. Profit!