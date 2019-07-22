#/bin/bash
kubectl port-forward --namespace=splunk-peers svc/peer0 7051:7051 7053:7053 &
kubectl port-forward --namespace=splunk-peers svc/peer1 7057:7051 7059:7053 &
kubectl port-forward --namespace=buttercup-peers svc/peer0 8051:7051 8053:7053 &
kubectl port-forward --namespace=orderers svc/ord-hlf-ord 7050:7050 &
