/**
* Copyright 2019 Splunk. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
 */

package main

import (
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

const errorSystem = "{\"code\":300, \"reason\": \"system error: %s\"}"
const errorWrongFormat = "{\"code\":301, \"reason\": \"command format is wrong\"}"
const compositeKeyFormat = "sender~bucket~index"

// DataIntegrityChaincode is an interface for the chaincode
type DataIntegrityChaincode struct {
}

// Response is the return type for a query action.
type Response struct {
	Sender string `json:"sender"`
	Bucket string `json:"bucket"`
	Index  string `json:"index"`
	Hash   string `json:"hash"`
}

// Init chaincode (nothing to do)
func (t *DataIntegrityChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	// nothing to do
	return shim.Success(nil)
}

// Invoke chaincode with submitHash or queryHash
func (t *DataIntegrityChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()

	if function == "submitHash" {
		return t.submitHash(stub, args)
	}
	if function == "queryHash" {
		return t.queryHash(stub, args)
	}

	return shim.Error(errorWrongFormat)
}

// Write a new hash value [submitHash bucket index hash]
func (t *DataIntegrityChaincode) submitHash(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 3 {
		return shim.Error(errorWrongFormat)
	}
	senderBytes, err := stub.GetCreator()
	if err != nil {
		s := fmt.Sprintf(errorSystem, err.Error())
		return shim.Error(s)
	}
	senderHex := hex.EncodeToString(senderBytes)

	key, err := stub.CreateCompositeKey(compositeKeyFormat, []string{senderHex, args[0], args[1]})
	if err != nil {
		s := fmt.Sprintf(errorSystem, err.Error())
		return shim.Error(s)
	}

	err = stub.PutState(key, []byte(args[2]))
	if err != nil {
		s := fmt.Sprintf(errorSystem, err.Error())
		return shim.Error(s)
	}

	return shim.Success(nil)
}

// Query for values of sender [queryHash sender]
func (t *DataIntegrityChaincode) queryHash(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error(errorWrongFormat)
	}
	sender := args[0]

	resultsIterator, err := stub.GetStateByPartialCompositeKey(compositeKeyFormat, []string{sender})
	if err != nil {
		return shim.Error(fmt.Sprintf("Could not retrieve value for %s: %s", sender, err.Error()))
	}
	defer resultsIterator.Close()

	// Check the variable existed
	if !resultsIterator.HasNext() {
		return shim.Error(fmt.Sprintf("No variable by the name %s exists", sender))
	}

	var values []Response
	var i int
	for i = 0; resultsIterator.HasNext(); i++ {
		responseRange, nextErr := resultsIterator.Next()
		if nextErr != nil {
			return shim.Error(nextErr.Error())
		}

		// Split the composite key into its component parts
		_, keyParts, splitKeyErr := stub.SplitCompositeKey(responseRange.Key)
		if splitKeyErr != nil {
			return shim.Error(splitKeyErr.Error())
		}

		// Retrieve the delta value and operation
		resp := Response{
			Sender: sender,
			Bucket: keyParts[1],
			Index:  keyParts[2],
			Hash:   string(responseRange.Value)}
		values = append(values, resp)
	}

	output, jsErr := json.Marshal(values)
	if jsErr != nil {
		return shim.Error(jsErr.Error())
	}

	return shim.Success(output)
}

func main() {
	err := shim.Start(new(DataIntegrityChaincode))
	if err != nil {
		fmt.Printf("Error starting chaincode: %v \n", err)
	}
}
